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
  { timestamps: true, _id: false }
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
  { _id: false }
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

    status: {
      type: String,
      enum: ["available", "unavailable"],
      default: "available",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Food", foodSchema);
