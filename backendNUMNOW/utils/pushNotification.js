// v3.5
const admin = require("../config/firebase");

/**
 * دالة عامة منخفضة المستوى لإرسال إشعارات FCM.
 * لا تعرف أي شيء عن "الطلبات" أو منطق العمل — مسؤوليتها الوحيدة
 * هي الإرسال + التعرف على التوكنات الغير صالحة، عشان تكون قابلة
 * لإعادة الاستخدام لأي نوع إشعار مستقبلي (تحديث طلب، حملة تسويقية،
 * إشعار إداري...).
 *
 * @param {string[]} tokens - قائمة FCM tokens المستهدفة (تُفلتر تلقائياً من القيم الفارغة)
 * @param {{title: string, body: string, data?: Object}} payload
 * @returns {Promise<{invalidTokens: string[], successCount: number, failureCount: number} | null>}
 *          null إذا ما كان في تكونات صالحة أو صار خطأ غير متوقع بالإرسال
 */
const sendPushNotification = async (tokens, { title, body, data = {} }) => {
  const cleanTokens = (tokens || []).filter(Boolean);
  if (cleanTokens.length === 0) return null;

  // FCM بيتطلب إن كل قيم data تكون string
  const stringData = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, String(value)]),
  );

  try {
    const response = await admin.messaging().sendEachForMulticast({
      tokens: cleanTokens,
      notification: { title, body },
      data: stringData,
      android: { priority: "high" },
      apns: { payload: { aps: { sound: "default" } } },
    });

    const invalidTokens = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const errorCode = resp.error?.code;
        const isInvalidToken =
          errorCode === "messaging/invalid-registration-token" ||
          errorCode === "messaging/registration-token-not-registered" ||
          errorCode === "messaging/invalid-argument";

        if (isInvalidToken) {
          invalidTokens.push(cleanTokens[idx]);
        } else {
          console.error(`FCM error for token[${idx}]:`, resp.error);
        }
      }
    });

    return {
      invalidTokens,
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (err) {
    console.error("FCM send error:", err);
    return null;
  }
};

module.exports = { sendPushNotification };
