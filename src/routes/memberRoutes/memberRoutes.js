const express = require("express");
const {
  join,
  approve,
  listMembers,
  getMember
} = require("../../controllers/Member/member.controller.js");
const { protect, restrictTo } = require("@middlewares/authMiddleware.js");

const router = express.Router();

router.post("/join",protect, restrictTo("buyer"),  join);
router.put("/:id/approve", protect, restrictTo("admin,cooperative"), approve);
router.get("/cooperative/:cooperativeId", protect, restrictTo("admin,cooperative"), listMembers);
router.get("/:id", protect, restrictTo("admin,cooperative"), getMember);

module.exports = router;
