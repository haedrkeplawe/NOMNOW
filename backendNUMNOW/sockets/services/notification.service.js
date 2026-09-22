// v3.7 — خدمة إشعارات المستخدم (Order status)
// ⚠️ ملاحظة تسمية: هذا الملف لازم يكون اسمه بالضبط
// "notification.service.js" (بحرف صغير، ونقطة مش underscore) جوا
// مجلد sockets/services — لأنو restaurant.socket.js وdriver.socket.js
// بيعملوا require("./services/notification.service") بالضبط.
// إذا كان الملف عندك قبل هيك بمسمى مختلف (متل Notification_service.js)
// لازم تحذفه وتحط هاد بدالو بنفس المكان، مش تضيفه كملف زيادة —
// وهاد نفسه سبب مشكلة "Cannot find module" يلي واجهتنا سابقاً على Render
// بسبب حساسية حالة الأحرف بلينكس.
const { dispatchNotification } = require("../../utils/notificationDispatcher");

/**
 * قوالب إشعارات تحديث حالة الطلب للمستخدم — مركزية بمكان واحد
 * بدل ما تكون النصوص متبعثرة جوا socket handlers مختلفة.
 * كل قالب دالة تاخذ الأوردر وترجع {title, body}.
 *
 * ملاحظة للتوسع المستقبلي: أي حالة جديدة تُضاف هون فقط،
 * وبتشتغل تلقائياً بمجرد استدعاء notifyUserOrderStatus بمفتاحها.
 */
// v4.4 — تسميات عربية لأسباب الإلغاء (نفس enum الموجود بـ Order.js).
// هاد الملف بيولّد نصوص عربية بس حاليًا (كل القوالب تحت مكتوبة عربي
// مباشرة بدون طبقة ترجمة)، فالتزمنا بنفس الأسلوب. "other" مستثناة
// عمداً — بحالتها منعرض cancellationReasonNote (النص الحر) بدل تسمية ثابتة
const CANCELLATION_REASON_LABELS_AR = {
  item_unavailable: "صنف غير متوفر",
  kitchen_overloaded: "ضغط بالمطبخ",
  closing_soon: "قرب موعد الإغلاق",
  no_driver_found: "تعذر إيجاد سائق توصيل",
  invalid_order_info: "بيانات الطلب غير صحيحة",
};

const ORDER_STATUS_TEMPLATES = {
  accepted: (order) => ({
    title: "تم قبول طلبك ✅",
    body: `المطعم بدأ بتجهيز طلبك رقم ${order.orderNumber}`,
  }),
  ready: (order) => ({
    title: "طلبك جاهز 🍽️",
    body: `طلبك رقم ${order.orderNumber} جاهز وبانتظار السائق`,
  }),
  picked_up: (order) => ({
    title: "السائق استلم طلبك 🛵",
    body: `السائق استلم طلبك رقم ${order.orderNumber} من المطعم`,
  }),
  on_the_way: (order) => ({
    title: "طلبك في الطريق 🚗",
    body: `السائق في طريقه إليك بطلبك رقم ${order.orderNumber}`,
  }),
  delivered: (order) => ({
    title: "تم توصيل طلبك 🎉",
    body: `تم تسليم طلبك رقم ${order.orderNumber} بنجاح، بالهنا والشفا`,
  }),
  cancelled: (order) => {
    const refunded = order.paymentStatus === "refunded";

    // v4.6.2 — إصلاح: هالتمبلت صار ينعمل استدعاؤه كمان لما الأدمن يلغي
    // (راجع النقاش: صلاحية الأدمن بالتدخل المباشر)، والنص القديم كان
    // مكتوب حرفيًا "ألغى المطعم طلبك" بغض النظر مين فعليًا ألغى — غلط
    // وقد يكون ظالم للمطعم. وبما إنو أسباب الأدمن حساسة وداخلية (نزاع،
    // اشتباه احتيال...)، ما منكشفها حرفيًا للزبون — رسالة عامة بس.
    if (order.cancelledBy === "admin") {
      return {
        title: "تم إلغاء طلبك ❌",
        body: refunded
          ? `تم إلغاء طلبك رقم ${order.orderNumber} من قبل فريق الدعم، وتم استرجاع المبلغ المدفوع. لأي استفسار تواصل معنا.`
          : `تم إلغاء طلبك رقم ${order.orderNumber} من قبل فريق الدعم. لأي استفسار تواصل معنا.`,
      };
    }

    // إلغاء من طرف المطعم (المسار الوحيد الآخر اللي بيوصل هالتمبلت فعليًا
    // — إلغاء المستخدم نفسه ما بيستدعي هالدالة إطلاقًا، بداهةً)
    let reasonText = null;
    if (order.cancellationReasonCode === "other") {
      reasonText = order.cancellationReasonNote || null;
    } else if (order.cancellationReasonCode) {
      reasonText =
        CANCELLATION_REASON_LABELS_AR[order.cancellationReasonCode] || null;
    }
    const reasonSuffix = reasonText ? ` — السبب: ${reasonText}` : "";

    return {
      title: "تم إلغاء طلبك ❌",
      body: refunded
        ? `نأسف، ألغى المطعم طلبك رقم ${order.orderNumber}${reasonSuffix} وتم استرجاع المبلغ المدفوع`
        : `نأسف، ألغى المطعم طلبك رقم ${order.orderNumber}${reasonSuffix}`,
    };
  },
};

/**
 * يبعت Push Notification للمستخدم بخصوص تحديث حالة الطلب.
 *
 * @param {string} userId
 * @param {"accepted"|"ready"|"picked_up"|"on_the_way"|"delivered"|"cancelled"} statusKey
 * @param {Object} order - لازم يحتوي على الأقل orderNumber و _id
 */
const notifyUserOrderStatus = async (userId, statusKey, order) => {
  const template = ORDER_STATUS_TEMPLATES[statusKey];
  if (!template || !userId) return;

  const { title, body } = template(order);

  await dispatchNotification({
    recipientType: "user",
    recipientId: userId,
    title,
    body,
    type: "order:statusUpdated",
    // مفتاح دقيق لكل حالة على حدة (مثلاً "order:statusUpdated:delivered")
    // حتى تقدر تفعّل تخزين حالة معيّنة بس من notificationDispatcher.js
    // بدون ما تخزّن باقي الحالات
    persistKey: `order:statusUpdated:${statusKey}`,
    data: {
      status: statusKey,
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
    },
  });
};

/**
 * دالة عامة لإرسال أي إشعار للمستخدم غير مرتبط بحالة طلب —
 * جاهزة من الآن لاستخدامات مستقبلية (حملات تسويقية، إشعارات إدارية،
 * تذكيرات...) بدون الحاجة لبناء أي طبقة جديدة لاحقاً.
 *
 * @param {string} userId
 * @param {{title: string, body: string, data?: Object, type?: string, persistKey?: string}} payload
 */
const sendCustomUserNotification = async (
  userId,
  { title, body, data = {}, type = "custom", persistKey },
) => {
  await dispatchNotification({
    recipientType: "user",
    recipientId: userId,
    title,
    body,
    data,
    type,
    persistKey,
  });
};

module.exports = { notifyUserOrderStatus, sendCustomUserNotification };
