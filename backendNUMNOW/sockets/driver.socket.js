const driverService = require("./services/driver.service");
const Order = require("../models/Order");
const Driver = require("../models/Driver");
const Restaurant = require("../models/restaurant");
const _ = require("lodash");

module.exports = (io, driverNS, adminNS) => {
  driverNS.on("connection", async (socket) => {
    const driverId = socket.userId;
    console.log("Driver connected:", driverId);

    socket.join(driverId.toString());

    const driver = await Driver.findById(driverId).select("availability");
    socket.emit("driver:currentStatus", { availability: driver.availability });

    socket.on("driver:goOnline", async () => {
      try {
        const activeOrder = await Order.findOne({
          driverId,
          orderStatus: { $in: ["picked_up", "on_the_way"] },
        });
        if (activeOrder) {
          return socket.emit("driver:goOnline:error", {
            message: "You have an active order — complete it first",
          });
        }
        const driver = await driverService.goOnline(driverId);
        adminNS.emit("driver:statusUpdated", driver);
      } catch (error) {
        socket.emit("driver:goOnline:error", { message: error.message });
      }
    });

    socket.on("driver:goOffline", async () => {
      try {
        const activeOrder = await Order.findOne({
          driverId,
          orderStatus: { $in: ["picked_up", "on_the_way"] },
        });
        if (activeOrder) {
          return socket.emit("driver:goOffline:error", {
            message: "You have an active order — complete it first",
          });
        }
        const driver = await driverService.goOffline(driverId);
        adminNS.emit("driver:statusUpdated", driver);
      } catch (error) {
        socket.emit("driver:goOffline:error", { message: error.message });
      }
    });

    socket.on(
      "driver:updateLocation",
      _.throttle(async (data) => {
        try {
          const driver = await driverService.updateLocation(driverId, data);
          adminNS.emit("driver:locationUpdated", driver);
        } catch (error) {
          socket.emit("driver:updateLocation:error", {
            message: error.message,
          });
        }
      }, 5000),
    );

    // ✅ السائق يقبل أو يرفض الطلب
    socket.on("order:driverResponse", async (data) => {
      try {
        const { orderId, response } = data;

        if (!orderId || !response) {
          return socket.emit("order:error", {
            message: "orderId and response are required",
          });
        }

        const order = await Order.findById(orderId)
          .populate("userId", "name phone")
          .populate("restaurantId", "name location")
          .populate("driverId", "name phone vehicletype vehicleplate rating");

        if (!order) {
          return socket.emit("order:error", { message: "Order not found" });
        }

        // الطلب اتأخذ من سائق ثاني
        if (order.driverId) {
          return socket.emit("order:driverRequest:expired", {
            message: "Order already taken by another driver",
          });
        }

        const restaurant = await Restaurant.findById(order.restaurantId).select(
          "country",
        );
        const driver = await Driver.findById(driverId).select("country");

        if (restaurant.country !== driver.country) {
          return socket.emit("order:error", {
            message: "You cannot accept orders from a different country",
          });
        }

        if (response === "rejected") {
          // ✅ أشعر السيرفر برفضه حتى يُستثنى في الجولة القادمة
          socket.emit("order:driverRequest:rejected", {
            message: "You rejected the order",
          });
          return;
        }

        // ✅ السائق قبل الطلب
        order.driverId = driverId;
        order.orderStatus = "picked_up";
        order.driverSearchStatus = "assigned";
        await order.save();

        await Driver.findByIdAndUpdate(driverId, { availability: "busy" });

        // ✅ أعد جلب الأوردر كامل مع populate
        const populatedOrder = await Order.findById(order._id)
          .populate("userId", "name phone")
          .populate("restaurantId", "name location")
          .populate("driverId", "name phone vehicletype vehicleplate rating");

        socket.emit("order:driverRequest:accepted", {
          success: true,
          order: populatedOrder,
        });

        io.of("/user")
          .to(populatedOrder.userId._id.toString())
          .emit("order:statusUpdated", {
            orderId: populatedOrder._id,
            orderNumber: populatedOrder.orderNumber,
            status: populatedOrder.orderStatus,
            driver: { id: driverId },
          });

        io.of("/restaurant")
          .to(populatedOrder.restaurantId._id.toString())
          .emit("order:driverAssigned", {
            orderId: populatedOrder._id,
            orderNumber: populatedOrder.orderNumber,
            order: populatedOrder, // ✅ الأوردر كامل
          });

        console.log(`Driver ${driverId} accepted order ${order.orderNumber}`);
      } catch (error) {
        console.error("order:driverResponse error:", error);
        socket.emit("order:error", { message: error.message });
      }
    });

    socket.on("order:startDelivery", async (data) => {
      try {
        const { orderId } = data;

        if (!orderId) {
          return socket.emit("order:error", { message: "orderId is required" });
        }

        const order = await Order.findOne({ _id: orderId, driverId })
          .populate("userId", "name phone")
          .populate("restaurantId", "name");

        if (!order) {
          return socket.emit("order:error", { message: "Order not found" });
        }

        if (order.orderStatus !== "picked_up") {
          return socket.emit("order:error", {
            message: "Order must be picked_up first",
          });
        }

        order.orderStatus = "on_the_way";
        await order.save();
        const populatedOrder = await Order.findById(order._id)
          .populate("userId", "name phone")
          .populate("driverId", "name phone vehicletype vehicleplate rating")
          .populate("restaurantId", "name");

        socket.emit("order:statusUpdated", {
          orderId: order._id,
          orderNumber: order.orderNumber,
          status: "on_the_way",
        });

        io.of("/user")
          .to(order.userId._id.toString())
          .emit("order:statusUpdated", {
            orderId: order._id,
            orderNumber: order.orderNumber,
            status: "on_the_way",
          });

        io.of("/restaurant")
          .to(order.restaurantId._id.toString())
          .emit("order:updated", { order: populatedOrder });

        console.log(
          `Driver ${driverId} → order ${order.orderNumber} : on_the_way`,
        );
      } catch (error) {
        console.error("order:startDelivery error:", error);
        socket.emit("order:error", { message: error.message });
      }
    });

    socket.on("order:delivered", async (data) => {
      try {
        const { orderId } = data;

        if (!orderId) {
          return socket.emit("order:error", { message: "orderId is required" });
        }

        const order = await Order.findOne({ _id: orderId, driverId })
          .populate("userId", "name phone")
          .populate("restaurantId", "name");

        if (!order) {
          return socket.emit("order:error", { message: "Order not found" });
        }

        if (order.orderStatus !== "on_the_way") {
          return socket.emit("order:error", {
            message: "Order must be on_the_way first",
          });
        }

        order.orderStatus = "delivered_by_driver";
        await order.save();

        // ✅ أشعر السائق
        socket.emit("order:statusUpdated", {
          orderId: order._id,
          orderNumber: order.orderNumber,
          status: "delivered_by_driver",
        });

        // ✅ أشعر المستخدم إنه يؤكد الاستلام
        io.of("/user")
          .to(order.userId._id.toString())
          .emit("order:statusUpdated", {
            orderId: order._id,
            orderNumber: order.orderNumber,
            status: "delivered_by_driver",
          });

        // ✅ أشعر المطعم
        io.of("/restaurant")
          .to(order.restaurantId._id.toString())
          .emit("order:updated", {
            order: await Order.findById(order._id)
              .populate("userId", "name phone")
              .populate(
                "driverId",
                "name phone vehicletype vehicleplate rating",
              ),
          });

        // ✅ Auto-confirm بعد 10 دقائق
        setTimeout(
          async () => {
            try {
              const freshOrder = await Order.findById(orderId);
              if (freshOrder.orderStatus !== "delivered_by_driver") return;

              freshOrder.orderStatus = "delivered";
              freshOrder.paymentStatus = "paid";
              freshOrder.settlementStatus = "pending_settlement";
              await freshOrder.save();

              await Driver.findByIdAndUpdate(driverId, {
                availability: "online",
              });

              io.of("/driver")
                .to(driverId.toString())
                .emit("order:statusUpdated", {
                  orderId: freshOrder._id,
                  orderNumber: freshOrder.orderNumber,
                  status: "delivered",
                });

              io.of("/driver")
                .to(driverId.toString())
                .emit("driver:currentStatus", { availability: "online" });

              io.of("/user")
                .to(freshOrder.userId.toString())
                .emit("order:statusUpdated", {
                  orderId: freshOrder._id,
                  orderNumber: freshOrder.orderNumber,
                  status: "delivered",
                });

              io.of("/restaurant")
                .to(freshOrder.restaurantId.toString())
                .emit("order:updated", { order: freshOrder });

              console.log(`⏰ Auto-confirmed order ${freshOrder.orderNumber}`);
            } catch (error) {
              console.error("Auto-confirm error:", error);
            }
          },
          10 * 60 * 1000,
        ); // 10 دقائق

        console.log(
          `Driver ${driverId} → order ${order.orderNumber} : delivered_by_driver`,
        );
      } catch (error) {
        console.error("order:delivered error:", error);
        socket.emit("order:error", { message: error.message });
      }
    });

    socket.on("disconnect", () => {
      console.log("Driver disconnected:", driverId);
    });
  });
};
