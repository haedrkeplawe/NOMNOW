const mongoose = require("mongoose");

const adClickSchema = new mongoose.Schema(
  {
    adId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ad",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    clickedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false },
);

// ✅ منع تكرار نفس المستخدم على نفس الإعلان
adClickSchema.index({ adId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("AdClick", adClickSchema);
