const express = require("express");
const router = express.Router();
const walletController = require("@controllers/wallet/wallet.controller.js");
const { restrictTo, protect } = require('@middlewares/authMiddleware.js');


router.post('/create/static/Account', protect, restrictTo("seller"), walletController.createStatic);

router.get('/create', protect, restrictTo("seller"), walletController.getBusinessWallet);

router.post("/charge", protect, restrictTo("seller"), walletController.getPayoutCharge);

// Account lookup
router.post("/account-lookup", protect,restrictTo("seller"), walletController.accountLookup);

// Banks list
router.get("/banks", protect,restrictTo("seller"), walletController.getBanks);

router.post('/payout', protect,restrictTo("seller"), walletController.processPayout);

// Update PIN
router.put("/update-pin", protect, restrictTo("seller"), walletController.updateWalletPin);

module.exports = router;
