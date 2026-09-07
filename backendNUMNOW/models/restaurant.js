const mongoose = require("mongoose");

const restaurantSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RestaurantUser",
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      default: "",
    },

    email: String,

    phone: String,

    commission: {
      type: Number,
      default: 15,
      min: 0,
      max: 100,
    },

    // 📝 عنوان نصي (للعرض فقط)
    address: {
      fullAddress: { type: String, required: true },
      country: String,
      city: String,
      area: String,
      street: String,
      building: String,
      notes: String,
    },

    // 📍 الموقع الجغرافي (الأساس)
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true,
      },
    },

    image: {
      url: String,
      public_id: String,
    },

    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    paymentMethods: {
      type: [String],
      enum: ["cash", "visa", "mastercard", "paypal", "apple_pay"],

      default: ["cash"],
    },

    status: {
      type: String,
      enum: ["open", "closed", "blocked"],
      default: "closed",
    },
    reasonForBlock: {
      type: String,
      default: "",
    },

    country: {
      type: String,
      enum: ["SY", "DE"],
      default: "SY",
    },
    currency: {
      type: String,
      enum: ["SYP", "EUR"],
      default: "SYP",
    },
    taxRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  { timestamps: true },
);

// ⭐ مهم جدًا للبحث الجغرافي
restaurantSchema.index({ location: "2dsphere" });

module.exports =
  mongoose.models.Restaurant || mongoose.model("Restaurant", restaurantSchema);
