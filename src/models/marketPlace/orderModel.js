const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  buyer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  shop_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    required: true,
  },
  logistics_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LogisticsProvider",
  },
  total_amount: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  escrow_status: {
    type: String,
    enum: ["pending", "held", "released"],
    default: "pending",
  },
  payment_status: {
    type: String,
    enum: ["unpaid", "paid", "refunded"],
    default: "unpaid",
  },
  status: {
    type: String,
    enum: ["pending", "in_transit", "delivered", "disputed"],
    default: "pending",
  },
}, { timestamps: true });

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
