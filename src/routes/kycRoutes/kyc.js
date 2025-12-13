const express = require('express');
const kycController = require('@controllers/KYC/kycController.js');

const router = express.Router();

// Verify NIN endpoint
router.post('/verify-nin', kycController.verifyNIN);

module.exports = router;






