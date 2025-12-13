const express = require("express");
const {
  createCooperative,
  listCooperatives,
  getCooperative,
  updateCooperative
} = require("../../controllers/Cooperative/cooperative.controller.js");
const { protect, restrictTo } = require("@middlewares/authMiddleware.js");

const router = express.Router();

router.post("/", protect, restrictTo("seller","buyer"), createCooperative);
router.put("/", protect, restrictTo("seller","buyer"), updateCooperative); 
router.get("/", protect, restrictTo("seller","buyer","cooperative"), listCooperatives);
router.get("/:id", protect, getCooperative);


module.exports = router;
