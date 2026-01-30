const mongoose = require("mongoose");

/* =========================
   Cart Item (Food Snapshot)
========================= */
const cartItemSchema = new mongoose.Schema(
  {
    foodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Food",
      required: true,
    },

    // Snapshot data (important)
    name: {
      type: String,
      required: true,
    },

    image: {
      type: String,
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

    // Selected extras
    extras: [
      {
        name: {
          type: String,
          required: true,
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
  },
  { _id: false }
);

/* =========================
   Restaurant Cart
========================= */
const restaurantCartSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },

    items: {
      type: [cartItemSchema],
      default: [],
    },

    restaurantTotalPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

/* =========================
   Main Cart
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

    restaurants: {
      type: [restaurantCartSchema],
      default: [],
    },

    totalCartPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

/* =========================
   Indexes (Performance)
========================= */
cartSchema.index({ userId: 1 });

module.exports = mongoose.model("Cart", cartSchema);
