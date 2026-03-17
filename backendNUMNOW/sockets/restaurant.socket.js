const Order = require("../models/Order");
const Driver = require("../models/Driver");
const Restaurant = require("../models/restaurant");
const { findAndNotifyDrivers } = require("./services/order.service");

module.exports = (io, restaurantNS) => {
  restaurantNS.on("connection", (socket) => {
    const restaurantId = socket.userId;

    socket.join(restaurantId.toString());
    socket.emit("connected", { ok: true });

    socket.on("order:updateStatus", async (data) => {
      try {
        const { orderId, status } = data;

        if (!orderId) {
          return socket.emit("order:error", { message: "orderId is required" });
        }

        const allowedStatuses = ["accepted", "preparing", "ready", "cancelled"];
        if (!allowedStatuses.includes(status)) {
          return socket.emit("order:error", { message: "Invalid status" });
        }

        const order = await Order.findOne({
          _id: orderId,
          restaurantId,
        }).populate("userId", "name phone");

        if (!order) {
          return socket.emit("order:error", { message: "Order not found" });
        }

        const lockedStatuses = [
          "cancelled",
          "delivered",
          "picked_up",
          "on_the_way",
        ];
        if (lockedStatuses.includes(order.orderStatus)) {
          return socket.emit("order:error", {
            message: `Cannot change status: order is already ${order.orderStatus}`,
          });
        }

        order.orderStatus = status;
        await order.save();

        // ✅ أعد جلب بعد الحفظ مع populate كامل
        const populatedOrder = await Order.findById(order._id)
          .populate("userId", "name phone")
          .populate("driverId", "name phone vehicletype vehicleplate rating");

        socket.emit("order:updated", { order: populatedOrder });

        io.of("/user")
          .to(order.userId._id.toString())
          .emit("order:statusUpdated", {
            orderId: order._id,
            orderNumber: order.orderNumber,
            status: order.orderStatus,
          });

        // ✅ عند القبول ابدأ البحث عن سائق
        if (status === "accepted") {
          const restaurant = await Restaurant.findById(restaurantId);

          socket.emit("order:searchingDriver", {
            orderId: order._id,
            orderNumber: order.orderNumber,
            message: "Searching for a driver",
          });

          await findAndNotifyDrivers(
            io,
            order,
            restaurant.location.coordinates,
          );
        }

        console.log(`Order ${order.orderNumber} → ${status}`);
      } catch (error) {
        console.error("order:updateStatus error:", error);
        socket.emit("order:error", { message: error.message });
      }
    });

    socket.on("order:searchDriverAgain", async (data) => {
      try {
        const { orderId } = data;

        if (!orderId) {
          return socket.emit("order:error", { message: "orderId is required" });
        }

        const order = await Order.findOne({ _id: orderId, restaurantId });

        if (!order) {
          return socket.emit("order:error", { message: "Order not found" });
        }

        if (order.driverSearchStatus !== "failed") {
          return socket.emit("order:error", {
            message: "Order is not in failed state",
          });
        }

        // ✅ أعد ضبط الحالة
        await Order.findByIdAndUpdate(orderId, {
          driverSearchStatus: "searching",
        });

        const restaurant = await Restaurant.findById(restaurantId);

        // ✅ أشعر المطعم إنه بدأ البحث
        socket.emit("order:searchingDriver", {
          orderId: order._id,
          orderNumber: order.orderNumber,
          message: "Searching for a driver",
        });

        // ✅ ابدأ البحث من جديد بدون استثناءات
        await findAndNotifyDrivers(io, order, restaurant.location.coordinates);
      } catch (error) {
        console.error("order:searchDriverAgain error:", error);
        socket.emit("order:error", { message: error.message });
      }
    });

    socket.on("disconnect", () => {
      console.log("Restaurant disconnected:", restaurantId);
    });
  });
};
