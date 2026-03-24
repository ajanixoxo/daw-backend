const axios = require("axios");
const Payment = require("@models/paymentModel/payment.model.js");
const Order = require("@models/marketPlace/orderModel.js");
const User = require("@models/userModel/user.js");
const Shop = require("@models/marketPlace/shopModel.js");
const WalletLedger = require("@models/walletLedger/ledger.js");
const marketplaceService = require("@services/marketPlace/marketPlaceServices.js");

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const paystackAuthHeader = () => `Bearer ${process.env.PAYSTACK_SECRET_KEY}`;

exports.verifyPayment = async (req, res) => {
  try {

    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: "Transaction reference is required"
      });
    }

    const payment = await Payment.findOne({
      transactionReference: reference
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found for this reference"
      });
    }

    if (payment.paystackStatus === "successful") {
      return res.status(200).json({
        success: true,
        message: "Payment already verified"
      });
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

    const txnStatus = txn?.status;
    const gatewayTxnId = txn?.id;
    const gatewayAmount = txn?.amount / 100; 

    if (Number(gatewayAmount) !== Number(payment.amount)) {
      console.warn("Paystack amount mismatch");

      return res.status(400).json({
        success: false,
        message: "Amount mismatch"
      });
    }

    if (txnStatus === "success") {

      payment.paystackStatus = "successful";
      payment.gatewayTransactionId = gatewayTxnId;
      payment.rawResponse = txn;

      await payment.save();

      await Order.findByIdAndUpdate(payment.orderId, {
        payment_status: "paid",
        escrow_status: "held",
        status: "processing"
      });

      // 🔹 Notify logistics provider
      await marketplaceService.assignAndNotifyLogistics(payment.orderId).catch(err => {
        console.error("Failed to assign/notify logistics in Paystack verify:", err.message);
      });

      try {
        //find shop name for ledger entry
        // const shop = await Shop.findById(payment.shopId);
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
              shopName: payment.shopName || "N/A",
              status: "SUCCESS",
              channel: "paystack",
              rawWebhookPayload: txn,
              shopId: payment.shopId,
              shop_ownerId: payment.shopOwnerId,
              transactionDate: new Date()
            }
          },
          { upsert: true, new: true }
        );

        console.log(`Paystack wallet ledger created for ${reference}`);

      } catch (ledgerErr) {
        console.error("Wallet ledger error:", ledgerErr.message);
      }

      try {

        const order = await Order.findById(payment.orderId);

        if (order?.shop_id) {

          const shop = await Shop.findById(order.shop_id);

          if (shop?.owner_id) {

            const seller = await User.findById(shop.owner_id);

            if (seller) {

              seller.pending_amount =
                (seller.pending_amount || 0) + payment.amount;

              await seller.save();

              console.log(
                `Seller ${seller._id} pending updated`
              );
            }
          }
        }

      } catch (sellerErr) {
        console.error("Seller pending update error:", sellerErr.message);
      }


      return res.status(200).json({
        success: true,
        message: "Payment verified successfully",
        reference,
        gatewayReference: gatewayTxnId,
        status: txnStatus
      });
    }

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

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};