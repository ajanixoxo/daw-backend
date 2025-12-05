const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    amount: Number,
    description: String,
    currency: { type: String, default: "NGN" },

    transactionReference: String,
    redirectUrl: String,
    channel: String,

    vigipayStatus: {
      type: String,
      enum: ["pending", "successful", "failed"],
      default: "pending",
    },

    amountAfterCharge: Number,
    charge: Number,

    rawResponse: Object,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", PaymentSchema);
