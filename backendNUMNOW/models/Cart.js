const mongoose = require("mongoose");

/* =========================
   Cart Item (Food Snapshot)
========================= */
const cartItemSchema = new mongoose.Schema({
  foodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Food",
    required: true,
  },

  // Snapshot data (important)
  name: {
    type: String,
    required: true,
    trim: true,
  },

  image: {
    type: String,
    default: null,
  },

  basePrice: {
    type: Number,
    required: true,
    min: 0,
  },

  quantity: {
    type: Number,
    default: 1,
    min: 1,
  },

  // Selected size (optional)
  size: {
    name: {
      type: String,
      enum: ["small", "medium", "large", null],
      default: null,
    },
    price: {
      type: Number,
      default: null,
    },
  },

  // Selected extras
  extras: [
    {
      name: {
        type: String,
        required: true,
        trim: true,
      },
      price: {
        type: Number,
        required: true,
        min: 0,
      },
    },
  ],

  // update v2.2
  // ── حقول العروض — optional، لا تؤثر على السلات الموجودة ──
  // السعر الأصلي قبل الخصم (محفوظ لإعادة الحساب لو انتهى العرض)
  originalPrice: {
    type: Number,
    default: null,
    min: 0,
  },

  // update v2.2
  // معرف العرض المطبق على هذا العنصر (discount فقط)
  promotionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Promotion",
    default: null,
  },

  // (basePrice + extras) * quantity
  totalItemPrice: {
    type: Number,
    required: true,
    min: 0,
  },
});

/* =========================
   Main Cart Schema
========================= */
const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    // Cart is linked to ONE restaurant only
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },

    items: {
      type: [cartItemSchema],
      default: [],
    },

    totalCartPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    // new v2.2
    // ── حقل العروض — optional، false بالافتراضي لا يؤثر على السلات الموجودة ──
    // لو في طعام في السلة عليه عرض free_delivery، يصير التوصيل مجاني للأوردر كله
    hasFreeDelivery: {
      type: Boolean,
      default: false,
    },

    // new v2.2
    // معرف عرض التوصيل المجاني (للتحقق منه عند order:send)
    freeDeliveryPromotionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Promotion",
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Cart", cartSchema);
