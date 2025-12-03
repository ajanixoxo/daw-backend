const mongoose = require("mongoose");

const MemberSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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

    monthlyContribution: { type: Number, required: true },

    joinDate: { type: Date, default: Date.now },

    status: {
      type: String,
      enum: ["active", "suspended", "inactive"],
      default: "active"
    },

    paymentHistory: [
      {
        month: String,
        amount: Number,
        status: {
          type: String,
          enum: ["paid", "missed", "pending"],
          default: "pending"
        },
        transactionId: String,
        paidAt: Date
      }
    ],

    loans: [{ type: mongoose.Schema.Types.ObjectId, ref: "Loan" }]
  },
  { timestamps: true }
);

const Member = mongoose.model("Member", MemberSchema);
module.exports = Member;
