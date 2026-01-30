const mongoose = require("mongoose");

const restaurantUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    phone: {
      type: String,
      required: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["owner"],
      default: "owner",
    },

    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      default: null,
    },

    refreshToken: {
      type: String,
      default: null,
    },

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

const RestaurantUser = mongoose.model("RestaurantUser", restaurantUserSchema);

module.exports = RestaurantUser;
