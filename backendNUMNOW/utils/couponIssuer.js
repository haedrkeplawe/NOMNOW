// v3.9 — أداة إصدار كوبونات فورية (Programmatic Coupon Issuance)
//
// ⚠️ هذا الملف "قابلية" جاهزة بالنظام بس — مش مربوط حالياً بأي حدث.
// الهدف: أي حدث مستقبلي بالنظام تحب تربطه بكوبون فوري (فتح حساب
// جديد، إحالة صديق، عيد ميلاد، نظام ولاء، تعويض عن مشكلة خدمة...)
// بيصير مجرد استدعاء سطر واحد لدالة issueCouponForUsers من هون —
// بدون الحاجة لبناء أي بنية إضافية وقتها.
//
// مثال استخدام مستقبلي (تعليق فقط — غير مفعّل):
//   const { issueCouponForUsers } = require("../utils/couponIssuer");
//   await issueCouponForUsers({
//     userIds: [newUser._id],
//     type: "fixed",
//     value: 5000,
//     codePrefix: "WELCOME",
//   });
const crypto = require("crypto");
const Coupon = require("../models/Coupon");

const generateUniqueCode = (prefix) => {
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}-${random}`;
};

/**
 * يصدر كوبون جديد فورياً، مستهدف مستخدم واحد أو مجموعة مستخدمين
 * تحديداً (audience: "specific_users" تلقائياً — هدول الكوبونات
 * دايماً شخصية بطبيعتها، مو عامة للكل).
 *
 * الكود بيتولّد تلقائياً وبيضمن عدم التكرار (إعادة محاولة لغاية 3
 * مرات لو صار تصادم نادر بكود موجود مسبقاً).
 *
 * @param {Object} options
 * @param {string[]} options.userIds - مستخدم واحد أو أكثر (Order بيتحقق
 *   إنو المستخدم اللي بيطبّق الكوبون موجود بهاللستة)
 * @param {"percentage"|"fixed"|"free_delivery"} options.type
 * @param {number} [options.value] - مطلوب لكل الأنواع ما عدا free_delivery
 * @param {string} [options.codePrefix="AUTO"] - بادئة الكود الظاهر
 *   (مثلاً "WELCOME" لكوبون ترحيبي، "REFERRAL" لإحالة صديق...)
 * @param {Object} [options.overrides] - أي حقول إضافية من موديل Coupon
 *   لتخصيص السلوك الافتراضي (minOrderValue, maxDiscountAmount,
 *   hasExpiry, startDate, endDate, maxUsesPerUser, note...)
 *
 * الافتراضيات لو ما انحددت بـ overrides:
 *   maxUsesPerUser: 1   (كوبون شخصي، استخدام وحيد لكل مستخدم مستهدف)
 *   isActive: true
 *
 * @returns {Promise<Coupon>} الكوبون المُنشأ (يحتوي على .code الجاهز
 *   للعرض بالإشعار/الفرونت مباشرة)
 */
const issueCouponForUsers = async ({
  userIds,
  type,
  value = null,
  codePrefix = "AUTO",
  overrides = {},
}) => {
  if (!userIds || userIds.length === 0) {
    throw new Error("issueCouponForUsers: userIds is required");
  }
  if (!["percentage", "fixed", "free_delivery"].includes(type)) {
    throw new Error(`issueCouponForUsers: invalid type "${type}"`);
  }
  if (type !== "free_delivery" && (value === null || value === undefined)) {
    throw new Error(
      `issueCouponForUsers: value is required for type "${type}"`,
    );
  }

  const MAX_ATTEMPTS = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const code = generateUniqueCode(codePrefix);

      const coupon = await Coupon.create({
        code,
        type,
        value: type === "free_delivery" ? null : value,
        audience: "specific_users",
        allowedUserIds: userIds,
        maxUsesPerUser: 1,
        isActive: true,
        ...overrides,
      });

      return coupon;
    } catch (err) {
      // تصادم بكود موجود مسبقاً (نادر جداً بس ممكن) — جرّب كود تاني
      if (err.code === 11000) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }

  throw (
    lastError ||
    new Error("issueCouponForUsers: failed to generate a unique code")
  );
};

module.exports = { issueCouponForUsers };
