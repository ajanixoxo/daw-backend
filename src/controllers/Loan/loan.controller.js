const LoanService = require("../../services/loan.service.js");

/**
 * Controller goals:
 * - applyForLoan: member requests loan
 * - approveLoan: admin approves loan
 * - listLoans: member's loans
 */

const applyForLoan = async (req, res) => {
  try {
    const loan = await LoanService.applyForLoan(req.body);
    return res.status(201).json({ loan });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

const approveLoan = async (req, res) => {
  try {
    const loan = await LoanService.approve(req.params.id, req.body);
    return res.json({ loan });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

const listMemberLoans = async (req, res) => {
  try {
    const loans = await LoanService.getByMember(req.params.memberId);
    return res.json({ loans });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

module.exports = {
  applyForLoan,
  approveLoan,
  listMemberLoans
};
