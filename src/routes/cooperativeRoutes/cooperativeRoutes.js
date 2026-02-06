const express = require("express");
const {
  getDAWCooperative,
  createCooperative,
  listCooperatives,
  getCooperative,
  updateCooperative
} = require("../../controllers/Cooperative/cooperative.controller.js");
const { protect, restrictTo } = require("@middlewares/authMiddleware.js");

const router = express.Router();

// Public: get the single DAW cooperative and its tiers (no auth)
router.get("/daw", getDAWCooperative);

router.post("/", protect, restrictTo("admin", "cooperative"), createCooperative);//make it admin specific
router.put("/", protect, restrictTo("admin", "cooperative"), updateCooperative); 
router.get("/", protect, restrictTo("admin", "seller","buyer","cooperative"), listCooperatives);
router.get("/:id", protect, restrictTo("admin", "seller","buyer","cooperative"), getCooperative);


module.exports = router;
