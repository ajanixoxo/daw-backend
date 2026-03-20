const mongoose = require("mongoose");

const LoanSchema = new mongoose.Schema(
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

    loanProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LoanProduct",
      required: true
    },

    amount: { type: Number, required: true },
    interestRate: { type: Number, required: true },
    durationMonths: Number,
    monthlyPayment: Number,
    
    location: { type: String, required: true },
    purpose: { type: String, default: "" },

    businessInfo: {
      useCase: String,
      businessImpact: String,
      expectedSalesImpact: String
    },

    documents: [String],

    guarantor: {
      fullName: String,
      memberId: { type: mongoose.Schema.Types.ObjectId, ref: "Member" },
      relationship: String,
      phone: String,
      email: String,
      status: {
        type: String,
        enum: ["pending", "accepted", "declined"],
        default: "pending"
      },
      acceptedAt: Date
    },

    status: {
      type: String,
      enum: ["pending", "under_review", "approved", "rejected", "disbursed", "repaid"],
      default: "pending"
    },

    eligibilityReport: Object,

    repayments: [
      {
        date: Date,
        amount: Number,
        transactionId: String
      }
    ],
    
    disbursedAt: Date,
    approvedAt: Date,
    rejectedReason: String
  },
  { timestamps: true }
);

const Loan = mongoose.model("Loan", LoanSchema);
module.exports = Loan;
