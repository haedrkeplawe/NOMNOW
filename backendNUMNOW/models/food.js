const mongoose = require("mongoose");

const userRatingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    comment: {
      type: String,
    },
  },
  { timestamps: true },
);

const extraSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const foodSchema = new mongoose.Schema(
  {
    // 🔗 تابع لمطعم
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    // 🔗 تابع للصنف
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      trim: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    image: {
      url: {
        type: String,
      },
      public_id: {
        type: String,
      },
    },

    time: {
      type: Number, // وقت التحضير بالدقائق
      required: true,
    },

    // ⭐ التقييم
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    userRatings: [userRatingSchema],

    // 🧾 المكونات الأساسية
    ingredients: [
      {
        type: String,
      },
    ],

    // ➕ إضافات اختيارية
    extras: [extraSchema],

    // 📏 أحجام اختيارية (إذا موجودة تُلغي price)
    sizes: {
      type: [
        {
          name: {
            type: String,
            enum: ["small", "medium", "large"],
            required: true,
          },
          price: {
            type: Number,
            required: true,
            min: 0,
          },
        },
      ],
      default: [],
      validate: {
        validator: function (arr) {
          if (arr.length === 0) return true;
          const names = arr.map((s) => s.name);
          return new Set(names).size === names.length;
        },
        message: "Duplicate size names are not allowed",
      },
    },

    status: {
      type: String,
      enum: ["available", "unavailable"],
      default: "available",
    },

    // new1.1
    isFeatured: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Food", foodSchema);
