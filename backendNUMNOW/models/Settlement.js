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
      type: String, // admin name or id
      default: null,
    },
    note: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

settlementSchema.index({ restaurantId: 1, status: 1 });
settlementSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Settlement", settlementSchema);
