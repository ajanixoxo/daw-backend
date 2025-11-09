import express from "express";
import {
  createCooperative,
  listCooperatives,
  getCooperative,
  updateCooperative
} from "../../controllers/Cooperative/cooperative.controller.js";

const router = express.Router();

router.post("/", createCooperative);
router.get("/", listCooperatives);
router.get("/:id", getCooperative);
router.put("/:id", updateCooperative);

export default router;
