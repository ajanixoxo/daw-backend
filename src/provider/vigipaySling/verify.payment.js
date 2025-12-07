const axios = require("axios");
const Payment = require("@models/paymentModel/payment.model.js");
// const https = require("https");

// const agent = new https.Agent({
//   rejectUnauthorized: false,
// });


exports.verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    const verifyRes = await axios.get(
      `${process.env.VIGIPAY_BASE_URL}/api/v1/Payment/${reference}/requery`
    );

    const data = verifyRes.data.responseData;

    const payment = await Payment.findOne({ transactionReference: reference });
    if (!payment) return res.status(404).json({ message: "Payment not found" });

    payment.vigipayStatus =
      data.status === "Successful" ? "successful" : "failed";
    payment.amountAfterCharge = data.amountAfterCharge;
    payment.charge = data.charge;
    payment.channel = data.channel;
    payment.rawResponse = data;

    await payment.save();

    // if (payment.vigipayStatus === "successful") {
    // }

    return res.json({
      success: true,
      status: payment.vigipayStatus,
      payment,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
