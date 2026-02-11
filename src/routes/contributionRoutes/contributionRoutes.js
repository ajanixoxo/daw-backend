const express = require("express");
const {
  createContribution,
  listByMember,
  markPaid,
  getContributionStats,
  listCooperativeContributions,
  getLoanEligibility
} = require("../../controllers/Contribution/contribution.controller.js");
const {
  createContributionType,
  listContributionTypes,
  updateContributionTypeStatus
} = require("../../controllers/Contribution/contributionType.controller.js");
const { protect, restrictTo } = require("@middlewares/authMiddleware.js");

const router = express.Router();

// --- Contribution Type routes ---
router.post(
  "/types",
  protect,
  restrictTo("admin", "cooperative_admin", "cooperative"),
  createContributionType
);
router.get(
  "/types/cooperative/:cooperativeId",
  protect,
  restrictTo("admin", "cooperative_admin", "cooperative", "member", "seller", "buyer"),
  listContributionTypes
);
router.put(
  "/types/:id/status",
  protect,
  restrictTo("admin", "cooperative_admin", "cooperative"),
  updateContributionTypeStatus
);

// --- Cooperative-scoped contribution routes ---
router.get(
  "/cooperative/:cooperativeId/stats",
  protect,
  restrictTo("admin", "cooperative_admin", "cooperative", "member", "seller", "buyer"),
  getContributionStats
);
router.get(
  "/cooperative/:cooperativeId",
  protect,
  restrictTo("admin", "cooperative_admin", "cooperative", "member", "seller", "buyer"),
  listCooperativeContributions
);
router.get(
  "/cooperative/:cooperativeId/loan-eligibility",
  protect,
  restrictTo("admin", "cooperative_admin", "cooperative", "member", "seller", "buyer"),
  getLoanEligibility
);

// --- Original member-scoped routes ---
router.post("/", protect, createContribution);
router.get("/member/:memberId", protect, listByMember);
router.put("/:id/mark-paid", protect, markPaid);

module.exports = router;
