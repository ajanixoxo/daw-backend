import express from "express";
import {
  createCooperative,
  listCooperatives,
  getCooperative,
  updateCooperative
} from "../../controllers/Cooperative/cooperative.controller.js";

const router = express.Router();

router.post("/", protect, restrictTo("admin"), createCooperative);
router.put("/", protect, restrictTo("admin,cooperative_admin"), updateCooperative); 
router.get("/", protect, restrictTo("admin,registered_shopper"), listCooperatives);
router.get("/:id", protect, restrictTo("admin,registered_shopper,cooperative_admin"), getCooperative);
router.put("/:id", protect, restrictTo("admin,cooperative_admin"), updateCooperative);

export default router;
