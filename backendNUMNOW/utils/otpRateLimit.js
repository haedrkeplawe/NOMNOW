// utils/otpRateLimit.js
// v1.0 — أداة موحّدة لمنع إرسال أكواد OTP بفارق زمني قصير جداً
// (دفاع إضافي مع authLimiter بـ server.js — هاد خاص بكل رقم/حساب على حدة)
//
// تعتمد على حقل phoneOtpExpire/emailOtpExpire الموجود أصلاً بالسكيما
// (User.js / Driver.js / restaurantUser.js) بدل إضافة حقل جديد بقاعدة البيانات.
// نفس المنطق اللي كان مستخدم جزئياً بـ restaurant_controller.js resendOtp،
// موحّد هون حتى يُستخدم بكل الأدوار الثلاث بدون تكرار.

const OTP_TTL_MS = 60 * 60 * 1000; // مدة صلاحية الـ OTP — ساعة واحدة (يطابق باقي الكود)
const OTP_COOLDOWN_MS = 60 * 1000; // أقل فاصل زمني مسموح بين إرسالين متتاليين — 60 ثانية

/**
 * هل يُسمح بإرسال/توليد OTP جديد الآن؟
 * @param {Date|number|null|undefined} otpExpireAt - قيمة *OtpExpire المخزّنة على الوثيقة
 * @returns {boolean}
 */
function canSendOtp(otpExpireAt) {
  if (!otpExpireAt) return true;
  const remainingMs = new Date(otpExpireAt).getTime() - Date.now();
  const elapsedMs = OTP_TTL_MS - remainingMs;
  return elapsedMs >= OTP_COOLDOWN_MS;
}

/**
 * كم ثانية متبقية قبل ما يُسمح بإرسال OTP جديد (للاستخدام برسائل/headers الخطأ)
 * @param {Date|number|null|undefined} otpExpireAt
 * @returns {number}
 */
function secondsUntilNextOtp(otpExpireAt) {
  if (!otpExpireAt) return 0;
  const remainingMs = new Date(otpExpireAt).getTime() - Date.now();
  const elapsedMs = OTP_TTL_MS - remainingMs;
  return Math.max(0, Math.ceil((OTP_COOLDOWN_MS - elapsedMs) / 1000));
}

module.exports = {
  OTP_TTL_MS,
  OTP_COOLDOWN_MS,
  canSendOtp,
  secondsUntilNextOtp,
};
