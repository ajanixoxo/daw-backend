import express from "express";
import {
  createContribution,
  listByMember,
  markPaid
} from "../../controllers/Contribution/contribution.controller.js";

const router = express.Router();

router.post("/", createContribution);
router.get("/member/:memberId", listByMember);
router.put("/:id/mark-paid", markPaid);

export default router;
