const mongoose = require("mongoose");

const sellerDocumentsSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    nin: { type: String, required: true },
    passport_photograph_url: { type: String, required: true },
    business_cac_url: { type: String, default: null },
    status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending"
    }
  },
  { timestamps: true }
);

sellerDocumentsSchema.index({ user_id: 1 }, { unique: true });

const SellerDocuments = mongoose.model("SellerDocuments", sellerDocumentsSchema);
module.exports = SellerDocuments;
