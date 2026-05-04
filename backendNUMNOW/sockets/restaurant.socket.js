const Order = require("../models/Order");
const Driver = require("../models/Driver");
const Restaurant = require("../models/restaurant");
const { getSocketMessages } = require("../utils/messages");
const Stripe = require("stripe");
const { HttpsProxyAgent } = require("https-proxy-agent");
const stripeAgent = process.env.HTTP_PROXY
  ? new HttpsProxyAgent(process.env.HTTP_PROXY)
  : undefined;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  httpAgent: stripeAgent,
});
const {
  findAndNotifyDrivers,
  cancelActiveSearch,
} = require("./services/order.service");

module.exports = (io, restaurantNS) => {
  restaurantNS.on("connection", (socket) => {
    const restaurantId = socket.userId;
    const m = getSocketMessages(socket).socket.restaurant;

    socket.join(restaurantId.toString());
    socket.emit("connected", { ok: true });

    socket.on("order:updateStatus", async (data) => {
      try {
        const { orderId, status } = data;

        if (!orderId) {
          return socket.emit("order:error", { message: m.orderIdRequired });
        }

        const allowedStatuses = ["accepted", "preparing", "ready", "cancelled"];
        if (!allowedStatuses.includes(status)) {
          return socket.emit("order:error", { message: m.invalidStatus });
        }

        const order = await Order.findOne({
          _id: orderId,
          restaurantId,
        }).populate("userId", "name phone");

        if (!order) {
          return socket.emit("order:error", { message: m.orderNotFound });
        }

        const lockedStatuses = [
          "cancelled",
          "delivered",
          "picked_up",
          "on_the_way",
        ];
        if (lockedStatuses.includes(order.orderStatus)) {
          return socket.emit("order:error", {
            message: m.cannotChangeStatus.replace(
              "{{status}}",
              order.orderStatus,
            ),
          });
        }

        order.orderStatus = status;

        // إذا المطعم رفض وكان مدفوعاً → Refund تلقائي
        if (
          status === "cancelled" &&
          order.paymentDetails?.paymentIntentId &&
          order.paymentStatus === "paid"
        ) {
          try {
            await stripe.refunds.create({
              payment_intent: order.paymentDetails.paymentIntentId,
            });
            order.paymentStatus = "refunded";
          } catch (refundErr) {
            console.error("Refund failed:", refundErr.message);
          }
        }

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
            message: m.searchingDriver,
          });

          await findAndNotifyDrivers(
            io,
            order,
            restaurant.location.coordinates,
            restaurant.country,
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
          return socket.emit("order:error", { message: m.orderIdRequired });
        }

        const order = await Order.findOne({ _id: orderId, restaurantId });

        if (!order) {
          return socket.emit("order:error", { message: m.orderNotFound });
        }

        if (!["failed", "searching"].includes(order.driverSearchStatus)) {
          return socket.emit("order:error", { message: m.notSearchable });
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
          message: m.searchingDriver,
        });

        // ✅ ابدأ البحث من جديد بدون استثناءات
        cancelActiveSearch(orderId);
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
