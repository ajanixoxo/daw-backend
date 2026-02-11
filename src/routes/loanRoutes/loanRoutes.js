const express = require("express");
const {
  applyForLoan,
  approveLoan,
  rejectLoan,
  listMemberLoans,
  getLoanStats,
  listCooperativeLoans
} = require("../../controllers/Loan/loan.controller.js");
const { protect, restrictTo } = require("@middlewares/authMiddleware.js");

const router = express.Router();

// --- Cooperative-scoped routes ---
router.get(
  "/cooperative/:cooperativeId/stats",
  protect,
  restrictTo("admin", "cooperative_admin", "cooperative", "member", "seller", "buyer"),
  getLoanStats
);
router.get(
  "/cooperative/:cooperativeId",
  protect,
  restrictTo("admin", "cooperative_admin", "cooperative", "member", "seller", "buyer"),
  listCooperativeLoans
);

// --- Loan lifecycle ---
router.post("/apply", protect, applyForLoan);
router.put(
  "/:id/approve",
  protect,
  restrictTo("admin", "cooperative_admin", "cooperative"),
  approveLoan
);
router.put(
  "/:id/reject",
  protect,
  restrictTo("admin", "cooperative_admin", "cooperative"),
  rejectLoan
);

// --- Member-scoped ---
router.get("/member/:memberId", protect, listMemberLoans);

module.exports = router;
