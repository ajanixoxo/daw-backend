const express = require("express");
const {
  applyForLoan,
  approveLoan,
  rejectLoan,
  listMemberLoans,
  getLoanStats,
  listCooperativeLoans,
  listMyLoans,
  checkEligibility,
  markAsUnderReview,
  markAsDisbursed
} = require("../../controllers/Loan/loan.controller.js");
const {
  createLoanProduct,
  getAllLoanProducts,
  getLoanProductById,
  updateLoanProduct,
  deleteLoanProduct
} = require("../../controllers/Loan/loanProduct.controller.js");
const { protect, restrictTo } = require("../../middlewares/authMiddleware.js");

const router = express.Router();

// --- Loan Products (Admin/Cooperative managed) ---
router.get("/products", protect, getAllLoanProducts);
router.get("/products/:id", protect, getLoanProductById);
router.post(
  "/products",
  protect,
  restrictTo("admin", "cooperative_admin"),
  createLoanProduct
);
router.patch(
  "/products/:id",
  protect,
  restrictTo("admin", "cooperative_admin"),
  updateLoanProduct
);
router.delete(
  "/products/:id",
  protect,
  restrictTo("admin", "cooperative_admin"),
  deleteLoanProduct
);


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
router.get("/check-eligibility/:loanProductId", protect, checkEligibility);
router.patch(
  "/:id/review",
  protect,
  restrictTo("admin", "cooperative_admin"),
  markAsUnderReview
);
router.patch(
  "/:id/approve",
  protect,
  restrictTo("admin", "cooperative_admin"),
  approveLoan
);
router.patch(
  "/:id/reject",
  protect,
  restrictTo("admin", "cooperative_admin"),
  rejectLoan
);
router.patch(
  "/:id/disburse",
  protect,
  restrictTo("admin", "cooperative_admin"),
  markAsDisbursed
);

// --- Member-scoped ---
router.get("/my-loans", protect, listMyLoans);
router.get("/history", protect, listMyLoans); // Alias for compatibility
router.get("/member/:memberId", protect, listMemberLoans);

module.exports = router;
