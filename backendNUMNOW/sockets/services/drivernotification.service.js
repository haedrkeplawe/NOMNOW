// v3.7 — خدمة إشعارات السائق (نفس فلسفة notification.service.js
// تبع المستخدم بالضبط، بس لطبقة السائق). هالملف بيوضع بجانب
// notification.service.js جوا مجلد sockets/services.
const { dispatchNotification } = require("../../utils/notificationDispatcher");

/**
 * يبعت إشعار "طلب توصيل جديد" للسائق — يحل مكان الكود يلي كان
 * مكتوب مباشرة بـ admin.messaging() جوا order.service.js سابقاً.
 *
 * @param {string} driverId
 * @param {Object} order - لازم يحتوي على الأقل orderNumber, _id, totalPrice
 * @param {{name: string}} restaurant
 */
const notifyDriverNewOrderRequest = async (driverId, order, restaurant) => {
  await dispatchNotification({
    recipientType: "driver",
    recipientId: driverId,
    title: "طلب توصيل جديد 🚴",
    body: `مطعم ${restaurant.name} — السعر: ${order.totalPrice}`,
    type: "order:driverRequest",
    data: {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      timeoutSeconds: "30",
    },
  });
};

/**
 * دالة عامة لإرسال أي إشعار للسائق غير مرتبط بطلب توصيل جديد —
 * جاهزة من الآن لاستخدامات مستقبلية (حملات، تذكيرات، إشعارات إدارية)
 * بنفس منطق sendCustomUserNotification تماماً.
 *
 * @param {string} driverId
 * @param {{title: string, body: string, data?: Object, type?: string, persistKey?: string}} payload
 */
const sendCustomDriverNotification = async (
  driverId,
  { title, body, data = {}, type = "custom", persistKey },
) => {
  await dispatchNotification({
    recipientType: "driver",
    recipientId: driverId,
    title,
    body,
    data,
    type,
    persistKey,
  });
};

module.exports = { notifyDriverNewOrderRequest, sendCustomDriverNotification };
