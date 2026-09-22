const mongoose = require("mongoose");

const restaurantUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    phone: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["owner"],
      default: "owner",
    },

    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      default: null,
    },

    refreshToken: {
      type: String,
      default: null,
    },

    // v4.8 — نافذة سماح قصيرة (10 ثواني) لإعادة استخدام الـ refresh token
    // السابق مباشرة بعد الـ rotation. تحل سباق طلبات متزامنة من نفس
    // المتصفح (مثلاً تبويبين مفتوحين، أو أكتر من طلب فشل بـ401 بنفس
    // اللحظة) بدل ما يترفضوا ويسببوا logout رغم إنو الجلسة صالحة.
    // ما إلها استخدام تاني غير هيك.
    previousRefreshToken: {
      type: String,
      default: null,
    },
    previousRefreshTokenExpiresAt: {
      type: Date,
      default: null,
    },

    // OTP للتحقق
    emailOtp: String,
    emailOtpExpire: Date,

    phoneOtp: String,
    phoneOtpExpire: Date,

    // v4.2 — إعادة تعيين كلمة المرور بنظام كود (OTP) بدل رابط الإيميل القديم.
    // حقل مستقل تماماً عن phoneOtp/emailOtp (تسجيل الدخول) عمداً — حتى ما
    // يصير كود تسجيل دخول قديم صالح لإعادة تعيين كلمة السر، ولا العكس.
    // (الحقلان القديمان resetPasswordToken/resetPasswordExpire أُزيلا نهائياً
    // مع استبدال آلية الرابط بآلية الكود)
    passwordResetOtp: String,
    passwordResetOtpExpire: Date,

    img: {
      url: { type: String, default: null },
      public_id: { type: String, default: null },
    },
  },

  { timestamps: true },
);

restaurantUserSchema.index({ restaurantId: 1 });

const RestaurantUser = mongoose.model("RestaurantUser", restaurantUserSchema);

module.exports = RestaurantUser;
