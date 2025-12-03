const express = require("express");
const {
  upgradeToSeller,
  upgradeToCooperative
} = require('@controllers/User/user.controller.js');
const { protect } = require("@middlewares/authMiddleware.js");

const router = express.Router();

router.patch('/:id/upgrade/seller', protect, upgradeToSeller);
router.patch('/:id/upgrade/cooperative', protect, upgradeToCooperative);

module.exports = router;

