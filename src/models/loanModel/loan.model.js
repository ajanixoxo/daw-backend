import mongoose from "mongoose";

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

    subscriptionTierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionTier",
      required: true
    },

    amount: { type: Number, required: true },
    interestRate: { type: Number, required: true },
    durationMonths: Number,

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "disbursed", "repaid"],
      default: "pending"
    },

    eligibilityReport: Object,

    repayments: [
      {
        date: Date,
        amount: Number,
        transactionId: String
      }
    ]
  },
  { timestamps: true }
);

const Loan = mongoose.model("Loan", LoanSchema);
export default Loan;
