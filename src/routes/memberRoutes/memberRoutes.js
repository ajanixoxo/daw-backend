const express = require("express");
const {
  join,
  guestJoin,
  approve,
  listMembers,
  getMember
} = require("../../controllers/Member/member.controller.js");
const { protect, restrictTo } = require("@middlewares/authMiddleware.js");

const router = express.Router();

// CASE 3: Guest joins cooperative (no auth). Creates user + shop + member. If email exists → 400, ask to log in.
router.post("/join/guest", guestJoin);

// Join cooperative: allowed for buyer (CASE 2) and seller (CASE 1). Guest use POST /join/guest.
router.post("/join", protect, restrictTo("buyer", "seller"), join);
router.put("/:id/approve", protect, restrictTo("admin", "cooperative", "member"), approve);
router.get("/cooperative/:cooperativeId", protect, restrictTo("admin", "cooperative", "cooperative_admin", "member", "seller", "buyer"), listMembers);
router.get("/:id", protect, restrictTo("admin", "cooperative", "member"), getMember);

module.exports = router;
