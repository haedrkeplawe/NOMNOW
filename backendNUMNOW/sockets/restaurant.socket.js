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
} = require("./services/order.service");
// v3.5
const { notifyUserOrderStatus } = require("./services/notification.service");

// v4.3 — جدول الانتقالات المسموحة: الحالة الجديدة ← الحالات المسموح تجي منها.
// الإلغاء (رفض المطعم) بس من "pending" أو "accepted" وبشرط ما يكون في سائق
// (تحقق إضافي بفلتر التحديث الذرّي تحت). أي حالة مو موجودة بالجدول
// (cancelled/delivered/picked_up/on_the_way/not_confirmed) محمية تلقائياً
// لأنها ما بتظهر كـ "مصدر" لأي انتقال.
const STATUS_TRANSITIONS = {
  accepted: ["pending"],
  preparing: ["pending", "accepted", "preparing", "ready"],
  ready: ["pending", "accepted", "preparing", "ready"],
  cancelled: ["pending", "accepted"],
};

module.exports = (io, restaurantNS) => {
  restaurantNS.on("connection", (socket) => {
    const restaurantId = socket.userId;
    const m = getSocketMessages(socket).socket.restaurant;

    socket.join(restaurantId.toString());
    socket.emit("connected", { ok: true });

    // v4.3 — أخطاء order:updateStatus / order:searchDriverAgain صارت ترجع
    // orderId مع الرسالة، حتى الواجهة تعرف أي كارد فشل فيه الأمر (سابقاً
    // كانت ترجع message بس، والواجهة ما كانت تسمع الحدث أصلاً)
    socket.on("order:updateStatus", async (data) => {
      const orderId = data?.orderId;
      const emitError = (message) =>
        socket.emit("order:error", { message, orderId });

      try {
        const status = data?.status;

        if (!orderId) {
          return emitError(m.orderIdRequired);
        }

        if (!Object.keys(STATUS_TRANSITIONS).includes(status)) {
          return emitError(m.invalidStatus);
        }

        const order = await Order.findOne({
          _id: orderId,
          restaurantId,
        }).populate("userId", "name phone");

        if (!order) {
          return emitError(m.orderNotFound);
        }

        const fromStatus = order.orderStatus;

        if (
          !STATUS_TRANSITIONS[status].includes(fromStatus) ||
          (status === "cancelled" && order.driverId)
        ) {
          return emitError(
            m.cannotChangeStatus.replace("{{status}}", fromStatus),
          );
        }

        // نلتقط قبل التحديث: هل الإلغاء سببه "ما لقينا سائق"؟ ومين السواق
        // يلي لسا عندهم عرض مفتوح؟
        const cancelReason =
          order.driverSearchStatus === "failed" ? "no_driver" : "restaurant";
        const offeredDriverIds = (order.pendingDriverIds || []).map((id) =>
          id.toString(),
        );

        const update = { orderStatus: status };

        // v4.1 — إصلاح ثغرة بآلية الاستعادة (نقطة 8): لو السيرفر وقع
        // بالضبط بين لحظة "المطعم قبل" ولحظة "أول جولة بحث كملت"، الطلب
        // كان رح يضل عالق (orderStatus: accepted لكن driverSearchStatus
        // لسا null — يعني sweep الاستعادة ما رح يلقطه لأنه بيدوّر بس على
        // "searching"). هلق منعلّم الطلب "searching" مع وقت انتهاء بالماضي
        // (فورًا) بنفس لحظة القبول، قبل ما نحاول حتى أول جولة — هيك لو
        // صار Crash بأي لحظة بعد هالسطر، الـ sweep رح يلقط الطلب ويكمل
        // البحث من الصفر تلقائيًا (driverSearchAttempt لسا 0)
        if (status === "accepted") {
          update.driverSearchStatus = "searching";
          update.driverSearchExpiresAt = new Date();
        }

        // v4.3 — أ: عند الإلغاء منصفّر كل حالة البحث عن سائق، حتى ما يضل
        // الطلب الملغي بحالة failed/searching (كانت تخلّي الواجهة تعرض
        // "ابحث من جديد" على طلب ملغي)
        if (status === "cancelled") {
          update.driverSearchStatus = null;
          update.driverSearchExpiresAt = null;
          update.pendingDriverIds = [];
        }

        // v4.3 — ب: تحديث ذرّي — الشرط orderStatus: fromStatus (وdriverId:null
        // للإلغاء) بيضمن إنو لو المستخدم لغى، أو سائق قبل، أو ضغطة تانية
        // سبقتنا بنفس اللحظة، العملية بترجع null وما منكتب فوق حالة أحدث.
        // (نفس مبدأ حجز السائق بـ driver_socket.js)
        const filter = { _id: order._id, restaurantId, orderStatus: fromStatus };
        if (status === "cancelled") filter.driverId = null;

        const updated = await Order.findOneAndUpdate(
          filter,
          { $set: update },
          { new: true },
        );

        if (!updated) {
          const fresh = await Order.findById(orderId).select("orderStatus");
          return emitError(
            m.cannotChangeStatus.replace(
              "{{status}}",
              fresh?.orderStatus || fromStatus,
            ),
          );
        }

        if (status === "cancelled") {
          cancelActiveSearch(orderId);

          // إذا المطعم رفض وكان مدفوعاً → Refund تلقائي (منطق الدفع الإلكتروني
          // ما تغيّر، بس صار بعد الحجز الذري بدل قبله حتى ما يصير Refund
          // لطلب ما انلغى فعلياً)
          if (
            updated.paymentDetails?.paymentIntentId &&
            updated.paymentStatus === "paid"
          ) {
            try {
              await stripe.refunds.create({
                payment_intent: updated.paymentDetails.paymentIntentId,
              });
              await Order.updateOne(
                { _id: updated._id },
                { $set: { paymentStatus: "refunded" } },
              );
            } catch (refundErr) {
              console.error("Refund failed:", refundErr.message);
            }
          }

          // v4.3 — أ: السواق يلي وصلهم عرض وما ردّوا لسا — نبلّغهم إنو الطلب
          // ما عاد متاح (نفس الحدث الموجود أصلاً لحالة "الطلب انتهى")
          if (offeredDriverIds.length > 0) {
            const driverMsgs = getSocketMessages({
              handshake: { query: { lang: "ar" } },
            }).socket.driver;
            offeredDriverIds.forEach((driverId) => {
              io.of("/driver")
                .to(driverId)
                .emit("order:driverRequest:expired", {
                  orderId: updated._id,
                  message: driverMsgs.orderExpired,
                });
            });
          }
        }

        const populatedOrder = await Order.findById(order._id)
          .populate("userId", "name phone")
          .populate("driverId", "name phone vehicletype vehicleplate rating");

        // v4.3 — هـ: بدل socket.emit (كان يوصل لسوكيت المطعم يلي ضغط بس)،
        // منبث لغرفة المطعم كلها حتى كل الأجهزة/التابات المفتوحة تتحدّث.
        // الغرفة بينضم لها كل سوكيت بلحظة الاتصال، فالسوكيت الحالي بيوصله
        // كمان — ما في حاجة لإرسال مزدوج
        restaurantNS
          .to(restaurantId)
          .emit("order:updated", { order: populatedOrder });

        const customerId = order.userId?._id?.toString();

        if (customerId) {
          const statusPayload = {
            orderId: order._id,
            orderNumber: order.orderNumber,
            status: updated.orderStatus,
          };
          // v4.3 — د: حقل إضافي (اختياري للفلاتر) بيوضّح سبب الإلغاء
          if (status === "cancelled") statusPayload.reason = cancelReason;

          io.of("/user").to(customerId).emit("order:statusUpdated", statusPayload);

          // v3.5
          // Push notification للمستخدم — لا توقف تدفق العملية إذا فشلت
          if (["accepted", "ready", "cancelled"].includes(status)) {
            notifyUserOrderStatus(
              order.userId._id,
              status,
              populatedOrder,
              status === "cancelled" ? { reason: cancelReason } : {},
            );
          }
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
        emitError(error.message);
      }
    });

    socket.on("order:searchDriverAgain", async (data) => {
      const orderId = data?.orderId;
      const emitError = (message) =>
        socket.emit("order:error", { message, orderId });

      try {
        if (!orderId) {
          return emitError(m.orderIdRequired);
        }

        const order = await Order.findOne({ _id: orderId, restaurantId });

        if (!order) {
          return emitError(m.orderNotFound);
        }

        // v4.3 — أ: كان يفحص driverSearchStatus بس، فطلب ملغي بحالة failed
        // كان يمر ويصير "searching". هلق لازم يكون الطلب فعلاً accepted وبلا سائق
        if (
          order.orderStatus !== "accepted" ||
          order.driverId ||
          !["failed", "searching"].includes(order.driverSearchStatus)
        ) {
          return emitError(m.notSearchable);
        }

        // v4.1 — "أعد البحث" يدويًا = بحث جديد بالكامل من الصفر: نصفّر
        // رقم المحاولة وقائمة السواق المستبعدين، حتى لو كانت المحاولات
        // الثلاث خلصت سابقًا (وإلا startSearchRound رح ترفض فورًا)
        cancelActiveSearch(orderId);

        // v4.3 — نفس شروط الفحص كشرط للتحديث نفسه (ذرّي)
        const reset = await Order.findOneAndUpdate(
          {
            _id: orderId,
            restaurantId,
            orderStatus: "accepted",
            driverId: null,
            driverSearchStatus: { $in: ["failed", "searching"] },
          },
          {
            $set: {
              driverSearchStatus: "searching",
              driverSearchAttempt: 0,
              notifiedDriverIds: [],
              pendingDriverIds: [],
            },
          },
          { new: true },
        );

        if (!reset) {
          return emitError(m.notSearchable);
        }

        socket.emit("order:searchingDriver", {
          orderId: order._id,
          orderNumber: order.orderNumber,
          message: m.searchingDriver,
        });

        await startSearchRound(io, orderId);
      } catch (error) {
        console.error("order:searchDriverAgain error:", error);
        emitError(error.message);
      }
    });

    socket.on("disconnect", () => {
      console.log("Restaurant disconnected:", restaurantId);
    });
  });
};
