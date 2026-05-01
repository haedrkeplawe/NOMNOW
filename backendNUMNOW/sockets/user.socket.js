const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Driver = require("../models/Driver");
const { getSocketMessages } = require("../utils/messages");

const Stripe = require("stripe");
const { HttpsProxyAgent } = require("https-proxy-agent");
const stripeAgent = process.env.HTTP_PROXY
  ? new HttpsProxyAgent(process.env.HTTP_PROXY)
  : undefined;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  httpAgent: stripeAgent,
});

module.exports = (io, userNS) => {
  userNS.on("connection", (socket) => {
    const userId = socket.userId;
    const m = getSocketMessages(socket).socket.user;

    socket.join(userId.toString());
    socket.emit("connected", { ok: true });

    // update DE { orderId, paymentIntentId } → المستخدم الالماني يجب ان يرسل paymentIntentId مع الطلب، نتحقق منه قبل إرسال الأوردر للمطعم
    socket.on("order:send", async (data) => {
      try {
        const { orderId, paymentIntentId } = data;

        if (!orderId) {
          return socket.emit("order:error", { message: m.orderIdRequired });
        }

        const order = await Order.findOne({ _id: orderId, userId })
          .populate("restaurantId", "name status country")
          .populate("userId", "name phone country");

        if (!order) {
          return socket.emit("order:error", { message: m.orderNotFound });
        }

        if (order.orderStatus !== "not_confirmed") {
          return socket.emit("order:error", {
            message: m.alreadySentOrCancelled,
          });
        }

        if (order.restaurantId.status !== "open") {
          return socket.emit("order:error", { message: m.restaurantClosed });
        }

        // المستخدم الألماني → تحقق من الدفع قبل الإرسال
        if (order.restaurantId.country === "DE") {
          if (!paymentIntentId) {
            return socket.emit("order:error", { message: m.paymentRequired });
          }
          const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
          if (intent.status !== "succeeded") {
            return socket.emit("order:error", {
              message: m.paymentNotCompleted,
            });
          }
          // حفظ paymentIntentId وتحديث طريقة الدفع الفعلية
          order.paymentDetails = { paymentIntentId };
          order.paymentStatus = "paid";
          // تحديث طريقة الدفع من Stripe
          const paymentMethodType = intent.payment_method_types?.[0] || "card";
          order.paymentMethod = paymentMethodType;
        }

        order.orderStatus = "pending";
        await order.save();

        await Cart.findOneAndDelete({ userId });

        io.of("/restaurant")
          .to(order.restaurantId._id.toString())
          .emit("order:new", { order });

        socket.emit("order:sent", {
          success: true,
          message: m.orderSent,
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
          return socket.emit("order:error", { message: m.orderIdRequired });
        }

        const order = await Order.findOneAndUpdate(
          { _id: orderId, userId, orderStatus: "delivered_by_driver" },
          {
            orderStatus: "delivered",
            paymentStatus: "paid",
            settlementStatus: "pending_settlement",
          },
          { new: true },
        )
          .populate("restaurantId", "name")
          .populate("driverId", "name country");

        if (!order) {
          return socket.emit("order:error", {
            message: m.alreadyConfirmed,
          });
        }

        if (order.driverId?.country === "SY") {
          order.driverPaymentStatus = "pending";
          await Driver.findByIdAndUpdate(order.driverId._id, {
            $inc: { cashCollected: order.totalPrice },
            availability: "online",
          });
        } else {
          // DE
          // السائق الألماني لا يجمع كاش — يستحق deliveryFee فقط
          // أجرته تُحسب من الأوردرات مباشرة (deliveryFee لكل أوردر pending)
          // driverPaymentStatus يصبح "pending" ويبقى كذلك حتى يسوّي الأدمن يدوياً
          // الفرونت (تطبيق السائق): استمع لـ order:statusUpdated { status: "delivered" }
          //   واعرض رسالة "تم التسليم — في انتظار التسوية"
          order.driverPaymentStatus = "pending";
          await Driver.findByIdAndUpdate(order.driverId._id, {
            availability: "online",
          });
        }

        await order.save();

        socket.emit("order:statusUpdated", {
          orderId: order._id,
          orderNumber: order.orderNumber,
          status: "delivered",
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
