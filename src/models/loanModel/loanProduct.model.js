const mongoose = require("mongoose");

const LoanProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    amount: {
      type: Number,
      required: true,
      min: 0
    },

    interestRate: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },

    repaymentTerm: {
      type: Number, // in months
      required: true,
      min: 1
    },

    monthlyPayment: {
      type: Number,
      required: true
    },

    tier: {
      type: String,
      enum: ["Basic", "Standard", "Premium", "Tier 1", "Tier 2", "Tier 3"], // Including legacy for safety
      required: true
    },

    purpose: {
      type: String,
      default: ""
    },

    description: {
      type: String,
      default: ""
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

const LoanProduct = mongoose.model("LoanProduct", LoanProductSchema);
module.exports = LoanProduct;
