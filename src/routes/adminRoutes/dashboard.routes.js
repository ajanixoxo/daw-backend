const express = require('express');
const router = express.Router();
const { getDashboardStats, getPendingCooperatives } = require('../../controllers/admin/dashboard.controller.js');
const asyncHandler = require('express-async-handler');


// GET /api/admin/dashboard/stats
router.get('/dashboard/stats', getDashboardStats);

// GET /api/admin/cooperatives/pending
// Fetch pending cooperatives for the "Pending Approvals" table
router.get('/cooperatives/pending', getPendingCooperatives);

module.exports = router;
