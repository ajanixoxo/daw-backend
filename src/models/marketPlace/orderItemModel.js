const mongoose = require("mongoose");


const orderItemSchema = new mongoose.Schema({
  order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true
  },
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  confirmation_code: { type: String }
}, { timestamps: true });

const OrderItem = mongoose.model("OrderItem", orderItemSchema);

module.exports =  OrderItem;
