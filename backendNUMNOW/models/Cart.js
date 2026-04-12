const mongoose = require("mongoose");

/* =========================
   Cart Item (Food Snapshot)
========================= */
const cartItemSchema = new mongoose.Schema({
  foodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Food",
    required: true,
  },

  // Snapshot data (important)
  name: {
    type: String,
    required: true,
    trim: true,
  },

  image: {
    type: String,
    default: null,
  },

  basePrice: {
    type: Number,
    required: true,
    min: 0,
  },

  quantity: {
    type: Number,
    default: 1,
    min: 1,
  },

  // Selected size (optional)
  size: {
    name: {
      type: String,
      enum: ["small", "medium", "large", null],
      default: null,
    },
    price: {
      type: Number,
      default: null,
    },
  },

  // Selected extras
  extras: [
    {
      name: {
        type: String,
        required: true,
        trim: true,
      },
      price: {
        type: Number,
        required: true,
        min: 0,
      },
    },
  ],

  // (basePrice + extras) * quantity
  totalItemPrice: {
    type: Number,
    required: true,
    min: 0,
  },
});

/* =========================
   Main Cart Schema
========================= */
const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    // Cart is linked to ONE restaurant only
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },

    items: {
      type: [cartItemSchema],
      default: [],
    },

    totalCartPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Cart", cartSchema);
