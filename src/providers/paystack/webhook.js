const crypto = require("crypto");
const Payment = require("@models/paymentModel/payment.model.js");
const Order = require("@models/marketPlace/orderModel.js");

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
                payment_status: "paid"
              });
            }

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
