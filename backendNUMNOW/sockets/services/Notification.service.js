// v3.5
const User = require("../../models/User");
const { sendPushNotification } = require("../../utils/pushNotification");

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
 * مصممة إنها ما ترمي أي error للخارج أبداً — فشل الإشعار ما لازم
 * يوقف تدفق العملية الأساسية (حفظ الطلب / إرسال socket event)،
 * بنفس فلسفة معالجة الأخطاء المستخدمة بإشعارات السائق.
 *
 * @param {string} userId
 * @param {"accepted"|"ready"|"picked_up"|"on_the_way"|"delivered"} statusKey
 * @param {Object} order - لازم يحتوي على الأقل orderNumber و _id
 */
const notifyUserOrderStatus = async (userId, statusKey, order) => {
  try {
    const template = ORDER_STATUS_TEMPLATES[statusKey];
    if (!template || !userId) return;

    const user = await User.findById(userId).select("fcmToken");
    if (!user?.fcmToken) return;

    const { title, body } = template(order);

    const result = await sendPushNotification([user.fcmToken], {
      title,
      body,
      data: {
        type: "order:statusUpdated",
        status: statusKey,
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
      },
    });

    if (result?.invalidTokens?.length > 0) {
      await User.findByIdAndUpdate(userId, { fcmToken: null });
    }
  } catch (err) {
    console.error(`notifyUserOrderStatus error [${statusKey}]:`, err);
  }
};

/**
 * دالة عامة لإرسال أي إشعار للمستخدم غير مرتبط بحالة طلب —
 * جاهزة من الآن لاستخدامات مستقبلية (حملات تسويقية، إشعارات إدارية،
 * تذكيرات...) بدون الحاجة لبناء أي طبقة جديدة لاحقاً.
 *
 * الفرق عن notifyUserOrderStatus: بتاخذ title/body/data جاهزين
 * من المستدعي بدل ما تبنيهم من قالب حالة طلب.
 *
 * @param {string} userId
 * @param {{title: string, body: string, data?: Object}} payload
 */
const sendCustomUserNotification = async (
  userId,
  { title, body, data = {} },
) => {
  try {
    if (!userId) return;

    const user = await User.findById(userId).select("fcmToken");
    if (!user?.fcmToken) return;

    const result = await sendPushNotification([user.fcmToken], {
      title,
      body,
      data,
    });

    if (result?.invalidTokens?.length > 0) {
      await User.findByIdAndUpdate(userId, { fcmToken: null });
    }
  } catch (err) {
    console.error("sendCustomUserNotification error:", err);
  }
};

module.exports = { notifyUserOrderStatus, sendCustomUserNotification };
