const express = require("express");
const router = express.Router();
const { getDashboardStats, getPendingCooperatives, getAllUsers, getAnalyticsData } = require("../../controllers/admin/dashboard.controller.js");
const asyncHandler = require("express-async-handler");


// GET /api/admin/dashboard/stats
router.get("/dashboard/stats", getDashboardStats);

// GET /api/admin/cooperatives/pending
// GET /api/admin/cooperatives/pending
// Fetch pending cooperatives for the "Pending Approvals" table
router.get("/cooperatives/pending", getPendingCooperatives);

// GET /api/admin/users
router.get("/users", getAllUsers);

// GET /api/admin/analytics
router.get("/analytics", getAnalyticsData);

module.exports = router;
