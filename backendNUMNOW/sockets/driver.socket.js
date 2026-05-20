const driverService = require("./services/driver.service");
const Order = require("../models/Order");
const Driver = require("../models/Driver");
const Restaurant = require("../models/restaurant");
const _ = require("lodash");
const { getSocketMessages } = require("../utils/messages");

const AUTO_CONFIRM_MINUTES = 10;

async function autoConfirmOrder(order, io) {
  const driverId = order.driverId;

  const freshDriver = await Driver.findById(driverId).select("country");

  const updatedOrder = await Order.findOneAndUpdate(
    { _id: order._id, orderStatus: "delivered_by_driver" },
    {
      orderStatus: "delivered",
      paymentStatus: "paid",
      settlementStatus: "pending_settlement",
      // DE
      // كلا البلدين يبدآن بـ "pending" — السوري يُسوَّى بالكاش، الألماني بتحويل بنكي
      driverPaymentStatus: "pending",
    },
    { new: true },
  );

  if (!updatedOrder) return; // user_socket سبقنا — لا نكمل

  if (freshDriver?.country === "SY") {
    // السوري: يتراكم cashCollected بكامل المبلغ
    await Driver.findByIdAndUpdate(driverId, {
      $inc: { cashCollected: updatedOrder.totalPrice },
      availability: "online",
    });
  } else {
    // DE
    // السائق الألماني لا يحمل كاش — لا يوجد $inc على أي حقل
    // أجرته (deliveryFee) تُحسب من الأوردرات مباشرة عند الطلب
    // الفرونت (تطبيق السائق): استمع لـ driver:currentStatus { availability: "online" }
    //   لإعادة تفعيل زر "جاهز للطلبات"
    await Driver.findByIdAndUpdate(driverId, {
      availability: "online",
    });
  }

  io.of("/driver").to(driverId.toString()).emit("order:statusUpdated", {
    orderId: updatedOrder._id,
    orderNumber: updatedOrder.orderNumber,
    status: "delivered",
  });

  io.of("/driver")
    .to(driverId.toString())
    .emit("driver:currentStatus", { availability: "online" });

  io.of("/user")
    .to(updatedOrder.userId.toString())
    .emit("order:statusUpdated", {
      orderId: updatedOrder._id,
      orderNumber: updatedOrder.orderNumber,
      status: "delivered",
    });

  io.of("/restaurant")
    .to(updatedOrder.restaurantId.toString())
    .emit("order:updated", { order: updatedOrder });

  console.log(`⏰ Auto-confirmed order ${updatedOrder.orderNumber}`);
}

