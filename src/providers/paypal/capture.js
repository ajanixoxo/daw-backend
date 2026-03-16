const axios = require("axios");
const Payment = require("@models/paymentModel/payment.model.js");
const Order = require("@models/marketPlace/orderModel.js");
const User = require("@models/userModel/user.js");
const Shop = require("@models/marketPlace/shopModel.js");
const WalletLedger = require("@models/walletLedger/ledger.js");



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



      await Order.findByIdAndUpdate(payment.orderId, {
        payment_status: "paid",
        escrow_status: "held",
        status: "processing"
      });
      
      //updating seller pending balance
      try {
        //find shop name for ledger entry
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
     
      //update seller pending balance
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
        console.error("Seller update error:", sellerErr.message);
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