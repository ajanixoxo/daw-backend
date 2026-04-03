const express = require("express");
const router = express.Router();
const walletController = require("@controllers/wallet/wallet.controller.js");
const { restrictTo, protect } = require("@middlewares/authMiddleware.js");


router.post("/create/static/Account", protect, restrictTo("seller", "cooperative_admin"), walletController.createStatic);

router.get("/create", protect, restrictTo("admin", "support-admin", "cooperative_admin"), walletController.getBusinessWallet);

router.post("/charge", protect, restrictTo("admin", "cooperative_admin"), walletController.getPayoutCharge);

// Account lookup
router.post("/account-lookup", protect, restrictTo("seller", "admin", "support-admin", "cooperative_admin"), walletController.accountLookup);

// Banks list
router.get("/banks", protect, restrictTo("seller", "admin", "support-admin", "cooperative_admin"), walletController.getBanks);

router.get("/balance", protect, restrictTo("seller", "admin", "support-admin", "cooperative_admin"), walletController.getMyWalletBalance);


router.post("/payout", protect, restrictTo("admin", "cooperative_admin"), walletController.processPayout);

// Update PIN
router.put("/update-pin", protect, restrictTo("admin", "cooperative_admin"), walletController.updateWalletPin);

router.get("/get/account", protect, restrictTo("seller", "cooperative_admin"), walletController.getAccount);

router.get("/ledger", protect, restrictTo("admin", "seller", "support-admin", "buyer", "member", "cooperative_admin"), walletController.walletLedgerController);

router.post("/transfer/money", protect, restrictTo("seller", "cooperative_admin"), walletController.payFromStaticWallet);

module.exports = router;
