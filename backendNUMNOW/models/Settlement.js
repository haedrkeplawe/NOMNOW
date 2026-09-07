const mongoose = require("mongoose");

const settlementSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: String,
      default: null,
    },
    note: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

// يمنع وجود أكثر من طلب pending واحد لنفس المطعم على مستوى DB
settlementSchema.index(
  { restaurantId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
  },
);
settlementSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Settlement", settlementSchema);
