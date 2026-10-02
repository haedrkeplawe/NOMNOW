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

const mongoose = require("mongoose");
const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Promotion = require("../models/Promotion");
// v4.11 — حجز استخدام الكوبون لحظة التأكيد الفعلي (بدل لحظة إنشاء الطلب)
const { claimCouponUse } = require("../utils/couponUsage");
const { getSocketMessages } = require("../utils/messages");
// v4.10 — تقدير وقت وصول الطلب (المرحلة 1/3 — راجع utils/eta.js). محسوب
// هون بالضبط (order:send)، مو بـcreateOrder، لأنو هاي اللحظة الحقيقية
// يلي الطلب فيها بيتأكد وينبعت فعلياً للمطعم (راجع الشرح تحت عند
// orderStatus = "pending")
const { estimateAtCreation } = require("../utils/eta");
const PlatformSettings = require("../models/platformSettings");

const Stripe = require("stripe");
const { HttpsProxyAgent } = require("https-proxy-agent");
const stripeAgent = process.env.HTTP_PROXY
  ? new HttpsProxyAgent(process.env.HTTP_PROXY)
  : undefined;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  httpAgent: stripeAgent,
});

// v4.11 — خطأ داخلي بس، بيُرمى جوا معاملة order:send لإلغائها (abort)
// عند رفض متوقع (طلب انبعت قبل / كوبون وصل حده) وبيُلتقط برّا المعاملة
class SendRejected extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

