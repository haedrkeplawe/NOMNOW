const mongoose = require("mongoose");

// v4.9 — إعدادات عامة على مستوى المنصة (مو خاصة بمطعم/سائق/مستخدم واحد).
// أول استخدام: سعر أجرة التوصيل لكل كيلومتر بسوريا (قابل للتعديل من لوحة
// الأدمن — قسم السائقين). وثيقة واحدة بس بكل قاعدة البيانات (نمط singleton).
const platformSettingsSchema = new mongoose.Schema(
  {
    // v4.9 — أجرة التوصيل (سوريا فقط) = المسافة بالكيلومتر × هالسعر،
    // بدون أجرة أساس وبدون حد أدنى/أقصى (قرار عمل صريح: الصيغة البسيطة
    // كافية بالمرحلة الحالية). ألمانيا خارج هالحقل بالكامل — تبقى أجرتها
    // الثابتة القديمة (راجع calculateDeliveryFee بـ user.controller.js).
    deliveryPricePerKmSY: {
      type: Number,
      default: 50,
      min: 0,
    },

    // v4.10 — إعدادات تقدير وقت الوصول (estimatedDeliveryAt). قابلة
    // للتعديل من لوحة الأدمن لاحقاً بنفس أسلوب سعر الكيلومتر فوق.
    // avgDriverSpeedKmh: متوسط سرعة السائق المفترض لتحويل المسافة لوقت
    // (نفس الاستخدام بالرحلتين: سائق→مطعم، ومطعم→زبون)
    avgDriverSpeedKmh: {
      type: Number,
      default: 25,
      min: 1,
    },
    // etaCoordinationBufferMinutes: زمن ثابت يغطي قبول المطعم + بحث/تعيين
    // سائق، يُستخدم بس بالتقدير الأولي وقت تأكيد الطلب (قبل ما يكون في
    // سائق فعلي معروف) — راجع estimateAtCreation بـ utils/eta.js
    etaCoordinationBufferMinutes: {
      type: Number,
      default: 10,
      min: 0,
    },
  },
  { timestamps: true },
);

// v4.9 — نمط singleton: نجيب الوثيقة الوحيدة، ولو مش موجودة (أول تشغيل)
// منعملها بالقيم الافتراضية. هيك أي كود بحاجة الإعدادات بس بينادي
// PlatformSettings.getSingleton() بدون ما يهتم بحالة "أول مرة".
platformSettingsSchema.statics.getSingleton = async function (session = null) {
  let query = this.findOne();
  if (session) query = query.session(session);
  let settings = await query;

  if (!settings) {
    settings = new this({});
    await settings.save({ session });
  }

  return settings;
};

module.exports = mongoose.model("PlatformSettings", platformSettingsSchema);
