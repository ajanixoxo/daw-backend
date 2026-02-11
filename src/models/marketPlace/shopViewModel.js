const mongoose = require("mongoose");

const shopViewSchema = new mongoose.Schema({
    shop_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Shop",
        required: true
    },
    viewer_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    ip_address: {
        type: String
    },
    view_date: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Query performance index
shopViewSchema.index({ shop_id: 1, view_date: 1 });

const ShopView = mongoose.model("ShopView", shopViewSchema);
module.exports = ShopView;
