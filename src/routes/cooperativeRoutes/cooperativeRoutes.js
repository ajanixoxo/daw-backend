const express = require("express");
const {
  createCooperative,
  listCooperatives,
  getCooperative,
  updateCooperative
} = require("../../controllers/Cooperative/cooperative.controller.js");
const { protect, restrictTo } = require("@middlewares/authMiddleware.js");

const router = express.Router();

router.post("/", protect, restrictTo("admin"), createCooperative);
router.put("/", protect, restrictTo("admin", "cooperative"), updateCooperative); 
router.get("/", protect, restrictTo("admin", "buyer"), listCooperatives);
router.get("/:id", protect, restrictTo("admin", "buyer", "cooperative"), getCooperative);
router.put("/:id", protect, restrictTo("admin", "cooperative"), updateCooperative);

module.exports = router;
