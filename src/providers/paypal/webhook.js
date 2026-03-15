const axios = require("axios");
const crypto = require("crypto");
const Payment = require("@models/paymentModel/payment.model.js");
const Order = require("@models/marketPlace/orderModel.js");
const User = require("@models/userModel/user.js");
const WalletLedger = require("@models/walletLedger/ledger.js");

const verifyWebhookSignature = async (req) => {
  try {
    const credentials = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString("base64");

    const tokenRes = await axios.post(
      `${process.env.PAYPAL_BASE_URL}/v1/oauth2/token`,
      "grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    const accessToken = tokenRes.data.access_token;

    const verifyPayload = {
      auth_algo: req.headers["paypal-auth-algo"],
      cert_url: req.headers["paypal-cert-url"],
      transmission_id: req.headers["paypal-transmission-id"],
      transmission_sig: req.headers["paypal-transmission-sig"],
      transmission_time: req.headers["paypal-transmission-time"],
      webhook_id: process.env.PAYPAL_WEBHOOK_ID,
      webhook_event: req.body
    };

    const verifyRes = await axios.post(
      `${process.env.PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`,
      verifyPayload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    return verifyRes.data.verification_status === "SUCCESS";
  } catch (err) {
    console.error("PayPal webhook verification error:", err?.response?.data || err.message);
    return false;
  }
};

exports.handleWebhook = async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production") {
      const isValid = await verifyWebhookSignature(req);
      if (!isValid) {
        console.warn("PayPal webhook: invalid signature");
        return res.status(400).json({ success: false, message: "Invalid webhook signature" });
      }
    }

    const event = req.body;
    const eventType = event?.event_type;
    const resource = event?.resource;

    console.log(`PayPal webhook received: ${eventType}`);

    switch (eventType) {
      case "PAYMENT.CAPTURE.COMPLETED": {
        const paypalOrderId =
          resource?.supplementary_data?.related_ids?.order_id ||
          resource?.id;

        if (paypalOrderId) {
          const payment = await Payment.findOne({
            transactionReference: paypalOrderId
          });

          if (payment && payment.paypalStatus !== "successful") {
            payment.paypalStatus = "successful";
            payment.rawResponse = resource;
            await payment.save();

            if (payment.orderId) {
              await Order.findByIdAndUpdate(payment.orderId, {
                payment_status: "paid"
              });
            }

            // --- Wallet Ledger ---
            try {
              const user = await User.findById(payment.userId);
              await WalletLedger.findOneAndUpdate(
                { reference: paypalOrderId },
                {
                  $setOnInsert: {
                    userId: payment.userId,
                    walletId: user?.walletId || "N/A",
                    reference: paypalOrderId,
                    type: "CREDIT",
                    amount: payment.amount,
                    status: "SUCCESS",
                    channel: "paypal",
                    rawWebhookPayload: resource,
                    transactionDate: new Date()
                  }
                },
                { upsert: true, new: true }
              );
              console.log(`PayPal webhook – wallet ledger created for order: ${paypalOrderId}`);
            } catch (ledgerErr) {
              console.error("PayPal webhook – wallet ledger error:", ledgerErr.message);
            }
            // ---------------------

            console.log(`PayPal payment completed for order: ${payment.orderId}`);
          }
        }
        break;
      }

      case "PAYMENT.CAPTURE.DENIED":
      case "PAYMENT.CAPTURE.REVERSED": {
        const paypalOrderId =
          resource?.supplementary_data?.related_ids?.order_id ||
          resource?.id;

        if (paypalOrderId) {
          const payment = await Payment.findOne({
            transactionReference: paypalOrderId
          });

          if (payment) {
            payment.paypalStatus = "failed";
            payment.rawResponse = resource;
            await payment.save();
            console.log(`PayPal payment failed/reversed for order: ${payment.orderId}`);
          }
        }
        break;
      }

      default:
        console.log(`PayPal webhook: unhandled event type "${eventType}"`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("PayPal webhook handler error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};
