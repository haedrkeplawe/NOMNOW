const mongoose = require("mongoose");

// ─────────────────────────────────────────────────────────────
// Promotion Model
// العروض مرتبطة بطعام معين ويمكن أن يكون على نفس الطعام
// عرضان في نفس الوقت: discount + free_delivery
// ─────────────────────────────────────────────────────────────

const promotionSchema = new mongoose.Schema(
  {
    // نوع العرض
    type: {
      type: String,
      enum: ["discount", "free_delivery"],
      required: true,
    },

    // الطعام المرتبط بالعرض
    foodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Food",
      required: true,
      index: true,
    },

    // قيمة الخصم بالنسبة المئوية — مطلوب فقط عند type = "discount"
    discountValue: {
      type: Number,
      min: 1,
      max: 99,
      default: null,
    },

    // تاريخ البداية والنهاية
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },

    // البلد — لعزل العروض بين السوقين
    country: {
      type: String,
      enum: ["SY", "DE", "ALL"],
      default: "ALL",
    },

    // تفعيل/تعطيل يدوي من الأدمن
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

// ── Index مركب لتسريع البحث عن العروض النشطة على طعام معين ──
promotionSchema.index({ foodId: 1, type: 1, isActive: 1 });
promotionSchema.index({ endDate: 1 }); // لتنظيف العروض المنتهية لاحقاً

// ── Helper: هل العرض نشط حالياً؟ ──
promotionSchema.methods.isCurrentlyActive = function () {
  const now = new Date();
  return this.isActive && this.startDate <= now && this.endDate >= now;
};

module.exports = mongoose.model("Promotion", promotionSchema);
