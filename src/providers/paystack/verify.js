const axios = require("axios");
const Payment = require("@models/paymentModel/payment.model.js");
const Order = require("@models/marketPlace/orderModel.js");
const User = require("@models/userModel/user.js");
const WalletLedger = require("@models/walletLedger/ledger.js");

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const paystackAuthHeader = () => `Bearer ${process.env.PAYSTACK_SECRET_KEY}`;

exports.verifyPayment = async (req, res) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return res
        .status(400)
        .json({ success: false, message: "Transaction reference is required" });
    }

    const verifyResponse = await axios.get(
      `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: paystackAuthHeader()
        }
      }
    );

    const txn = verifyResponse.data?.data;
    const txnStatus = txn?.status; // "success" | "failed" | "abandoned" …

    const payment = await Payment.findOne({ transactionReference: reference });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found for this reference"
      });
    }

    if (txnStatus === "success") {
      payment.paystackStatus = "successful";
      payment.rawResponse = txn;
      await payment.save();

      await Order.findByIdAndUpdate(payment.orderId, {
        payment_status: "paid",
        escrow_status: "held",
        status: "processing"
      });

      // --- Wallet Ledger ---
      try {
        const user = await User.findById(payment.userId);
        await WalletLedger.findOneAndUpdate(
          { reference },
          {
            $setOnInsert: {
              userId: payment.userId,
              walletId: user?.walletId || "N/A",
              reference,
              type: "CREDIT",
              amount: payment.amount,
              status: "SUCCESS",
              channel: "paystack",
              rawWebhookPayload: txn,
              transactionDate: new Date()
            }
          },
          { upsert: true, new: true }
        );
        console.log(`Paystack wallet ledger created for reference: ${reference}`);
      } catch (ledgerErr) {
        // Ledger failure must not block the payment response
        console.error("Paystack verify – wallet ledger error:", ledgerErr.message);
      }
      // ---------------------

      return res.status(200).json({
        success: true,
        message: "Payment verified successfully",
        reference,
        gatewayReference: txn?.id,
        status: txnStatus
      });
    }

    // Mark as failed for any non-success status
    payment.paystackStatus = "failed";
    payment.rawResponse = txn;
    await payment.save();

    return res.status(400).json({
      success: false,
      message: `Payment verification status: ${txnStatus}`,
      data: txn
    });
  } catch (err) {
    console.error(
      "Paystack verifyPayment error:",
      err?.response?.data || err.message
    );
    return res.status(500).json({ success: false, message: err.message });
  }
};
