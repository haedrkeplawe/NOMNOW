const mongoose = require("mongoose");

const mainCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    // v3.8 — صورة/أيقونة القسم العام (اختيارية)
    image: {
      url: { type: String, default: null },
      public_id: { type: String, default: null },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("MainCategory", mainCategorySchema);
