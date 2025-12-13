const express = require('express');
const { protect } = require('@middlewares/authMiddleware.js');
const kycController = require('@controllers/KYC/kycController.js');

const router = express.Router();

// Verify NIN endpoint
router.post('/verify-nin', protect, kycController.verifyNIN);

module.exports = router;






