const express = require("express");
const {
  createTier,
  listTiers,
  updateTier
} = require("../../controllers/Tier/tier.controller.js");
const { protect, restrictTo } = require("@middlewares/authMiddleware.js");

const router = express.Router();

router.post("/", protect, restrictTo("admin,cooperative_admin"), createTier);
router.get("/cooperative/:cooperativeId", protect, restrictTo("admin,registered_shopper,seller"), listTiers);
router.put("/:id", protect, restrictTo("admin,cooperative_admin"), updateTier);

module.exports = router;
