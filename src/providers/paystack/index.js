const axios = require("axios");
const Payment = require("@models/paymentModel/payment.model.js");
const User = require("@models/userModel/user.js");
const Order = require("@models/marketPlace/orderModel.js");
const Shop = require("@models/marketPlace/shopModel.js");
const AppError = require("@utils/Error/AppError.js");

const paystackAuthHeader = () => `Bearer ${process.env.PAYSTACK_SECRET_KEY}`;

const PAYSTACK_BASE_URL = "https://api.paystack.co";


exports.initializePayment = async (req, res) => {
  try {
    const userId = req.user._id;
    console.log("Initialising Paystack payment for user ID:", userId);

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

    // Fetch the order and make sure it belongs to the requesting buyer and is unpaid
    const order = await Order.findOne({
      _id: orderId,
      buyer_id: userId,
      payment_status: "unpaid"
    });

    if (!order) {
      throw new AppError("Invalid or already paid order", 400);
    }

    const shop = await Shop.findById(order.shop_id);
    if (!shop) {
      throw new AppError("Shop not found for this order", 404);
    }

    const amount = order.total_amount;

    // Paystack amounts are in KOBO (NGN minor unit = 1/100 of a Naira)
    const currency = process.env.PAYSTACK_CURRENCY || "NGN";
    const amountInKobo = Math.round(amount * 100);

    const payerEmail = email || user.email;

    const paystackPayload = {
      email: payerEmail,
      amount: amountInKobo,
      currency,
      reference: `DAW-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      callback_url: `${process.env.FRONTEND_URL}/payment/success?orderId=${orderId}`,
      metadata: {
        orderId: order._id.toString(),
        userId: userId.toString(),
        name: name || `${user.firstName} ${user.lastName}`,
        phone: phone || user.phone,
        description: description || "Order Payment",
        cancel_action: `${process.env.FRONTEND_URL}/payment/cancel?orderId=${orderId}`
      }
    };

    const paystackResponse = await axios.post(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      paystackPayload,
      {
        headers: {
          Authorization: paystackAuthHeader(),
          "Content-Type": "application/json"
        }
      }
    );

    const paystackData = paystackResponse.data?.data;
    const authorizationUrl = paystackData?.authorization_url;
    const reference = paystackData?.reference;

    if (!authorizationUrl) {
      return res.status(500).json({
        success: false,
        message: "Could not retrieve Paystack authorization URL"
      });
    }

    // Persist a pending payment record
    const payment = await Payment.create({
      userId: user._id,
      orderId: order._id.toString(),
      amount,
      shopId: shop._id,
      shopOwnerId: shop.owner_id,
      shopName: shop.name ||"N/A",
      description: description || "Order Payment",
      currency,
      channel: "paystack",
      transactionReference: reference,
      redirectUrl: authorizationUrl,
      paystackStatus: "pending",
      name: name || `${user.firstName} ${user.lastName}`,
      email: payerEmail,
      phone: phone || user.phone,
      country,
      state,
      city,
      address: address || [],
      DeliveryAddress,
      zipCode,
      logisticsInfo,
      rawResponse: paystackData
    });

    return res.status(200).json({
      success: true,
      paymentId: payment._id,
      reference,
      authorizationUrl
    });
  } catch (err) {
    console.error("Paystack initializePayment error:", err?.response?.data || err.message);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message
    });
  }
};
