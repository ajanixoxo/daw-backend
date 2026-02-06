const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../../controllers/admin/dashboard.controller.js');
const Cooperative = require('@models/cooperativeModel/cooperative.model.js');
const asyncHandler = require('express-async-handler');


// GET /api/admin/dashboard/stats
router.get('/dashboard/stats', getDashboardStats);

// GET /api/admin/cooperatives/pending
// Fetch pending cooperatives for the "Pending Approvals" table
router.get('/cooperatives/pending', asyncHandler(async (req, res) => {
    const pendingCoops = await Cooperative.find({ status: 'pending' })
        .select('name description logoUrl createdAt adminId')
        .populate('adminId', 'firstName lastName email')
        .sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        count: pendingCoops.length,
        data: pendingCoops
    });
}));

module.exports = router;
