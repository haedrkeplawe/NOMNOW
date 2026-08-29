// v3.9 — موديل الكوبونات
// مرحلة أولى: مقتصر على الطلبات السورية (كاش) فقط — الدفع الألماني
// عبر Stripe (createPaymentIntent) لا يُلمس إطلاقاً، فلا يوجد ربط
// حالياً بين الكوبون ومبلغ الدفع بالكارت. راجع ملاحظة country أسفل.
const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    // نوع الكوبون
    type: {
      type: String,
      enum: ["percentage", "fixed", "free_delivery"],
      required: true,
    },

    // قيمة الخصم — نسبة مئوية (1-100) أو مبلغ ثابت، غير مستخدمة لـ free_delivery
    value: {
      type: Number,
      min: 0,
      default: null,
    },

    // سقف أقصى لمبلغ الخصم — يفيد بنوع percentage لمنع خصم مبالغ كبيرة
    // جداً على طلبات عالية القيمة. اختياري (null = بدون سقف)
    maxDiscountAmount: {
      type: Number,
      min: 0,
      default: null,
    },

    // أقل قيمة طلب (itemsPrice) حتى يصير الكوبون قابل للتطبيق
    minOrderValue: {
      type: Number,
      min: 0,
      default: 0,
    },

    // ─── الجمهور المستهدف ──────────────────────────────────────
    // "all" = أي مستخدم، "specific_users" = محصور بلستة معينة
    // (تقدر تحط مستخدم واحد بس أو عدة مستخدمين بنفس اللستة)
    audience: {
      type: String,
      enum: ["all", "specific_users"],
      default: "all",
    },
    allowedUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: [],
      },
    ],

    // ─── الفترة الزمنية ─────────────────────────────────────────
    // hasExpiry = false → كوبون مفتوح بدون تاريخ انتهاء
    hasExpiry: { type: Boolean, default: false },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },

    // ─── حدود الاستخدام ─────────────────────────────────────────
    // null = بدون حد. maxUsesPerUser: 1 يعني "استخدام واحد فقط لكل مستخدم"
    maxTotalUses: { type: Number, min: 1, default: null },
    maxUsesPerUser: { type: Number, min: 1, default: null },

    // عداد الاستخدام الكلي — يُحدّث تلقائياً عند كل طلب ناجح يستخدمه
    usedCount: { type: Number, default: 0 },

    // v3.9 — مقتصر على السوري حالياً بسبب قيد عدم لمس كود الدفع الألماني.
    // موجود كحقل بالموديل تحسباً لتفعيل ألمانيا لاحقاً بعد مراجعة
    // createPaymentIntent، لكن السيرفر يرفض حالياً أي كوبون لمستخدم
    // بلده DE بغض النظر عن قيمة هذا الحقل (راجع applyCoupon).
    country: {
      type: String,
      enum: ["SY", "DE", "ALL"],
      default: "SY",
    },

    isActive: { type: Boolean, default: true },

    // ملاحظة داخلية اختيارية للأدمن (الغرض من الكوبون، الحملة المرتبطة...)
    note: { type: String, default: "" },
  },
  { timestamps: true },
);

couponSchema.index({ code: 1, isActive: 1 });

module.exports =
  mongoose.models.Coupon || mongoose.model("Coupon", couponSchema);
