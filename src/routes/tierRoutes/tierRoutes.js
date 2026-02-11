const express = require("express");
const {
  createTier,
  listTiers,
  updateTier
} = require("../../controllers/Tier/tier.controller.js");
const { protect, restrictTo } = require("@middlewares/authMiddleware.js");

const router = express.Router();

router.post("/", protect, restrictTo("admin", "cooperative", "member"), createTier);
router.get("/cooperative/:cooperativeId", protect, restrictTo("admin", "buyer", "seller"), listTiers);
router.put("/:id", protect, restrictTo("admin", "cooperative", "member"), updateTier);

module.exports = router;
