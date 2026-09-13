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
    return {
      title: "تم إلغاء طلبك ❌",
      body: refunded
        ? `نأسف، ألغى المطعم طلبك رقم ${order.orderNumber} وتم استرجاع المبلغ المدفوع`
        : `نأسف، ألغى المطعم طلبك رقم ${order.orderNumber}`,
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
