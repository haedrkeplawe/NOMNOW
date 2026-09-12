// utils/smsProvider.js
// v2.0 — ربط فعلي مع Aman Gate (Syria SMS OTP) بدل الـ placeholder السابق
// راجع مذكرة القرار الخاصة باختيار Aman Gate كمزوّد SMS الأساسي لسوريا
//
// Env vars المطلوبة:
//   AMAN_GATE_API_TOKEN        — من قسم "المطور" بلوحة تحكم Aman Gate
//   AMAN_GATE_TEMPLATE_ID_EN   — id قالب OTP الإنجليزي (افتراضي "1" — English Default)
//   AMAN_GATE_TEMPLATE_ID_AR   — id قالب OTP العربي (افتراضي "2" — Arabic Default)
//   AMAN_GATE_BASE_URL         — اختياري، افتراضي https://aman-gate.com/api
//
// ⚠️ ملاحظة مهمة: Aman Gate يغطي حالياً الأرقام السورية (+963) فقط.
// إذا ما كان AMAN_GATE_API_TOKEN مضبوط (بيئة محلية/تطوير)، نرجع لنفس سلوك
// الـ placeholder السابق (console.log) حتى ما ننكسر بالتطوير المحلي.

const AMAN_GATE_BASE_URL =
  process.env.AMAN_GATE_BASE_URL || "https://aman-gate.com/api";
const AMAN_GATE_API_TOKEN = process.env.AMAN_GATE_API_TOKEN;
// Aman Gate بيوفر قالبين افتراضيين جاهزين ومعتمدين على كل حساب (English Default
// و Arabic Default) — مو قالب واحد بلغة قابلة للتبديل. الافتراضي هون (1/2) يطابق
// الـ id الفعلي المتحقق منه بلوحة التحكم، وقابل للتغيير عبر الـ env لو تغيّر لاحقاً.
const AMAN_GATE_TEMPLATE_ID_EN = process.env.AMAN_GATE_TEMPLATE_ID_EN || "1";
const AMAN_GATE_TEMPLATE_ID_AR = process.env.AMAN_GATE_TEMPLATE_ID_AR || "2";
const REQUEST_TIMEOUT_MS = 10000;

const toGsm = (phone) => (phone || "").replace(/\D/g, ""); // "+963912345678" → "963912345678"
const isSyrianNumber = (phone) => toGsm(phone).startsWith("963");

module.exports = {
  /**
   * إرسال رمز تحقق (OTP) عبر SMS.
   * @param {string} phone - رقم دولي كامل، مثال: "+963912345678"
   * @param {string} code  - رمز التحقق، مثال: "482910"
   * @param {"ar"|"en"} lang - لغة الرسالة (افتراضي "en")
   * @returns {Promise<boolean>} true إذا قُبل الطلب للإرسال، false غير ذلك
   */
  send: async (phone, code, lang = "en") => {
    if (!phone || !code) {
      console.error("❌ SMS Error: phone and code are required");
      return false;
    }

    // 🧪 وضع التطوير — لا يوجد Token مُعدّ بعد، لا نكسر البيئة المحلية
    if (!AMAN_GATE_API_TOKEN) {
      console.log("====================================");
      console.log("📩 Fake SMS (Dev Mode — AMAN_GATE_API_TOKEN غير مُعرَّف)");
      console.log("To:", phone);
      console.log("Code:", code);
      console.log("====================================");
      return true;
    }

    const templateId =
      lang === "ar" ? AMAN_GATE_TEMPLATE_ID_AR : AMAN_GATE_TEMPLATE_ID_EN;

    if (!templateId) {
      console.error(`❌ SMS Error: no Aman Gate template configured for lang="${lang}"`);
      return false;
    }

    if (!isSyrianNumber(phone)) {
      // Aman Gate لا يغطي حالياً غير الأرقام السورية (+963)
      console.error(`❌ SMS Error: Aman Gate لا يدعم هذا الرقم حالياً: ${phone}`);
      return false;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(`${AMAN_GATE_BASE_URL}/otp/send/`, {
        method: "POST",
        headers: {
          Authorization: `Token ${AMAN_GATE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gsm: toGsm(phone),
          template_id: Number(templateId),
          code,
          language: lang === "ar" ? 0 : 1, // Aman Gate: 0 = Arabic, 1 = English
        }),
        signal: controller.signal,
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 201) {
        console.log(
          `📩 Aman Gate: OTP sent — id=${data.id} gsm=${toGsm(phone)}`,
        );
        return true;
      }

      // 400 (validation) / 401 (invalid token) / 402 (no subscription/quota)
      // / 403 (IP not whitelisted) — كلها بترجع false، الـ caller بيقرر شو يعرض
      console.error(`❌ Aman Gate Error [${res.status}]:`, data);
      return false;
    } catch (err) {
      console.error("❌ Aman Gate Request Failed:", err.message);
      return false;
    } finally {
      clearTimeout(timeout);
    }
  },
};
