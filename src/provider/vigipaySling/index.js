const axios = require("axios");
const Payment = require("@models/paymentModel/payment.model.js");
const User = require("@models/userModel/user.js");
// const https = require("https");

// const agent = new https.Agent({
//   rejectUnauthorized: false,
// });

exports.createPayment = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ message: "User not found" });

    const { amount, description } = req.body;

    const payload = {
      customerReference: user._id.toString(),
      amount,
      description,
      customerName: `${user.firstName} ${user.lastName}`,
      customerEmail: user.email,
      customerMobile: user.phone,
      returnUrl: `${process.env.FRONTEND_URL}/payment/success`,
      integrationKey: process.env.VIGIPAY_INTEGRATION_KEY,
    };
    console.log("payyyyload", payload)
    console.log("url", `${process.env.VIGIPAY_BASE_URL}/api/v1/Payment`)
    const response = await axios.post(
      `${process.env.VIGIPAY_BASE_URL}/api/v1/Payment`,
      payload
    );
    
    console.log("response from vigipay", response);
    console.log("vigipay payload",payload)
    const data = response.data.responseData;

    const payment = await Payment.create({
      userId: user._id,
      amount,
      description,
      transactionReference: data.transactionReference,
      redirectUrl: data.redirectUrl,
      charge: data.charge,
      vigipayStatus: "pending",
      rawResponse: data,
    });

    return res.json({
      status: true,
      redirectUrl: data.redirectUrl,
      reference: data.transactionReference,
      paymentId: payment._id,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
