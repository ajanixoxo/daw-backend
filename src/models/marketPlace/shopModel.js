const mongoose = require("mongoose");

const shopSchema = new mongoose.Schema({
  owner_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  cooperative_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Cooperative",
    default: null,
  },
  product:{
    type: mongoose.Schema.Types.ObjectId,
    ref:'Product',
    default: null,
  },
  name: { type: String, required: true, trim: true },
  description: String,
  category: String,
  logo_url: String,
  banner_url: String,
  is_member_shop: { type: Boolean, default: false },
  status: { type: String, enum: ["active", "suspended"], default: "active" },
}, { timestamps: true });

const Shop = mongoose.model("Shop", shopSchema);
module.exports = Shop;
