import express from "express";
import {
  join,
  approve,
  listMembers,
  getMember
} from "../../controllers/Member/member.controller.js";

const router = express.Router();

router.post("/join", join);
router.put("/:id/approve", approve);
router.get("/cooperative/:cooperativeId", listMembers);
router.get("/:id", getMember);

export default router;
