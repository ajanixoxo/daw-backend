import express from "express";
import {
  createTier,
  listTiers,
  updateTier
} from "../../controllers/Tier/tier.controller.js";

const router = express.Router();

router.post("/", protect, restrictTo("admin,cooperative_admin"), createTier);
router.get("/cooperative/:cooperativeId", protect, restrictTo("admin,registered_shopper,seller"), listTiers);
router.put("/:id", protect, restrictTo("admin,cooperative_admin"), updateTier);

export default router;
