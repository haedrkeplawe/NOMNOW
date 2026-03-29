const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    foodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Food",
      required: true,
    },
    name: { type: String, required: true },
    image: { type: String },
    price: { type: Number, required: true, min: 0 },
    size: {
      name: {
        type: String,
        enum: ["small", "medium", "large", null],
        default: null,
      },
      price: { type: Number, default: null },
    },
    quantity: { type: Number, required: true, min: 1 },
    extras: [
      {
        name: String,
        price: { type: Number, min: 0 },
      },
    ],
    totalPrice: { type: Number, required: true },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      default: null,
    },

    orderNumber: {
      type: String,
      unique: true,
    },

    items: { type: [orderItemSchema], default: [] },
    itemsPrice: { type: Number, required: true },
    deliveryFee: { type: Number, default: 0 },
    taxPrice: { type: Number, default: 0 },
    totalPrice: { type: Number, required: true },

    deliveryAddress: {
      fullAddress: String,
      location: {
        type: { type: String, enum: ["Point"], default: "Point" },
        coordinates: [Number],
      },
    },

    driverSearchStatus: {
      type: String,
      enum: ["searching", "failed", "assigned"],
      default: null,
    },

    paymentMethod: {
      type: String,
      enum: ["cash", "visa", "mastercard", "paypal", "apple_pay"],
      required: true,
    },
    paymentProvider: {
      type: String,
      enum: ["stripe", "paypal"],
      default: null,
    },
    paymentDetails: {
      transactionId: String,
      paymentIntentId: String,
      provider: String,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "awaiting_payment", "paid", "refunded", "failed"],
      default: "pending",
    },

    orderStatus: {
      type: String,
      enum: [
        "not_confirmed",
        "pending",
        "accepted",
        "preparing",
        "ready",
        "picked_up",
        "on_the_way",
        "delivered_by_driver",
        "delivered",
        "cancelled",
      ],
      default: "not_confirmed",
    },

    // ── حالة تسوية أرباح المطعم ───────────────────────────────
    // pending_settlement : الأوردر delivered لكن لسه في فترة الانتظار
    // available          : الأوردر جاهز للسحب (تجاوز فترة الانتظار)
    // withdrawal_pending : طُلب سحبه، بانتظار موافقة الأدمن
    // withdrawn          : تم سحب أرباحه فعلاً
    // not_applicable     : الأوردر ملغي أو غير مكتمل
    settlementStatus: {
      type: String,
      enum: [
        "pending_settlement",
        "available",
        "withdrawal_pending",
        "withdrawn",
        "not_applicable",
      ],
      default: "not_applicable",
    },

    // مرجع لطلب السحب المرتبط بهذا الأوردر
    settlementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Settlement",
      default: null,
    },

    notes: { type: String, default: "" },
    orderedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

orderSchema.index({ restaurantId: 1 });
orderSchema.index({ userId: 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ settlementStatus: 1 });
orderSchema.index({ "deliveryAddress.location": "2dsphere" });

module.exports = mongoose.model("Order", orderSchema);
