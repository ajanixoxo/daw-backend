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
    orderId: {
      type: String,
      // ref: "Order",
    },
    name: String,
    email: String,
    phone: String,
    country: String,
    state: String,
    city: String,
    address: [String],
    zipCode: String,
    logisticsInfo: String,
    DeliveryAddress: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", PaymentSchema);
