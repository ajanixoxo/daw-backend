const express = require("express");
const router = express.Router();
const withdrawalController = require("@controllers/wallet/withdrawalController.js");
const { protect, restrictTo } = require("@middlewares/authMiddleware.js");

// Logistics Provider routes
router.post(
  "/",
  protect,
  restrictTo("logistics_provider"),
  withdrawalController.requestWithdrawal
);

router.get(
  "/",
  protect,
  withdrawalController.getWithdrawals
);

// Admin only routes
router.patch(
  "/:id/approve",
  protect,
  restrictTo("admin", "super_admin"),
  withdrawalController.approveWithdrawal
);

router.patch(
  "/:id/reject",
  protect,
  restrictTo("admin", "super_admin"),
  withdrawalController.rejectWithdrawal
);

module.exports = router;
