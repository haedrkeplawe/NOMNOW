const mongoose = require("mongoose");

const adSchema = new mongoose.Schema(
  {
    image: {
      url: {
        type: String,
      },
      public_id: {
        type: String,
      },
    },
    title: {
      type: String,
      required: true,
    },
    adtype: {
      type: String,
      enum: ["Banner", "Popup", "Featured", "Category"],
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    target: {
      type: String,
      required: true,
    },
    priority: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Ad", adSchema);
