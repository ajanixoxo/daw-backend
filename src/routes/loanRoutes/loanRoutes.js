import express from "express";
import {
  applyForLoan,
  approveLoan,
  listMemberLoans
} from "../../controllers/Loan/loan.controller.js";

const router = express.Router();

router.post("/apply", applyForLoan);
router.put("/:id/approve", approveLoan);
router.get("/member/:memberId", listMemberLoans);

export default router;
