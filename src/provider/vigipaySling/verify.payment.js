const axios = require("axios");
const Payment = require("@models/paymentModel/payment.model.js");
const Order = require("@models/marketPlace/orderModel.js");
const Shop = require("@models/marketPlace/shopModel.js");
const WalletLedger = require("@models/walletLedger/ledger.js");
const User = require("@models/userModel/user.js");

exports.verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    const verifyRes = await axios.get(
      `${process.env.VIGIPAY_BASE_URL}/api/v1/Payment/${reference}/requery`
    );

    const data = verifyRes.data.responseData;

    const payment = await Payment.findOne({ transactionReference: reference });
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    payment.vigipayStatus =
      data.status === "Successful" ? "successful" : "failed";
    payment.amountAfterCharge = data.amountAfterCharge;
    payment.charge = data.charge;
    payment.channel = data.channel;
    payment.rawResponse = data;

    await payment.save();

    if (payment.vigipayStatus !== "successful") {
      return res.json({
        success: false,
        status: payment.vigipayStatus,
        payment
      });
    }

    const order = await Order.findById(payment.orderId);
    if (!order) {throw new Error("Order not found");}

    if (order.payment_status === "paid") {
      return res.json({
        success: true,
        message: "Payment already processed",
        payment
      });
    }

    order.payment_status = "paid";
    order.escrow_status = "held";
    order.status = "processing";
    await order.save();

    const platformOwner = await User.findOne({
      roles: { $in: ["admin"] },
      walletId: { $exists: true }
    });

    if (!platformOwner) {
      throw new Error("Platform owner wallet not configured");
    }

    await WalletLedger.create({
      userId: platformOwner._id,
      walletId: platformOwner.walletId,
      reference: payment.transactionReference,
      merchantRef: order._id.toString(),
      type: "CREDIT",
      amount: payment.amountAfterCharge,
      status: "SUCCESS",
      channel: "vigipay",
      beneficiaryAccount: platformOwner.walletId,
      rawWebhookPayload: data,
      transactionDate: new Date()
    });

    const shop = await Shop.findById(order.shop_id);
    if (!shop) {throw new Error("Shop not found");}

    const seller = await User.findById(shop.owner_id);
    if (!seller) {throw new Error("Seller not found");}

    seller.pending_amount =
          (seller.pending_amount || 0) + order.total_amount;

    await seller.save();

    return res.json({
      success: true,
      message: "Payment verified and escrow held",
      payment,
      order
    });

  } catch (err) {
    console.error("Verify payment error:", err);
    return res.status(500).json({ message: err.message });
  }
};
