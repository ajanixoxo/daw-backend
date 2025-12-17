const axios = require("axios");
const Payment = require("@models/paymentModel/payment.model.js");
// const walletLedger = require("@models/walletLedger/ledger.js");
const Order = require("@models/marketPlace/orderModel.js");
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

    if (payment.vigipayStatus === "successful") {
      const order = await Order.findById(payment.orderId);
      if (!order) throw new Error("Order not found");

      order.payment_status = "paid";
      order.escrow_status = "held";
      order.status = "processing"; 
      await order.save();
      //if order = delivered then fund the sellers wallet
      // await walletLedger.create({
      //   userId: order.seller_id,
      //   reference: `order-${order._id}`,
      //   type: "CREDIT",
      //   amount: payment.amountAfterCharge,
      //   status: "SUCCESS",
      //   description: `Payment received for order ${order._id}`,
      //   rawWebhookPayload: data,
      // });
    }

    return res.json({
      success: true,
      status: payment.vigipayStatus,
      payment,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
