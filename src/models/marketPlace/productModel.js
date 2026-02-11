const mongoose = require("mongoose");

const variantSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, trim: true },
    values: [{ type: String, trim: true }],
  },
  { _id: false }
);

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
  variants: [variantSchema],
  productFeatures: { type: String, default: "" },
  careInstruction: { type: String, default: "" },
  returnPolicy: { type: String, default: "" },
  status: {
    type: String,
    enum: ["available", "unavailable", "draft", "out_of_stock"],
    default: "available",
  },
}, { timestamps: true });

const Product = mongoose.model("Product", productSchema);

module.exports = Product;