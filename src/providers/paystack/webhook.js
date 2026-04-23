const crypto = require("crypto");
const Payment = require("@models/paymentModel/payment.model.js");
const Order = require("@models/marketPlace/orderModel.js");
const User = require("@models/userModel/user.js");
const Shop = require("@models/marketPlace/shopModel.js");
const WalletLedger = require("@models/walletLedger/ledger.js");
const marketplaceService = require("@services/marketPlace/marketPlaceServices.js");

const verifySignature = (req) => {
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest("hex");

  return hash === req.headers["x-paystack-signature"];
};

exports.handleWebhook = async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production") {
      if (!verifySignature(req)) {
        console.warn("Paystack webhook: invalid signature");
        return res
          .status(400)
          .json({ success: false, message: "Invalid webhook signature" });
      }
    }

    const event = req.body;
    const eventType = event?.event;
    const data = event?.data;

    console.log(`Paystack webhook received: ${eventType}`);

    switch (eventType) {
      case "charge.success": {
        const reference = data?.reference;

        if (reference) {
          const payment = await Payment.findOne({
            transactionReference: reference
          });

          if (payment && payment.paystackStatus !== "successful") {
            payment.paystackStatus = "successful";
            payment.rawResponse = data;
            await payment.save();

            if (payment.orderId) {
              await Order.findByIdAndUpdate(payment.orderId, {
                payment_status: "paid",
                status: "processing"
              });

              // 🔹 Notify logistics provider(s)
              const orderIdList = payment.orderId.split(",");
              for (const currentOrderId of orderIdList) {
                const trimmedOrderId = currentOrderId.trim();
                await marketplaceService.assignAndNotifyLogistics(trimmedOrderId).catch(err => {
                  console.error(`Failed to notify logistics for order ${trimmedOrderId} in Paystack webhook:`, err.message);
                });
              }
            }

            // --- Wallet Ledger ---
            try {
              const user = await User.findById(payment.userId);
              await WalletLedger.findOneAndUpdate(
                { reference },
                {
                  $setOnInsert: {
                    userId: payment.userId,
                    walletId: user?.walletId || "N/A",
                    reference,
                    type: "CREDIT",
                    amount: payment.amount,
                    status: "SUCCESS",
                    channel: "paystack",
                    rawWebhookPayload: data,
                    shopId: payment.shopId,
                    shop_ownerId: payment.shopOwnerId,
                    shopName: payment.shopName,

                    transactionDate: new Date(),
                  },
                },
                { upsert: true, new: true },
              );
              console.log(`Paystack webhook – wallet ledger created for reference: ${reference}`);
            } catch (ledgerErr) {
              console.error("Paystack webhook – wallet ledger error:", ledgerErr.message);
            }
            // ---------------------

            // --- Primary Admin (Treasury) Pending Amount ---
            try {
              const order = await Order.findById(payment.orderId);
              const primaryAdmin = await User.findOne({ isPrimaryAdmin: true });
              if (primaryAdmin && order) {
                const deliveryFee = order.delivery_fee || 0;
                const totalProductAmount = payment.amount - deliveryFee;
                
                primaryAdmin.pending_amount = (primaryAdmin.pending_amount || 0) + totalProductAmount;
                await primaryAdmin.save();
                console.log(`Paystack webhook – Primary Admin treasury updated with Product Price: ${totalProductAmount} (Delivery fee of ${deliveryFee} excluded)`);
              } else {
                console.warn("Paystack webhook – Primary Admin or Order not found to hold treasury funds.");
              }
            } catch (adminErr) {
              console.error("Paystack webhook – Primary Admin treasury error:", adminErr.message);
            }
            // -----------------------------

            console.log(
              `Paystack payment marked successful for order: ${payment.orderId}`
            );
          }
        }
        break;
      }

      case "charge.failed":
      case "transfer.failed":
      case "transfer.reversed": {
        const reference = data?.reference;

        if (reference) {
          const payment = await Payment.findOne({
            transactionReference: reference
          });

          if (payment) {
            payment.paystackStatus = "failed";
            payment.rawResponse = data;
            await payment.save();
            console.log(
              `Paystack payment failed/reversed for order: ${payment.orderId}`
            );
          }
        }
        break;
      }

      default:
        console.log(`Paystack webhook: unhandled event type "${eventType}"`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Paystack webhook handler error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};
