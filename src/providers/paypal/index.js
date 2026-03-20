const axios = require("axios");
const Payment = require("@models/paymentModel/payment.model.js");
const User = require("@models/userModel/user.js");
const Order = require("@models/marketPlace/orderModel.js");
const AppError = require("@utils/Error/AppError.js");
const Shop = require("@models/marketPlace/shopModel.js");

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

exports.createOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    console.log("Creating PayPal order for user ID:", userId);
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const {
      orderId,
      description,
      name,
      email,
      phone,
      country,
      state,
      city,
      address,
      DeliveryAddress,
      zipCode,
      logisticsInfo
    } = req.body;

    if (!orderId) {
      throw new AppError("Order ID is required", 400);
    }

    const orderIdList = orderId.split(",");
    const orders = await Order.find({
      _id: { $in: orderIdList },
      buyer_id: userId,
      payment_status: "unpaid"
    });

    if (!orders || orders.length === 0) {
      throw new AppError("No valid or unpaid orders found", 400);
    }

    const { convertPrice } = require("@utils/currency/currencyHandler.js");
    
    // Sum total for all orders
    const totalAmountNGN = orders.reduce((sum, o) => sum + o.total_amount, 0);
    const amountInUSD = convertPrice(totalAmountNGN, "NGN", "USD");

    // Use first shop for payment record (or skip if multiple)
    const shop = await Shop.findById(orders[0].shop_id);
    const amount = amountInUSD;

    const currency = "USD";

    const accessToken = await getAccessToken();

    // Build the PayPal Orders API v2 request body
    const paypalPayload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: orders[0]._id.toString(),
          description: description || "Order Payment",
          amount: {
            currency_code: currency,
            value: amountInUSD.toFixed(2)
          }
        }
      ],
      application_context: {
        brand_name: process.env.APP_NAME || "DAW",
        landing_page: "BILLING",
        user_action: "PAY_NOW",
        return_url: `${process.env.FRONTEND_URL}/payment/success?orderId=${orderId}`,
        cancel_url: `${process.env.FRONTEND_URL}/payment/cancel?orderId=${orderId}`
      }
    };

    const paypalResponse = await axios.post(
      `${process.env.PAYPAL_BASE_URL}/v2/checkout/orders`,
      paypalPayload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    const paypalOrder = paypalResponse.data;

    // Extract the approval URL so the frontend can redirect the user
    const approvalUrl = paypalOrder.links?.find(
      (link) => link.rel === "approve"
    )?.href;

    if (!approvalUrl) {
      return res.status(500).json({
        success: false,
        message: "Could not retrieve PayPal approval URL"
      });
    }

    // Persist a pending payment record
    const payment = await Payment.create({
      userId: user._id,
      orderId: orderId, // Store all order IDs (comma-separated if needed)
      amount: amountInUSD,
      shopId: shop._id,
      shopOwnerId: shop.owner_id,
      shopName: shop.name || "N/A",
      description: description || "Order Payment",
      currency,
      channel: "paypal",
      transactionReference: paypalOrder.id,
      redirectUrl: approvalUrl,
      paypalStatus: "pending",
      name: name || `${user.firstName} ${user.lastName}`,
      email: email || user.email,
      phone: phone || user.phone,
      country,
      state,
      city,
      address: address || [],
      DeliveryAddress,
      zipCode,
      logisticsInfo,
      rawResponse: paypalOrder
    });

    return res.status(200).json({
      success: true,
      paymentId: payment._id,
      paypalOrderId: paypalOrder.id,
      approvalUrl
    });
  } catch (err) {
    console.error("PayPal createOrder error:", err?.response?.data || err.message);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message
    });
  }
};
