const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  buyer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  shop_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    required: true
  },
  logistics_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LogisticsProvider"
  },
  delivery_fee: { type: Number, default: 0 },
  shipping_address: {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String
  },
  total_amount: { type: Number, required: true, min: [0.01, "Total amount must be greater than 0"] },
  discount: { type: Number, default: 0 },
  escrow_status: {
    type: String,
    enum: ["pending", "held", "released"],
    default: "pending"
  },
  payment_status: {
    type: String,
    enum: ["unpaid", "paid", "refunded"],
    default: "unpaid"
  },
  status: {
    type: String,
    enum: ["pending", "processing", "in_transit", "delivered", "disputed"],
    default: "pending"
  },
  status_history: [{
    status: String,
    changed_at: { type: Date, default: Date.now },
    note: String
  }]
}, { timestamps: true });

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
