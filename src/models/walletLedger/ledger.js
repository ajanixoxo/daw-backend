const mongoose = require("mongoose");

const walletLedgerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    walletId: {
      type: String,
      required: true,
      index: true,
    },

    reference: {
      type: String,
      required: true,
      unique: true, // 🔐 idempotency
    },

    merchantRef: {
      type: String,
    },

    type: {
      type: String,
      enum: ["CREDIT", "DEBIT"],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED"],
      default: "PENDING",
    },

    channel: {
      type: String, 
    },

    beneficiaryAccount: {
      type: String,
    },

    rawWebhookPayload: {
      type: Object,
    },

    transactionDate: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WalletLedger", walletLedgerSchema);
