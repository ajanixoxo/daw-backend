const router = require("express").Router();
const {
  createPayment
} = require("../../provider/vigipaySling/index.js");
const {
  verifyPayment
} = require("../../provider/vigipaySling/verify.payment.js");
const { protect } = require("../../middlewares/authMiddleware.js");

router.post("/payment/initiate", protect, createPayment);
router.get("/payment/verify/:reference", verifyPayment);

module.exports = router;
