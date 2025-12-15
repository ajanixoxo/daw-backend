const axios = require("axios");
const Payment = require("@models/paymentModel/payment.model.js");
const User = require("@models/userModel/user.js");

exports.createPayment = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const {
      amount,
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
      logisticsInfo,
    } = req.body;

    if (!amount) {
      return res.status(400).json({ message: "Amount is required" });
    }

    const payload = {
      customerReference: user._id.toString(),
      amount,
      description: description || "Order Payment",
      customerName: name || `${user.firstName} ${user.lastName}`,
      customerEmail: email || user.email,
      customerMobile: phone || user.phone,
      returnUrl: `${process.env.FRONTEND_URL}/payment/success`,
      integrationKey: process.env.VIGIPAY_INTEGRATION_KEY,
    };

    const response = await axios.post(
      `${process.env.VIGIPAY_BASE_URL}/api/v1/Payment`,
      payload
    );

    const data = response?.data?.responseData;

    if (!data) {
      return res.status(500).json({ message: "Invalid response from payment gateway" });
    }

    const payment = await Payment.create({
      userId: user._id,

      amount,
      description: payload.description,

      transactionReference: data.transactionReference,
      redirectUrl: data.redirectUrl,
      channel: data.channel || "vigipay",

      charge: data.charge || 0,
      amountAfterCharge: data.amountAfterCharge || amount,
      vigipayStatus: "pending",
      name: payload.customerName,
      email: payload.customerEmail,
      phone: payload.customerMobile,
      country,
      state,
      city,
      DeliveryAddress,
      address: address || [],
      zipCode,
      logisticsInfo,

      rawResponse: data,
    });

    return res.status(200).json({
      status: true,
      paymentId: payment._id,
      reference: data.transactionReference,
      redirectUrl: data.redirectUrl,
    });

  } catch (err) {
    console.error("Create payment error:", err);
    return res.status(500).json({ message: err.message });
  }
};
