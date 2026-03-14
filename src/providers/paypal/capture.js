const axios = require("axios");
const Payment = require("@models/paymentModel/payment.model.js");
const Order = require("@models/marketPlace/orderModel.js");


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
      return res
        .status(400)
        .json({ success: false, message: "paypalOrderId is required" });
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

    const payment = await Payment.findOne({
      transactionReference: paypalOrderId
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found for this PayPal order"
      });
    }

    if (captureStatus === "COMPLETED") {
      payment.paypalStatus = "successful";
      payment.rawResponse = captured;
      await payment.save();

      await Order.findByIdAndUpdate(payment.orderId, {
        payment_status: "paid"
      });

      return res.status(200).json({
        success: true,
        message: "Payment captured successfully",
        captureId: captured.purchase_units?.[0]?.payments?.captures?.[0]?.id,
        status: captureStatus
      });
    }

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
    return res
      .status(500)
      .json({ success: false, message: err.message });
  }
};
