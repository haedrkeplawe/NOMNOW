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
  { timestamps: true, _id: false },
);

const documentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["id", "driving_license", "vehicle_registration"],
      required: true,
    },
    image: imageSchema,

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    rejectionReason: String,

    verifiedAt: Date,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  { timestamps: true },
);

const driverSchema = new mongoose.Schema(
  {
    driverImage: imageSchema,
    documents: [documentSchema],

    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    vehicletype: {
      type: String,
      enum: ["bicycle", "motorcycle", "car"],
      required: true,
      lowercase: true,
      trim: true,
    },
    vehicleplate: { type: String, required: true },
    zone: { type: String, required: true },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "blocked"],
      default: "pending",
    },

    reasonForSuspension: {
      type: String,
    },

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

    emailOtp: { type: String },
    emailOtpExpire: Date,

    phoneOtp: { type: String },
    phoneOtpExpire: Date,

    resetPasswordToken: { type: String },
    resetPasswordExpire: Date,

    availability: {
      type: String,
      enum: ["online", "busy", "offline"],
      default: "offline",
    },
    currentLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        default: [0, 0],
      },
    },
    country: {
      type: String,
      enum: ["SY", "DE"],
      default: "SY",
    },

    cashCreditLimit: {
      type: Number,
      default: 0,
      min: 0,
    },
    cashCollected: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);
driverSchema.index({ currentLocation: "2dsphere" });

module.exports = mongoose.model("Driver", driverSchema);
