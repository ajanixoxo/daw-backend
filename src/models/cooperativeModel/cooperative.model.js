const mongoose = require("mongoose");

const CooperativeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
    category: String,

    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    logoUrl: String,
    bannerUrl: String,
    brandColors: [String],
    bylaws: String,
    welcomeMessage: String,

    subscriptionTiers: [
      { type: mongoose.Schema.Types.ObjectId, ref: "SubscriptionTier" }
    ],

    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "Member" }],

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended"],
      default: "pending"
    },

    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

const Cooperative = mongoose.model("Cooperative", CooperativeSchema);
module.exports = Cooperative;
