const express = require("express");
const {
  createCooperative,
  listCooperatives,
  getCooperative,
  updateCooperative
} = require("../../controllers/Cooperative/cooperative.controller.js");
const { protect, restrictTo } = require("@middlewares/authMiddleware.js");

const router = express.Router();

router.post("/", protect, restrictTo("admin", "cooperative"), createCooperative);
router.put("/", protect, restrictTo("admin", "cooperative"), updateCooperative); 
router.get("/", protect, restrictTo("admin", "seller","buyer","cooperative"), listCooperatives);
router.get("/:id", protect, restrictTo("admin", "seller","buyer","cooperative"), getCooperative);


module.exports = router;
