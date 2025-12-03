const express = require("express");
const {
  createContribution,
  listByMember,
  markPaid
} = require("../../controllers/Contribution/contribution.controller.js");

const router = express.Router();

router.post("/", createContribution);
router.get("/member/:memberId", listByMember);
router.put("/:id/mark-paid", markPaid);

module.exports = router;
