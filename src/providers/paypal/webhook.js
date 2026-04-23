const axios = require("axios");
const Payment = require("@models/paymentModel/payment.model.js");
const Order = require("@models/marketPlace/orderModel.js");
const User = require("@models/userModel/user.js");
const Shop = require("@models/marketPlace/shopModel.js");
const WalletLedger = require("@models/walletLedger/ledger.js");
const marketplaceService = require("@services/marketPlace/marketPlaceServices.js");


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

    console.error(
      "PayPal webhook verification error:",
      err?.response?.data || err.message
    );

    return false;
  }
};



exports.handleWebhook = async (req, res) => {

  try {


    if (process.env.NODE_ENV === "production") {

      const isValid = await verifyWebhookSignature(req);

      if (!isValid) {
        console.warn("Invalid PayPal webhook signature");
        return res.status(400).json({
          success: false,
          message: "Invalid webhook signature"
        });
      }
    }


    const event = req.body;

    const eventType = event?.event_type;

    const resource = event?.resource;


    console.log(`PayPal webhook received: ${eventType}`);


    if (eventType === "PAYMENT.CAPTURE.COMPLETED") {

      const captureId = resource?.id;

      const paypalOrderId =
        resource?.supplementary_data?.related_ids?.order_id;


      const captureAmount = resource?.amount?.value;


      if (!paypalOrderId) {
        console.warn("PayPal webhook missing order id");
        return res.status(200).json({ received: true });
      }


      const payment = await Payment.findOne({
        transactionReference: paypalOrderId
      });


      if (!payment) {
        console.warn(`Payment not found for PayPal order ${paypalOrderId}`);
        return res.status(200).json({ received: true });
      }


      if (payment.paypalStatus === "successful") {

        console.log("Webhook already processed");

        return res.status(200).json({ received: true });
      }


      if (Number(captureAmount) !== Number(payment.amount)) {

        console.warn("PayPal webhook amount mismatch");

        return res.status(400).json({
          success: false,
          message: "Amount mismatch"
        });
      }

      payment.paypalStatus = "successful";
      payment.captureId = captureId;
      payment.rawResponse = resource;

      await payment.save();


      await Order.findByIdAndUpdate(payment.orderId, {
        payment_status: "paid",
        escrow_status: "held",
        status: "processing"
      });

      // 🔹 Notify logistics provider(s)
      const orderIdList = payment.orderId.split(",");
      for (const currentOrderId of orderIdList) {
        const trimmedOrderId = currentOrderId.trim();
        await marketplaceService.assignAndNotifyLogistics(trimmedOrderId).catch(err => {
          console.error(`Failed to notify logistics for order ${trimmedOrderId} in PayPal webhook:`, err.message);
        });
      }


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
              shopId: payment.shopId,
              shop_ownerId: payment.shopOwnerId,
              shopName: payment.shopName,
              transactionDate: new Date(),
            },
          },
          {
            upsert: true,
            new: true,
          },
        );

        console.log(`Wallet ledger created for ${paypalOrderId}`);

      } catch (ledgerErr) {

        console.error(
          "Wallet ledger error:",
          ledgerErr.message
        );
      }


      // --- Primary Admin (Treasury) Pending Amount ---
      try {
        const order = await Order.findById(payment.orderId);
        const primaryAdmin = await User.findOne({ isPrimaryAdmin: true });
        if (primaryAdmin && order) {
          const deliveryFee = order.delivery_fee || 0;
          const totalProductAmount = payment.amount - deliveryFee;

          primaryAdmin.pending_amount = (primaryAdmin.pending_amount || 0) + totalProductAmount;
          await primaryAdmin.save();
          console.log(`PayPal webhook – Primary Admin treasury updated with Product Price: ${totalProductAmount} (Delivery fee of ${deliveryFee} excluded)`);
        } else {
          console.warn("PayPal webhook – Primary Admin or Order not found to hold treasury funds.");
        }
      } catch (adminErr) {
        console.error("PayPal webhook – Primary Admin treasury error:", adminErr.message);
      }
      // -----------------------------



      console.log(
        `PayPal payment completed for order ${payment.orderId}`
      );
    }


    if (
      eventType === "PAYMENT.CAPTURE.DENIED" ||
      eventType === "PAYMENT.CAPTURE.REVERSED"
    ) {

      const paypalOrderId =
        resource?.supplementary_data?.related_ids?.order_id;


      const payment = await Payment.findOne({
        transactionReference: paypalOrderId
      });


      if (payment) {

        payment.paypalStatus = "failed";
        payment.rawResponse = resource;

        await payment.save();

        console.log(
          `PayPal payment failed/reversed for order ${payment.orderId}`
        );
      }
    }

    if (
      eventType !== "PAYMENT.CAPTURE.COMPLETED" &&
      eventType !== "PAYMENT.CAPTURE.DENIED" &&
      eventType !== "PAYMENT.CAPTURE.REVERSED"
    ) {

      console.log(`Unhandled PayPal event: ${eventType}`);
    }



    return res.status(200).json({
      received: true
    });

  } catch (err) {

    console.error(
      "PayPal webhook handler error:",
      err.message
    );

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};