const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  shop_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    required: true
  },
  name: { type: String, required: true, trim: true },
  description: String,
  category: String,
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  images: [String],
  status: { type: String, enum: ["available", "out_of_stock"], default: "available" }
}, { timestamps: true });

const Product = mongoose.model("Product", productSchema);

module.exports = Product;