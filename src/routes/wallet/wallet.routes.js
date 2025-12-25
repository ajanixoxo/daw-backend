const express = require("express");
const router = express.Router();
const walletController = require("@controllers/wallet/wallet.controller.js");
const { restrictTo, protect } = require('@middlewares/authMiddleware.js');


router.post('/create/static/Account', protect, restrictTo("seller"), walletController.createStatic);

router.get('/create', protect, restrictTo("admin"), walletController.getBusinessWallet);

router.post("/charge", protect, restrictTo("admin"), walletController.getPayoutCharge);

// Account lookup
router.post("/account-lookup", protect,restrictTo("seller", "admin"), walletController.accountLookup);

// Banks list
router.get("/banks", protect,restrictTo("seller","admin"), walletController.getBanks);

router.post('/payout', protect,restrictTo("admin"), walletController.processPayout);

// Update PIN
router.put("/update-pin", protect, restrictTo("admin"), walletController.updateWalletPin);

router.get("/get/account", protect, restrictTo("seller", "admin"), walletController.getAccount);

router.get('/ledger', protect, restrictTo('admin'), walletController.walletLedgerController);
module.exports = router;
