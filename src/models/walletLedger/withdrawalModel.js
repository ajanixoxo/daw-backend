const mongoose = require("mongoose");

const withdrawalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    amount: {
      type: Number,
      required: true,
      min: [1000, "Minimum withdrawal amount is ₦1,000"]
    },
    currency: {
      type: String,
      default: "NGN",
      enum: ["NGN"] // Strictly Naira as per instructions
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true
    },
    bankDetails: {
      accountNumber: { type: String, required: true },
      bankName: { type: String, required: true },
      accountName: { type: String, required: true }
    },
    adminNote: {
      type: String
    },
    ledgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WalletLedger"
    },
    processedAt: {
      type: Date
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Withdrawal", withdrawalSchema);
