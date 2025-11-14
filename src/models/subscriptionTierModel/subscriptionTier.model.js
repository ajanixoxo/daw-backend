const mongoose = require("mongoose");

const SubscriptionTierSchema = new mongoose.Schema(
  {
    cooperativeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cooperative",
      required: true
    },

    name: {
      type: String,
      enum: ["Tier 1", "Tier 2", "Tier 3"],
      required: true
    },

    monthlyContribution: { type: Number, required: true },

    benefits: {
      marketplaceDiscount: Number,
      masterclassAccess: Boolean,
      prioritySupport: Boolean,
      businessConsultation: Boolean
    },

    loanSettings: {
      maxAmount: Number,
      interestRate: Number,
      maxDurationMonths: Number,
      eligibilityCriteria: {
        minPaidMonths: Number,
        minTotalPaid: Number
      }
    },

    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

const SubscriptionTier = mongoose.model(
  "SubscriptionTier",
  SubscriptionTierSchema
);

module.exports = SubscriptionTier;
