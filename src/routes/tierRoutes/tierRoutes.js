import express from "express";
import {
  createTier,
  listTiers,
  updateTier
} from "../../controllers/Tier/tier.controller.js";

const router = express.Router();

router.post("/", createTier);
router.get("/cooperative/:cooperativeId", listTiers);
router.put("/:id", updateTier);

export default router;
