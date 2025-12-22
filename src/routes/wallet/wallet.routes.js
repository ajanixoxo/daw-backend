const express = require("express");
const router = express.Router();
const walletController = require("@controllers/wallet/wallet.controller.js");
const { restrictTo, protect } = require('@middlewares/authMiddleware.js');


router.post('/create/static/Account', protect, restrictTo("seller"), walletController.createStatic);

router.get('/create', protect, restrictTo("Admin"), walletController.getBusinessWallet);

router.post("/charge", protect, restrictTo("Admin"), walletController.getPayoutCharge);

// Account lookup
router.post("/account-lookup", protect,restrictTo("seller", "Admin"), walletController.accountLookup);

// Banks list
router.get("/banks", protect,restrictTo("seller","Admin"), walletController.getBanks);

router.post('/payout', protect,restrictTo("Admin"), walletController.processPayout);

// Update PIN
router.put("/update-pin", protect, restrictTo("Admin"), walletController.updateWalletPin);

router.get("/get/account", protect, restrictTo("seller", "Admin"), walletController.getAccount);

module.exports = router;