module.exports = (io, driverNS) => {
  driverNS.on("connection", async (socket) => {
    const driverId = socket.userId;
    const m = getSocketMessages(socket).socket.driver;

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
            message: m.hasActiveOrder,
          });
        }

        // new
        // ── تحقق من أوردر في انتظار تأكيد المستخدم ─────────────────────────
        const pendingOrder = await Order.findOne({
          driverId,
          orderStatus: "delivered_by_driver",
        });

        if (pendingOrder) {
          const elapsed =
            Date.now() - new Date(pendingOrder.deliveredByDriverAt).getTime();
          const remainingMs = AUTO_CONFIRM_MINUTES * 60 * 1000 - elapsed;

          if (remainingMs > 0) {
            const remainingMinutes = Math.ceil(remainingMs / 60000);
            return socket.emit("driver:goOnline:error", {
              message: m.waitingConfirmation.replace(
                "{{minutes}}",
                remainingMinutes,
              ),
              remainingMinutes,
            });
          }

          await autoConfirmOrder(pendingOrder, io);
          const driver = await driverService.goOnline(driverId);
          return;
        }

        const driver = await driverService.goOnline(driverId);
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
            message: m.hasActiveOrder,
          });
        }
        // new
        // ── تحقق من أوردر في انتظار تأكيد المستخدم ─────────────────────────
        const pendingOrder = await Order.findOne({
          driverId,
          orderStatus: "delivered_by_driver",
        });

        if (pendingOrder) {
          const elapsed =
            Date.now() - new Date(pendingOrder.deliveredByDriverAt).getTime();
          const remainingMs = AUTO_CONFIRM_MINUTES * 60 * 1000 - elapsed;

          if (remainingMs > 0) {
            const remainingMinutes = Math.ceil(remainingMs / 60000);
            return socket.emit("driver:goOffline:error", {
              message: m.waitingConfirmation.replace(
                "{{minutes}}",
                remainingMinutes,
              ),
              remainingMinutes,
            });
          }

          await autoConfirmOrder(pendingOrder, io);
          const driver = await driverService.goOffline(driverId);
          return;
        }

        const driver = await driverService.goOffline(driverId);
      } catch (error) {
        socket.emit("driver:goOffline:error", { message: error.message });
      }
    });

    socket.on(
      "driver:updateLocation",
      _.throttle(async (data) => {
        try {
          const driver = await driverService.updateLocation(driverId, data);
        } catch (error) {
          socket.emit("driver:updateLocation:error", {
            message: error.message,
          });
        }
      }, 5000),
    );

    socket.on("order:driverResponse", async (data) => {
      try {
        const { orderId, response } = data;

        if (!orderId || !response) {
          return socket.emit("order:error", {
            message: m.orderIdAndResponse,
          });
        }

        if (response === "rejected") {
          return socket.emit("order:driverRequest:rejected", {
            message: m.rejected,
          });
        }

        const [order, driver] = await Promise.all([
          Order.findById(orderId).select(
            "driverId restaurantId totalPrice orderNumber orderStatus",
          ),
          Driver.findById(driverId).select(
            "country cashCreditLimit cashCollected availability",
          ),
        ]);

        if (!order) {
          return socket.emit("order:error", { message: m.orderNotFound });
        }

        // 1. تحقق أن السائق online
        if (driver.availability !== "online") {
          return socket.emit("order:error", { message: m.notOnline });
        }

        // 2. تحقق من عدم وجود أوردر نشط
        const activeOrder = await Order.findOne({
          driverId,
          orderStatus: {
            $in: ["picked_up", "on_the_way", "delivered_by_driver"],
          },
        });
        if (activeOrder) {
          return socket.emit("order:error", { message: m.alreadyHasOrder });
        }

        // 3. تحقق أن الأوردر لا يزال في حالة accepted
        if (order.orderStatus !== "accepted") {
          return socket.emit("order:driverRequest:expired", {
            message: m.orderExpired,
          });
        }

        // 4. تحقق أن أحداً لم يأخذ الأوردر
        if (order.driverId) {
          return socket.emit("order:driverRequest:expired", {
            message: m.orderTaken,
          });
        }

        const restaurant = await Restaurant.findById(order.restaurantId).select(
          "country",
        );

        if (restaurant.country !== driver.country) {
          return socket.emit("order:error", { message: m.differentCountry });
        }

        if (driver.country === "SY") {
          const wouldCollect = driver.cashCollected + order.totalPrice;
          if (wouldCollect > driver.cashCreditLimit) {
            return socket.emit("order:cashLimit:exceeded", {
              message: m.cashLimitReached,
              cashCollected: driver.cashCollected,
              cashCreditLimit: driver.cashCreditLimit,
              orderTotal: order.totalPrice,
            });
          }
        }

        order.driverId = driverId;
        order.orderStatus = "picked_up";
        order.driverSearchStatus = "assigned";
        await order.save();

        const [populatedOrder] = await Promise.all([
          Order.findById(order._id)
            .populate("userId", "name phone")
            .populate("restaurantId", "name location")
            .populate("driverId", "name phone vehicletype vehicleplate rating"),
          Driver.findByIdAndUpdate(driverId, { availability: "busy" }),
        ]);

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
            order: populatedOrder,
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
          return socket.emit("order:error", { message: m.orderIdRequired });
        }

        const order = await Order.findOne({ _id: orderId, driverId }).select(
          "orderStatus userId restaurantId orderNumber",
        );

        if (!order) {
          return socket.emit("order:error", { message: m.orderNotFound });
        }

        if (order.orderStatus !== "picked_up") {
          return socket.emit("order:error", { message: m.mustBePickedUp });
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

        io.of("/user").to(order.userId.toString()).emit("order:statusUpdated", {
          orderId: order._id,
          orderNumber: order.orderNumber,
          status: "on_the_way",
        });

        io.of("/restaurant")
          .to(order.restaurantId.toString())
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
          return socket.emit("order:error", { message: m.orderIdRequired });
        }

        const order = await Order.findOne({ _id: orderId, driverId }).select(
          "orderStatus userId restaurantId orderNumber",
        );

        if (!order) {
          return socket.emit("order:error", { message: m.orderNotFound });
        }

        if (order.orderStatus !== "on_the_way") {
          return socket.emit("order:error", { message: m.mustBeOnTheWay });
        }

        order.orderStatus = "delivered_by_driver";
        order.deliveredByDriverAt = new Date();
        await order.save();

        const populatedOrder = await Order.findById(order._id)
          .populate("userId", "name phone")
          .populate("driverId", "name phone vehicletype vehicleplate rating");

        socket.emit("order:statusUpdated", {
          orderId: order._id,
          orderNumber: order.orderNumber,
          status: "delivered_by_driver",
        });

        io.of("/user").to(order.userId.toString()).emit("order:statusUpdated", {
          orderId: order._id,
          orderNumber: order.orderNumber,
          status: "delivered_by_driver",
        });

        io.of("/restaurant")
          .to(order.restaurantId.toString())
          .emit("order:updated", { order: populatedOrder });

        // تأكيد تلقائي بعد 10 دقائق لو المستخدم ما أكد
        setTimeout(
          () => autoConfirmOrder(order, io),
          AUTO_CONFIRM_MINUTES * 60 * 1000,
        );

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
