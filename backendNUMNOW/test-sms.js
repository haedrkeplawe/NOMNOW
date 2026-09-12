// test-sms.js — اختبار مستقل لـ utils/smsProvider.js فقط
// ⚠️ ما بيلمس أي controller ولا route ولا منطق تسجيل دخول — استدعاء مباشر بس
//
// طريقة الاستخدام:
//   1. حط هاد الملف بجانب smsProvider.js داخل مجلد utils/
//   2. تأكد إن .env فيه AMAN_GATE_API_TOKEN (وباقي مفاتيح Aman Gate إذا لزم)
//   3. شغّل من جذر المشروع:
//        node utils/test-sms.js +963912345678
//        node utils/test-sms.js +963912345678 ar   ← لتجربة القالب العربي

require("dotenv").config();
const smsProvider = require("./smsProvider");

const phone = process.argv[2];
const lang = process.argv[3] === "ar" ? "ar" : "en";

if (!phone) {
  console.error("❌ الاستخدام: node utils/test-sms.js +963912345678 [ar|en]");
  process.exit(1);
}

const testCode = Math.floor(100000 + Math.random() * 900000).toString();

(async () => {
  console.log("====================================");
  console.log("📱 رقم الاختبار:", phone);
  console.log("🌐 اللغة:", lang);
  console.log("🔢 الكود التجريبي:", testCode);
  console.log(
    "🔑 AMAN_GATE_API_TOKEN مضبوط؟",
    process.env.AMAN_GATE_API_TOKEN ? "نعم" : "لا (رح يشتغل بوضع dev/console.log فقط)",
  );
  console.log("====================================");

  const sent = await smsProvider.send(phone, testCode, lang);

  console.log("====================================");
  console.log(sent ? "✅ نجح الإرسال — تحقق من هاتفك" : "❌ فشل الإرسال — شوف رسائل الخطأ فوق");
  console.log("====================================");

  process.exit(sent ? 0 : 1);
})();
