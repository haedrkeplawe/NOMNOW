// utils/otpProvider.js
// v3.0 — إرسال رمز التحقق (OTP) عبر واتساب الرسمي من خلال Wevlix.
// هاد الملف هو القناة الوحيدة للـ OTP بالمشروع (SMS والربط القديم انشالوا).
//
// الواجهة: otpProvider.send(phone, code, lang) → Promise<boolean>
//   phone: "+963XXXXXXXXX" — code: 6 أرقام (أو 4) — lang: "ar" | "en"
//   بيرجع true إذا Wevlix قبل الطلب، و false إذا فشل (ما بيرمي exception أبداً).
//
// الكود بيتولّد وبيتخزّن وبيتحقق منه عندنا بالـ backend؛ Wevlix بس بيوصّله.
//
// Env vars:
//   WEVLIX_API_KEY  — مفتاح المشروع من لوحة Wevlix (Live key). مطلوب بالإنتاج.
//   WEVLIX_API_URL  — اختياري، افتراضي https://api.wevlix.com
//
// ⚠️ لوحة Wevlix ← WhatsApp ← OTP Fallback: خلّي Telegram و SMS مطفيين.
// ⚠️ إذا WEVLIX_API_KEY مو مضبوط: بالتطوير بنطبع الكود بالـ console (مثل السابق)،
//    وبالإنتاج (NODE_ENV=production) بنرجع false وما منزيّف نجاح.

const DEFAULT_API_URL = "https://api.wevlix.com";
const REQUEST_TIMEOUT_MS = 10000;

const normalizePhone = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits ? `+${digits}` : "";
};

module.exports = {
  send: async (phone, code, lang = "en") => {
    // نقرأ الـ env وقت الاستدعاء (مو وقت تحميل الملف) حتى ما يتأثر بترتيب dotenv
    const apiKey = process.env.WEVLIX_API_KEY;
    const apiUrl = process.env.WEVLIX_API_URL || DEFAULT_API_URL;

    const to = normalizePhone(phone);
    const otp = String(code || "");

    if (!to || !otp) {
      console.error("❌ OTP Error: phone and code are required");
      return false;
    }

    // Wevlix بيقبل كود من 4 أو 6 أرقام بالضبط
    if (!/^(\d{4}|\d{6})$/.test(otp)) {
      console.error("❌ OTP Error: code must be exactly 4 or 6 digits");
      return false;
    }

    // 🧪 بدون مفتاح
    if (!apiKey) {
      if (process.env.NODE_ENV === "production") {
        console.error("❌ OTP Error: WEVLIX_API_KEY غير مضبوط بالإنتاج");
        return false;
      }
      console.log("====================================");
      console.log(
        "💬 Fake WhatsApp OTP (Dev Mode — WEVLIX_API_KEY غير مُعرَّف)",
      );
      console.log("To:", to);
      console.log("Code:", otp);
      console.log("====================================");
      return true;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(`${apiUrl}/v1/otp/send`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to,
          code: otp,
          locale: lang === "ar" ? "ar" : "en",
        }),
        signal: controller.signal,
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.success === true) {
        console.log(
          `💬 WhatsApp OTP queued — to=${to} messageId=${data?.data?.messageId} status=${data?.data?.status}`,
        );
        return true;
      }

      // مثال: INSUFFICIENT_BALANCE / WHATSAPP_DESTINATION_COUNTRY_RESTRICTED / UNAUTHORIZED
      console.error(
        `❌ WhatsApp OTP failed [${res.status}] code=${data?.error?.code} message=${data?.error?.message} requestId=${data?.meta?.requestId}`,
      );
      return false;
    } catch (err) {
      console.error("❌ WhatsApp OTP request error:", err.message);
      return false;
    } finally {
      clearTimeout(timeout);
    }
  },
};
