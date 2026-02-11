const express = require("express");
const {
  getCooperativeDashboardStats,
  getRevenueChartData,
  getTopMembers,
  getRecentMembers
} = require("../../controllers/Cooperative/cooperativeDashboard.controller.js");
const { protect, restrictTo } = require("@middlewares/authMiddleware.js");

const router = express.Router();

// All dashboard routes require authentication and cooperative_admin role
router.get(
  "/dashboard/stats",
  protect,
  restrictTo("cooperative_admin", "admin"),
  getCooperativeDashboardStats
);

router.get(
  "/dashboard/revenue",
  protect,
  restrictTo("cooperative_admin", "admin"),
  getRevenueChartData
);

router.get(
  "/dashboard/top-members",
  protect,
  restrictTo("cooperative_admin", "admin"),
  getTopMembers
);

router.get(
  "/dashboard/recent-members",
  protect,
  restrictTo("cooperative_admin", "admin"),
  getRecentMembers
);

module.exports = router;
