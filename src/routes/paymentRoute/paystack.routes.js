const router = require("express").Router();
const { initializePayment } = require("../../providers/paystack/index.js");
const { verifyPayment } = require("../../providers/paystack/verify.js");
const { handleWebhook } = require("../../providers/paystack/webhook.js");
const { protect } = require("../../middlewares/authMiddleware.js");


router.post("/paystack/initialize", protect, initializePayment);

router.post("/paystack/verify", protect, verifyPayment);

module.exports = router;
