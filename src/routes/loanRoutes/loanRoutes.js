const express = require("express");
const {
  applyForLoan,
  approveLoan,
  listMemberLoans
} = require("../../controllers/Loan/loan.controller.js");

const router = express.Router();

router.post("/apply", applyForLoan);
router.put("/:id/approve", approveLoan);
router.get("/member/:memberId", listMemberLoans);

module.exports = router;
