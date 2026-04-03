const router = require("express").Router();
const { createOrder } = require("../../providers/paypal/index.js");
const { captureOrder } = require("../../providers/paypal/capture.js");
const { handleWebhook } = require("../../providers/paypal/webhook.js");
const { protect } = require("../../middlewares/authMiddleware.js");


router.post("/paypal/create-order", protect, createOrder);

router.post("/paypal/capture-order", protect, captureOrder);

module.exports = router;
