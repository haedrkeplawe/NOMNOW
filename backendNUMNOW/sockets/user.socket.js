const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Driver = require("../models/Driver");

module.exports = (io, userNS) => {
  userNS.on("connection", (socket) => {
    const userId = socket.userId;
    socket.join(userId.toString());
    socket.emit("connected", { ok: true });

    socket.on("order:send", async (data) => {
      try {
        const { orderId } = data;

        if (!orderId) {
          return socket.emit("order:error", { message: "orderId is required" });
        }

        const order = await Order.findOne({ _id: orderId, userId })
          .populate("restaurantId", "name")
          .populate("userId", "name phone");

        if (!order) {
          return socket.emit("order:error", { message: "Order not found" });
        }

        if (order.orderStatus !== "not_confirmed") {
          return socket.emit("order:error", {
            message: "Order already sent or cancelled",
          });
        }

        order.orderStatus = "pending";
        await order.save();

        await Cart.findOneAndDelete({ userId });

        io.of("/restaurant")
          .to(order.restaurantId._id.toString())
          .emit("order:new", { order });

        // تأكيد للمستخدم
        socket.emit("order:sent", {
          success: true,
          message: "Order sent to restaurant",
          orderId: order._id,
        });
        console.log(`✅ Order ${order.orderNumber} sent to restaurant`);
      } catch (error) {
        console.error("order:send error:", error);
        socket.emit("order:error", { message: error.message });
      }
    });

    socket.on("order:confirmDelivery", async (data) => {
      try {
        const { orderId } = data;

        if (!orderId) {
          return socket.emit("order:error", { message: "orderId is required" });
        }

        const order = await Order.findOne({ _id: orderId, userId })
          .populate("restaurantId", "name")
          .populate("driverId", "name");

        if (!order) {
          return socket.emit("order:error", { message: "Order not found" });
        }

        if (order.orderStatus !== "delivered_by_driver") {
          return socket.emit("order:error", {
            message: "Order is not waiting for confirmation",
          });
        }

        order.orderStatus = "delivered";
        await order.save();

        // ✅ أشعر المستخدم
        socket.emit("order:statusUpdated", {
          orderId: order._id,
          orderNumber: order.orderNumber,
          status: "delivered",
        });

        // ✅ أشعر السائق وحرره
        await Driver.findByIdAndUpdate(order.driverId, {
          availability: "online",
        });

        io.of("/driver")
          .to(order.driverId._id.toString())
          .emit("order:statusUpdated", {
            orderId: order._id,
            orderNumber: order.orderNumber,
            status: "delivered",
          });

        io.of("/driver")
          .to(order.driverId._id.toString())
          .emit("driver:currentStatus", { availability: "online" });

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

        console.log(
          `✅ Order ${order.orderNumber} confirmed by user → delivered`,
        );
      } catch (error) {
        console.error("order:confirmDelivery error:", error);
        socket.emit("order:error", { message: error.message });
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", userId);
    });
  });
};
