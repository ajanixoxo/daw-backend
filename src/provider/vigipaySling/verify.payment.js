const axios = require("axios");
const Payment = require("@models/paymentModel/payment.model.js");
const Order = require("@models/marketPlace/orderModel.js");
const Shop = require("@models/marketPlace/shopModel.js");
const WalletLedger = require("@models/walletLedger/ledger.js");
const User = require("@models/userModel/user.js");
const marketplaceService = require("@services/marketPlace/marketPlaceServices.js");

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
    console.log("Payment found for reference:", reference, "Payment ID:", payment._id);
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

    // if (order.payment_status === "paid") {
    //   return res.json({
    //     success: true,
    //     message: "Payment already processed",
    //     payment
    //   });
    // }

    order.payment_status = "paid";
    order.escrow_status = "held";
    order.status = "processing";
    await order.save();

    // 🔹 Notify logistics provider(s)
    const orderIdList = payment.orderId.split(",");
    for (const currentOrderId of orderIdList) {
      const trimmedOrderId = currentOrderId.trim();
      await marketplaceService.assignAndNotifyLogistics(trimmedOrderId).catch(err => {
        console.error(`Failed to notify logistics for order ${trimmedOrderId} in Vigipay verify:`, err.message);
      });
    }
    console.log("Crediting platform treasury...")
    const primaryAdmin = await User.findOne({ isPrimaryAdmin: true });
    
    if (!primaryAdmin || !primaryAdmin.walletId) {
      console.warn("Primary Admin wallet not configured. Skipping ledger entry for platform.");
    } else {
      await WalletLedger.create({
        userId: primaryAdmin._id,
        walletId: primaryAdmin.walletId || "N/A",
        reference: payment.transactionReference,
        merchantRef: order._id.toString(),
        type: "CREDIT",
        amount: payment.amountAfterCharge,
        status: "SUCCESS",
        channel: "vigipay",
        beneficiaryAccount: primaryAdmin.walletId,
        rawWebhookPayload: data,
        shopId: payment.shopId,
        shop_ownerId: payment.shopOwnerId,
        shopName: payment.shopName,
        transactionDate: new Date()
      });
      console.log(`Platform treasury (Primary Admin ${primaryAdmin._id}) credited via Vigipay.`);
    }

    // --- Primary Admin (Treasury) Pending Amount ---
    try {
      const primaryAdmin = await User.findOne({ isPrimaryAdmin: true });
      if (primaryAdmin) {
        const deliveryFee = order.delivery_fee || 0;
        const totalProductAmount = order.total_amount - deliveryFee;

        primaryAdmin.pending_amount = (primaryAdmin.pending_amount || 0) + totalProductAmount;
        await primaryAdmin.save();
        console.log(`Vigipay verify – Primary Admin treasury updated with Product Price: ${totalProductAmount} (Delivery fee of ${deliveryFee} excluded)`);
      } else {
        console.warn("Vigipay verify – No Primary Admin found to hold treasury funds.");
      }
    } catch (adminErr) {
      console.error("Vigipay verify – Primary Admin treasury error:", adminErr.message);
    }
    // -----------------------------

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
