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
router.put("/", protect, restrictTo("admin,cooperative_admin"), updateCooperative); 
router.get("/", protect, restrictTo("admin,registered_shopper"), listCooperatives);
router.get("/:id", protect, restrictTo("admin,registered_shopper,cooperative_admin"), getCooperative);
router.put("/:id", protect, restrictTo("admin,cooperative_admin"), updateCooperative);

module.exports = router;
