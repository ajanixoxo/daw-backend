import express from "express";
import {
  join,
  approve,
  listMembers,
  getMember
} from "../../controllers/Member/member.controller.js";

const router = express.Router();

router.post("/join",protect, restrictTo("registered_shopper"),  join);
router.put("/:id/approve", protect, restrictTo("admin,cooperative_admin"), approve);
router.get("/cooperative/:cooperativeId", protect, restrictTo("admin,cooperative_admin"), listMembers);
router.get("/:id", protect, restrictTo("admin,cooperative_admin"), getMember);

export default router;
