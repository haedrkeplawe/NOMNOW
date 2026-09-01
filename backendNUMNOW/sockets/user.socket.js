// v3.0
// ─────────────────────────────────────────────────────────────
// تم إلغاء حالة "delivered_by_driver" من دورة حياة الأوردر بالكامل
// (نفس التعديل الموجود بملف driver.socket.js).
// نتيجة لهذا: تم حذف order:confirmDelivery بالكامل من هذا الملف،
// لأنه كان مسؤول فقط عن تأكيد المستخدم لاستلام الأوردر بعد ما
// السائق يعلمه بالوصول (delivered_by_driver) — وهذي الخطوة ما
// عادت موجودة. السائق هلق ينقل الأوردر لـ "delivered" مباشرة من
// طرفه (عبر order:delivered بملف driver.socket.js) بدون أي دور
// للمستخدم بعملية التأكيد.
// كذلك تم حذف استيراد Driver من أعلى الملف لأنه صار غير مستخدم
// (كان مستخدم فقط جوا order:confirmDelivery المحذوف).
// ─────────────────────────────────────────────────────────────

const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Promotion = require("../models/Promotion");
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

        // ── إعادة التحقق من عروض السلة قبل الإرسال ──────────
        const cart = await Cart.findOne({ userId });
        if (cart) {
          const now = new Date();
          const promotionChanges = [];

          // التحقق من عروض الخصم على كل عنصر
          for (const item of cart.items) {
            if (!item.promotionId) continue;
            const promo = await Promotion.findOne({
              _id: item.promotionId,
              isActive: true,
              startDate: { $lte: now },
              endDate: { $gte: now },
            });
            if (!promo) {
              promotionChanges.push({ foodName: item.name, type: "discount" });
            }
          }

          // التحقق من عرض التوصيل المجاني
          if (cart.hasFreeDelivery && cart.freeDeliveryPromotionId) {
            const freePromo = await Promotion.findOne({
              _id: cart.freeDeliveryPromotionId,
              isActive: true,
              startDate: { $lte: now },
              endDate: { $gte: now },
            });
            if (!freePromo) {
              promotionChanges.push({ type: "free_delivery" });
            }
          }

          // update v2.2 — التحقق من صلاحية العروض قبل إرسال الأوردر
          // Flutter: استمع لـ "order:promotionExpired"
          // Flutter response: أعد فتح السلة وأبلغ المستخدم بانتهاء العرض
          if (promotionChanges.length > 0) {
            order.orderStatus = "not_confirmed";
            await order.save();
            return socket.emit("order:promotionExpired", {
              message:
                "Some promotions have expired. Please review your cart and try again.",
              changes: promotionChanges,
            });
          }
        }

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

    // v3.0 — تم حذف order:confirmDelivery بالكامل من هنا.
    // كان هذا الـ handler يستقبل تأكيد المستخدم لاستلام الطلب بعد ما
    // السائق يحطه بحالة "delivered_by_driver"، ويحدّث orderStatus,
    // paymentStatus, settlementStatus, driverPaymentStatus, ويحصّل
    // كاش السائق السوري، ويرجع السائق "online".
    // كل هذا المنطق نقل الآن بالكامل إلى order:delivered
    // بملف driver.socket.js، ويصير مباشرة لحظة ما السائق يعلن
    // التسليم — بدون انتظار أي فعل من المستخدم.

    socket.on("disconnect", () => {
      console.log("User disconnected:", userId);
    });
  });
};
