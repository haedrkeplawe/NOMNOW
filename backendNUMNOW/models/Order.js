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
    // new v2.2 — رسوم التوصيل الأصلية قبل تطبيق عرض التوصيل المجاني
    // Flutter: لا يحتاج هذا الحقل — للباك فقط
    originalDeliveryFee: { type: Number, default: null },
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
      enum: ["cash", "card", "visa", "mastercard", "paypal", "apple_pay"],
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

    // v3.0 — تم حذف "delivered_by_driver" نهائياً من دورة حياة الأوردر.
    // الانتقال صار مباشرة: on_the_way → delivered
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
        "delivered",
        "cancelled",
      ],
      default: "not_confirmed",
    },

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
    settlementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Settlement",
      default: null,
    },

    driverPaymentStatus: {
      type: String,
      enum: ["not_applicable", "pending", "settled"],
      default: "not_applicable",
    },
    settledAt: {
      type: Date,
      default: null,
    },
    // v3.0 — الحقل باقٍ ومستمر بالتعبئة (بلحظة وصول السائق نفسها الآن،
    // ضمن order:delivered)، فقط للأرشفة والتحليلات — ما عاد يُستخدم
    // لأي auto-confirmation لأن هاي الآلية اتلغت بالكامل
    deliveredByDriverAt: {
      type: Date,
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
orderSchema.index({ deliveredByDriverAt: 1 });
orderSchema.index({ "deliveryAddress.location": "2dsphere" });
orderSchema.index({ driverId: 1, orderStatus: 1 });
orderSchema.index({ restaurantId: 1, orderStatus: 1, createdAt: -1 });
orderSchema.index({ deliveredByDriverAt: 1, orderStatus: 1 });

module.exports = mongoose.model("Order", orderSchema);
