const Order = require("../models/Order");
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
const {
  startSearchRound,
  cancelActiveSearch,
  stopActiveSearch,
} = require("./services/order.service");
// v3.5
const { notifyUserOrderStatus } = require("./services/notification.service");

// v4.4 — الأسباب المسموحة لإلغاء/رفض الطلب من طرف المطعم تحديدًا (مجموعة
// جزئية من enum الكامل المشترك بـ Order.js — الأسباب الأخرى مخصصة لإلغاء
// المستخدم عبر user_controller.js)
const RESTAURANT_CANCEL_REASON_CODES = [
  "item_unavailable",
  "kitchen_overloaded",
  "closing_soon",
  "no_driver_found",
  "invalid_order_info",
  "other",
];

module.exports = (io, restaurantNS) => {
  restaurantNS.on("connection", (socket) => {
    const restaurantId = socket.userId;
    const m = getSocketMessages(socket).socket.restaurant;

    socket.join(restaurantId.toString());
    socket.emit("connected", { ok: true });

    socket.on("order:updateStatus", async (data) => {
      try {
        const { orderId, status, reasonCode, reasonNote } = data;

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

        // v4.4 — سبب الإلغاء إجباري على المطعم دائمًا (راجع النقاش:
        // سبب الإلغاء + التمييز بين "رفض" و"إلغاء"). بيحدث هون قبل أي
        // تعديل على الطلب حتى ما نلمس شي لو التحقق فشل
        if (status === "cancelled") {
          if (!reasonCode) {
            return socket.emit("order:error", {
              message: m.cancellationReasonRequired,
            });
          }
          if (!RESTAURANT_CANCEL_REASON_CODES.includes(reasonCode)) {
            return socket.emit("order:error", {
              message: m.invalidCancellationReason,
            });
          }
          if (reasonCode === "other" && !reasonNote?.trim()) {
            return socket.emit("order:error", {
              message: m.cancellationNoteRequired,
            });
          }
        }

        // v4.4 — نسخة عن الحالة قبل الإلغاء (pending = رفض، غيرها =
        // إلغاء بعد القبول) — لازم قبل أي إعادة تعيين لـ order.orderStatus
        const previousStatus = order.orderStatus;

        order.orderStatus = status;

        // v4.1 — إصلاح ثغرة بآلية الاستعادة (نقطة 8): لو السيرفر وقع
        // بالضبط بين لحظة "المطعم قبل" ولحظة "أول جولة بحث كملت"، الطلب
        // كان رح يضل عالق (orderStatus: accepted لكن driverSearchStatus
        // لسا null — يعني sweep الاستعادة ما رح يلقطه لأنه بيدوّر بس على
        // "searching"). هلق منعلّم الطلب "searching" مع وقت انتهاء بالماضي
        // (فورًا) بنفس لحظة القبول، قبل ما نحاول حتى أول جولة — هيك لو
        // صار Crash بأي لحظة بعد هالسطر، الـ sweep رح يلقط الطلب ويكمل
        // البحث من الصفر تلقائيًا (driverSearchAttempt لسا 0)
        if (status === "accepted") {
          order.driverSearchStatus = "searching";
          order.driverSearchExpiresAt = new Date();
        }

        // إذا المطعم رفض وكان مدفوعاً → Refund تلقائي
        if (status === "cancelled") {
          // v4.4
          order.cancelledBy = "restaurant";
          order.cancelledFromStatus = previousStatus;
          order.cancellationReasonCode = reasonCode;
          order.cancellationReasonNote = reasonNote?.trim() || null;

          if (
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
        }

        await order.save();

        // v4.3 — لو كان في بحث نشط عن سائق شغال وقت الإلغاء
        // (driverSearchStatus == "searching")، نوقفه فوراً بدل ما نتركه
        // معلّقاً لحد ما ينتهي تلقائياً (لحد 30 ثانية) — راجع
        // stopActiveSearch بـ order.service.js لتفاصيل ما تعمله بالضبط
        if (status === "cancelled") {
          await stopActiveSearch(io, order._id);
        }

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

        // v3.5
        // Push notification للمستخدم — لا توقف تدفق العملية إذا فشلت
        if (["accepted", "ready", "cancelled"].includes(status)) {
          notifyUserOrderStatus(order.userId._id, status, order);
        }

        if (status === "accepted") {
          socket.emit("order:searchingDriver", {
            orderId: order._id,
            orderNumber: order.orderNumber,
            message: m.searchingDriver,
          });

          // v4.1 — startSearchRound بتاخد orderId بس وبتجيب كل شي (المطعم،
          // الموقع، رقم المحاولة) طازة من الداتابيز بنفسها — هيك ما في
          // مجال لتمرير باراميتر غلط بمكانه (كانت هاي المشكلة سابقًا)
          await startSearchRound(io, order._id);
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

        // v4.3 — حماية إضافية عند المصدر: حتى لو driverSearchStatus كانت
        // (بالخطأ أو بمسار لم نتوقعه) "searching"/"failed" على طلب لم
        // يعد "accepted" (اتلغى مثلاً)، ما نسمح بإعادة تفعيل بحث عليه
        if (order.orderStatus !== "accepted") {
          return socket.emit("order:error", { message: m.notSearchable });
        }

        if (!["failed", "searching"].includes(order.driverSearchStatus)) {
          return socket.emit("order:error", { message: m.notSearchable });
        }

        // v4.1 — "أعد البحث" يدويًا = بحث جديد بالكامل من الصفر: نصفّر
        // رقم المحاولة وقائمة السواق المستبعدين، حتى لو كانت المحاولات
        // الثلاث خلصت سابقًا (وإلا startSearchRound رح ترفض فورًا)
        cancelActiveSearch(orderId);
        await Order.findByIdAndUpdate(orderId, {
          driverSearchStatus: "searching",
          driverSearchAttempt: 0,
          notifiedDriverIds: [],
          pendingDriverIds: [],
        });

        socket.emit("order:searchingDriver", {
          orderId: order._id,
          orderNumber: order.orderNumber,
          message: m.searchingDriver,
        });

        await startSearchRound(io, orderId);
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
