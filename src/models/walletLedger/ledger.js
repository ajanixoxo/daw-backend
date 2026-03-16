const mongoose = require("mongoose");

const walletLedgerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    walletId: {
      type: String,
      required: true,
      index: true
    },

    reference: {
      type: String,
      required: true,
      unique: true, // 🔐 idempotency
      index: true
    },

    merchantRef: {
      type: String,
      index: true
    },

    type: {
      type: String,
      enum: ["CREDIT", "DEBIT"],
      required: true
    },

    amount: {
      type: Number,
      required: true
    },

    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED"],
      default: "PENDING"
    },

    channel: {
      type: String 
    },

    beneficiaryAccount: {
      type: String
    },

    rawWebhookPayload: {
      type: Object
    },

    transactionDate: {
      type: Date
    },
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      index: true
    },
    shop_ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true
    },
    shopName: {
      type: String
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("WalletLedger", walletLedgerSchema);
