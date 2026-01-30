// models/User.js
const mongoose = require("mongoose");
const imageSchema = {
  url: { type: String },
  public_id: { type: String },
};

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

const driverSchema = new mongoose.Schema(
  {
    driverImage: imageSchema,
    idImage: imageSchema,
    drivingLicenseImage: imageSchema,
    vehicleRegistrationImage: imageSchema,
    name: { type: String, required: true },

    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },

    vehicletype: { type: String, required: true },
    vehicleplate: { type: String, required: true },
    password: { type: String, required: true },
    zone: { type: String, required: true },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "blocked"],
      default: "pending",
    },

    availability: {
      type: String,
      enum: ["active", "busy", "offline"],
      default: "offline",
    },
    reasonForSuspension: {
      type: String,
    },

    // ⭐ التقييم
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    userRatings: [userRatingSchema],

    isDocumentsVerified: {
      type: Boolean,
      default: false,
    },

    isVerifiedEmail: { type: Boolean, default: false },
    isVerifiedPhone: { type: Boolean, default: false },

    // OTP للتحقق
    emailOtp: { type: String, select: false },
    emailOtpExpire: Date,

    phoneOtp: { type: String, select: false },
    phoneOtpExpire: Date,

    resetPasswordToken: { type: String, select: false },
    resetPasswordExpire: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Driver", driverSchema);
