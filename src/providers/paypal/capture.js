const axios = require("axios");
const Payment = require("@models/paymentModel/payment.model.js");
const Order = require("@models/marketPlace/orderModel.js");
const User = require("@models/userModel/user.js");
const Shop = require("@models/marketPlace/shopModel.js");
const WalletLedger = require("@models/walletLedger/ledger.js");
const { deliveryAssignedEmailTemplate } = require("@utils/EmailTemplate/template.js");
const marketplaceService = require("@services/marketPlace/marketPlaceServices.js");



const getAccessToken = async () => {
  const credentials = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const response = await axios.post(
    `${process.env.PAYPAL_BASE_URL}/v1/oauth2/token`,
    "grant_type=client_credentials",
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }
  );

  return response.data.access_token;
};



exports.captureOrder = async (req, res) => {
  try {

    const { paypalOrderId } = req.body;

    if (!paypalOrderId) {
      return res.status(400).json({
        success: false,
        message: "paypalOrderId is required"
      });
    }

    const payment = await Payment.findOne({
      transactionReference: paypalOrderId
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found"
      });
    }

    if (payment.paypalStatus === "successful") {
      return res.status(200).json({
        success: true,
        message: "Payment already captured"
      });
    }

    const accessToken = await getAccessToken();

    const captureResponse = await axios.post(
      `${process.env.PAYPAL_BASE_URL}/v2/checkout/orders/${paypalOrderId}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );


    const captured = captureResponse.data;
    const captureStatus = captured.status;



    const capture =
      captured?.purchase_units?.[0]?.payments?.captures?.[0];

    const captureId = capture?.id;
    const captureAmount = capture?.amount?.value;

    if (Number(captureAmount) !== Number(payment.amount)) {
      return res.status(400).json({
        success: false,
        message: "Amount mismatch"
      });
    }

    if (captureStatus === "COMPLETED") {

      payment.paypalStatus = "successful";
      payment.captureId = captureId;
      payment.rawResponse = captured;

      await payment.save();



      // 🔹 Handle multiple orders if present
      const orderIdList = payment.orderId.split(",");
      
      for (const currentOrderId of orderIdList) {
        const trimmedOrderId = currentOrderId.trim();
        await Order.findByIdAndUpdate(trimmedOrderId, {
          payment_status: "paid",
          escrow_status: "held",
          status: "processing"
        });

        // 🔹 Logistics assignment and notification for each order
        await marketplaceService.assignAndNotifyLogistics(trimmedOrderId).catch(err => {
          console.error("Failed to assign/notify logistics in PayPal capture:", err.message);
        });

        // 🔹 Update Primary Admin Treasury pending balance for each order (Product Price Only)
        try {
          const primaryAdmin = await User.findOne({ isPrimaryAdmin: true });
          if (primaryAdmin) {
            const deliveryFee = order.delivery_fee || 0;
            const totalProductAmount = order.total_amount - deliveryFee;

            primaryAdmin.pending_amount = (primaryAdmin.pending_amount || 0) + totalProductAmount;
            await primaryAdmin.save();
            console.log(`PayPal capture – Primary Admin treasury updated for order ${order._id} with Product Price: ${totalProductAmount}`);
          } else {
            console.warn("PayPal capture – No Primary Admin found to hold treasury funds.");
          }
        } catch (adminErr) {
          console.error("PayPal capture – Primary Admin treasury error:", adminErr.message);
        }
      }
      
      // 🔹 Create wallet ledger entry for the overall transaction
      try {
        const shop = await Shop.findById(payment.shopId);
        const user = await User.findById(payment.userId);

        await WalletLedger.findOneAndUpdate(
          { reference: payment.transactionReference },
          {
            $setOnInsert: {
              userId: payment.userId,
              walletId: user?.walletId || "N/A",
              reference: payment.transactionReference,
              type: "CREDIT",
              amount: payment.amount,
              shopName: shop?.name || "N/A",
              status: "SUCCESS",
              channel: "paypal",
              rawWebhookPayload: captured,
              shopId: payment.shopId,
              shop_ownerId: payment.shopOwnerId,
              transactionDate: new Date(),
            },
          },
          { upsert: true, new: true },
        );

        console.log(`Wallet ledger created for ${paypalOrderId}`);
      } catch (ledgerErr) {
        console.error("Wallet ledger error:", ledgerErr.message);
      }



      return res.status(200).json({
        success: true,
        message: "Payment captured successfully",
        captureId,
        status: captureStatus
      });
    }
  
    //if payment not completed, mark as failed
    payment.paypalStatus = "failed";
    payment.rawResponse = captured;

    await payment.save();


    return res.status(400).json({
      success: false,
      message: `Payment capture status: ${captureStatus}`,
      data: captured
    });

  } catch (err) {

    console.error(
      "PayPal captureOrder error:",
      err?.response?.data || err.message
    );

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};