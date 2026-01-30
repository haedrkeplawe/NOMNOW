// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    favoritesfood: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Food",
      },
    ],
    favoritesres: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Restaurant",
      },
    ],
    img: {
      url: String,
      public_id: String,
    },
    name: { type: String, required: true },

    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },

    status: {
      type: String,
      enum: ["active", "blocked"],
      default: "active",
    },
    reasonForSuspension: {
      type: String,
    },

    gender: { type: String, enum: ["male", "female"], required: true },
    dateOfBirth: { type: Date, required: true },
    isVerifiedEmail: { type: Boolean, default: false },
    isVerifiedPhone: { type: Boolean, default: false },
    password: { type: String },

    addresses: [
      {
        name: { type: String, default: "Home" },

        fullAddress: { type: String, required: true },
        country: String,
        city: String,
        area: String,
        street: String,
        building: String,
        notes: String,

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

        isDefault: { type: Boolean, default: false },
      },
    ],

    // OTP للتحقق
    emailOtp: String,
    emailOtpExpire: Date,

    phoneOtp: String,
    phoneOtpExpire: Date,

    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  { timestamps: true }
);

userSchema.index({ "addresses.location": "2dsphere" });

module.exports = mongoose.model("User", userSchema);
