const express = require("express");
const router = express.Router();
const { getDashboardStats, getPendingCooperatives, getAllUsers, getAnalyticsData, getUserAnalytics, getCooperativeAnalytics, getRevenueAnalytics, getPendingLoans } = require("../../controllers/admin/dashboard.controller.js");
const asyncHandler = require("express-async-handler");
const { protect, restrictTo } = require("@middlewares/authMiddleware.js");

router.use(protect);
router.use(restrictTo("admin", "support-admin"));


// GET /api/admin/dashboard/stats
router.get("/dashboard/stats", getDashboardStats);

// GET /api/admin/cooperatives/pending
// Fetch pending cooperatives for the "Pending Approvals" table
router.get("/cooperatives/pending", getPendingCooperatives);

// GET /api/admin/dashboard/loans/pending
router.get("/dashboard/loans/pending", getPendingLoans);

// GET /api/admin/users
router.get("/users", getAllUsers);

// GET /api/admin/analytics
router.get("/analytics", getAnalyticsData);

// GET /api/admin/analytics/users
router.get("/analytics/users", getUserAnalytics);

// GET /api/admin/analytics/cooperatives
router.get("/analytics/cooperatives", getCooperativeAnalytics);

// GET /api/admin/analytics/revenue
router.get("/analytics/revenue", getRevenueAnalytics);

module.exports = router;