module.exports = (io, userNS) => {
  userNS.on("connection", (socket) => {
    const userId = socket.userId;
    const m = getSocketMessages(socket).socket.user;

    socket.join(userId.toString());
    socket.emit("connected", { ok: true });

    // v4.11 — order:send صار ذرّي ومعه إقرار (ack)
    //
    // ملخص التغييرات (راجع BACKEND_REPLY_TO_FLUTTER.md للتفاصيل):
    //  1) الانتقال not_confirmed → pending صار عملية ذرّية واحدة
    //     (findOneAndUpdate بشرط الحالة) بدل "اقرأ ← افحص ← await كثيرة ←
    //     احفظ". حدثان متزامنان لنفس الطلب: واحد بس بينجح، التاني بيرجع
    //     ALREADY_SENT_OR_CANCELLED، وما بينبعت order:new للمطعم مرتين.
    //  2) عدّاد استخدام الكوبون (usedCount) بينزاد هون، جوا نفس المعاملة
    //     مع حجز الطلب، وبشرط ما يتخطى maxTotalUses تحت التزامن. كان قبل
    //     بيزيد بـ createOrder (طلب لسا ما انتأكد) فيحرق استخدامات لطلبات
    //     ما انبعتت أبداً. لو الحجز فشل، المعاملة كلها بتتراجع.
    //  3) إقرار Socket.IO: لو العميل مرّر callback (ack) بيرجعله الرد
    //     بنفس النداء، ولو ما مرّر (نسخ التطبيق القديمة) بنبعت الأحداث
    //     المعتادة (order:sent / order:error / order:cartChanged /
    //     order:promotionExpired) بنفس الأسماء والشكل كما كانت. كل رد
    //     (حدث أو ack) بيحمل "code" ثابت للأخطاء (إضافي بس).
    //
    // update DE { orderId, paymentIntentId } → المستخدم الالماني يجب ان يرسل paymentIntentId مع الطلب، نتحقق منه قبل إرسال الأوردر للمطعم
    socket.on("order:send", async (data, ack) => {
      // نقطة رد وحيدة: ack إذا موجود، وإلا الحدث القديم بالاسم نفسه.
      // ملاحظة: لو ack موجود ما منبعت الحدث بنفس الوقت (حتى ما يوصل
      // العميل الجديد الرد مرتين) — العميل يلي بيمرر ack بيستعمله وبس.
      const reply = (event, payload = {}) => {
        if (typeof ack === "function") {
          ack({ ok: event === "order:sent", event, ...payload });
        } else {
          socket.emit(event, payload);
        }
      };

      try {
        const { orderId, paymentIntentId } = data || {};

        if (!orderId) {
          return reply("order:error", {
            code: "ORDER_ID_REQUIRED",
            message: m.orderIdRequired,
          });
        }

        // orderId غير صالح كـ ObjectId كان يوقع CastError ويرجع رسالة
        // تقنية غامضة — هلق نرجّع نفس رد "غير موجود" الطبيعي
        if (!mongoose.isValidObjectId(orderId)) {
          return reply("order:error", {
            code: "ORDER_NOT_FOUND",
            message: m.orderNotFound,
          });
        }

        const order = await Order.findOne({ _id: orderId, userId })
          .populate("restaurantId", "name status country")
          .populate("userId", "name phone country");

        if (!order) {
          return reply("order:error", {
            code: "ORDER_NOT_FOUND",
            message: m.orderNotFound,
          });
        }

        // فحص سريع (fast-fail) — الحماية الفعلية من التزامن هي الحجز
        // الذرّي تحت. orderStatus بيرجع بالرد حتى يعرف العميل إذا الطلب
        // انبعت فعلاً (مثلاً بعد إعادة اتصال ضاع فيها الرد الأول)
        if (order.orderStatus !== "not_confirmed") {
          return reply("order:error", {
            code: "ALREADY_SENT_OR_CANCELLED",
            orderStatus: order.orderStatus,
            message: m.alreadySentOrCancelled,
          });
        }

        if (order.restaurantId.status !== "open") {
          return reply("order:error", {
            code: "RESTAURANT_CLOSED",
            message: m.restaurantClosed,
          });
        }

        // ── v2.0 — ب3: فحص السلة والعروض *قبل* أي تعامل مع Stripe ──
        // لازم نتأكد إنو الطلب رح يمر فعلاً قبل ما نحجز مبلغ عالبطاقة.
        // بالترتيب القديم كان الدفع يُحتجز أولاً (paymentStatus="paid")
        // وبعدين لو تبيّن إنو السلة تغيّرت أو عرض انتهى، الطلب يرجع
        // not_confirmed بلا أي استرداد أو مسار عودة — نفس البند 7
        // بتقرير_التدقيق_الأمني. هلأ ما بنلمس Stripe إطلاقاً إلا بعد ما
        // نتأكد إنو ولا سبب رح يرجّع الطلب.
        const cart = await Cart.findOne({ userId });
        if (cart) {
          // تحصين 6: لو السلة تغيّرت من وقت إنشاء الطلب (مثلاً صنف
          // انضاف بنافذة دفع Stripe يلي ممكن تمتد دقايق بمسار DE) ما
          // نحذفها بصمت — نخلي المستخدم يراجع سلته. الطلب أصلاً لسا
          // not_confirmed (ما لمسناه بعد) فما في داعي لإعادة حفظه.
          if (
            order.cartSnapshotAt &&
            cart.updatedAt.getTime() !== order.cartSnapshotAt.getTime()
          ) {
            return reply("order:cartChanged", {
              code: "CART_CHANGED",
              message: m.cartChangedSinceOrder,
            });
          }

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
            return reply("order:promotionExpired", {
              code: "PROMOTION_EXPIRED",
              // v4.11 — صار مترجماً عبر getSocketMessages (كان نصاً إنجليزياً ثابتاً)
              message: m.promotionExpired,
              changes: promotionChanges,
            });
          }
        }

        // المستخدم الألماني → تحقق من الدفع، فقط بعد ما تأكّدنا إنو
        // الطلب رح يمر (السلة سليمة والعروض سليمة)
        // v4.11 — مسار ألمانيا بقي منطقه كما هو حرفياً؛ بس بدل ما نعدّل
        // order ونحفظه، نجمع الحقول بـ paymentFields وتنكتب بنفس الحجز
        // الذرّي تحت (خارج نطاق العمل الحالي — سوريا فقط)
        let paymentFields = null;
        if (order.restaurantId.country === "DE") {
          if (!paymentIntentId) {
            return reply("order:error", {
              code: "PAYMENT_REQUIRED",
              message: m.paymentRequired,
            });
          }
          const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
          if (intent.status !== "succeeded") {
            return reply("order:error", {
              code: "PAYMENT_NOT_COMPLETED",
              message: m.paymentNotCompleted,
            });
          }
          // حفظ paymentIntentId وتحديث طريقة الدفع الفعلية من Stripe
          paymentFields = {
            paymentDetails: { paymentIntentId },
            paymentStatus: "paid",
            paymentMethod: intent.payment_method_types?.[0] || "card",
          };
        }

        // v4.10 — التأكيد الفعلي: هاد الطلب هلق بيتحوّل "pending" وينبعت
        // فعلياً للمطعم (order:new تحت) — هاي أول لحظة صحيحة لحساب "متى
        // بيوصل الطلب" (المرحلة 1/3). items وdeliveryDistanceKm أصلاً
        // محسوبين ومخزّنين على الطلب من وقت createOrder (ثابتين، ما
        // بيتأثروا بوقت التأكيد)، بس "الوقت من الآن" لازم يُحسب هون
        // بالضبط مو أبكر.
        const etaSettings = await PlatformSettings.getSingleton();
        const estimatedDeliveryAt = estimateAtCreation({
          items: order.items,
          deliveryDistanceKm: order.deliveryDistanceKm,
          avgSpeedKmh: etaSettings.avgDriverSpeedKmh,
          bufferMinutes: etaSettings.etaCoordinationBufferMinutes,
        });

        // ── v4.11 — الحجز الذرّي (الطلب + الكوبون بمعاملة وحدة) ──
        // الشرط { orderStatus: "not_confirmed" } جوا الـ filter هو نفسه
        // الفحص: لو حدث تاني سبقنا، claimed بيرجع null. المعاملة بتعيد
        // المحاولة تلقائياً عند WriteConflict (حالة التزامن) فالمحاولة
        // التانية بتشوف الطلب pending وبترفض بنظافة.
        let claimed = null;
        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            claimed = null; // المعاملة ممكن تتكرر — صفّر الحالة بكل محاولة

            claimed = await Order.findOneAndUpdate(
              { _id: order._id, userId, orderStatus: "not_confirmed" },
              {
                $set: {
                  orderStatus: "pending",
                  estimatedDeliveryAt,
                  ...(paymentFields ?? {}),
                },
              },
              { new: true, session, runValidators: true },
            );
            if (!claimed) throw new SendRejected("ALREADY_SENT_OR_CANCELLED");

            // استخدام الكوبون بيتحسب هون بس (لحظة ما الطلب بيصير فعلي)
            if (claimed.couponCode) {
              const result = await claimCouponUse(claimed.couponCode, session);
              if (!result.ok) throw new SendRejected("COUPON_LIMIT_REACHED");
              // علامة داخلية بتخلّي إعادة الاستخدام عند الإلغاء idempotent
              // (راجع utils/couponUsage.js → releaseCouponUse)
              if (result.counted) {
                await Order.updateOne(
                  { _id: claimed._id },
                  { $set: { couponCounted: true } },
                  { session },
                );
              }
            }
          });
        } catch (txError) {
          if (txError instanceof SendRejected) {
            if (txError.code === "COUPON_LIMIT_REACHED") {
              return reply("order:error", {
                code: "COUPON_LIMIT_REACHED",
                message: m.couponLimitReached,
              });
            }
            // حدث تاني سبقنا (إرسال مزدوج / إلغاء بنفس اللحظة) — منجيب
            // الحالة الحالية حتى يعرف العميل شو صار فعلاً
            const current = await Order.findOne({ _id: order._id, userId })
              .select("orderStatus")
              .lean();
            return reply("order:error", {
              code: "ALREADY_SENT_OR_CANCELLED",
              orderStatus: current?.orderStatus,
              message: m.alreadySentOrCancelled,
            });
          }
          throw txError;
        } finally {
          session.endSession();
        }

        // نفس شكل الكائن يلي كان يتبعت بـ order:new (restaurantId وuserId
        // محمّلين بنفس الحقول) — بس هلق مبني من نتيجة الحجز الذرّي
        await Order.populate(claimed, [
          { path: "restaurantId", select: "name status country" },
          { path: "userId", select: "name phone country" },
        ]);

        // ما بعد الـ commit: الطلب صار فعلياً pending بالداتابيز، فأي فشل
        // هون ما لازم يرجع "order:error" للزبون (كان ممكن يظن إنو الطلب
        // ما انبعت وهو انبعت). منسجّل ونكمل.
        try {
          await Cart.findOneAndDelete({ userId });
        } catch (cartErr) {
          console.error("order:send — cart cleanup failed:", cartErr);
        }

        try {
          io.of("/restaurant")
            .to(claimed.restaurantId._id.toString())
            .emit("order:new", { order: claimed });
        } catch (emitErr) {
          console.error("order:send — order:new emit failed:", emitErr);
        }

        reply("order:sent", {
          success: true,
          message: m.orderSent,
          orderId: claimed._id,
          // v4.10 — أول تقدير حقيقي يوصل للزبون — لحظة التأكيد بالضبط
          estimatedDeliveryAt: claimed.estimatedDeliveryAt,
        });
        console.log(`✅ Order ${claimed.orderNumber} sent to restaurant`);
      } catch (error) {
        console.error("order:send error:", error);
        reply("order:error", { code: "SERVER_ERROR", message: error.message });
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
