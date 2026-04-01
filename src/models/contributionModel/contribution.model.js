const mongoose = require("mongoose");

const ContributionSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true
    },

    cooperativeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cooperative",
      required: true
    },

    contributionTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ContributionType"
    },

    amount: { type: Number, required: true }, // NGN value (for stats/consistency)
    paidAmount: { type: Number },           // Actual amount paid in the specified currency
    currency: { 
      type: String, 
      enum: ["NGN", "USD"], 
      default: "NGN" 
    },

    month: { type: String, required: true }, // e.g., "January 2025"

    status: {
      type: String,
      enum: ["paid", "missed", "pending"],
      default: "pending"
    },

    transactionId: String,
    paidAt: Date
  },
  { timestamps: true }
);

const Contribution = mongoose.model(
  "Contribution",
  ContributionSchema
);

module.exports = Contribution;
