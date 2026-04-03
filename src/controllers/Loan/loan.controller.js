const LoanService = require("../../services/loan.service.js");
const Loan = require("../../models/loanModel/loan.model.js");
const Member = require("../../models/memberModel/member.model.js");
const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");

/**
 * @desc    Apply for a loan
 * @route   POST /api/loans/apply
 */
const applyForLoan = asyncHandler(async (req, res) => {
  const loan = await LoanService.applyForLoan({
    userId: req.user._id,
    ...req.body
  });
  res.status(201).json({ success: true, data: loan });
});

/**
 * @desc    Check eligibility for a specific loan product
 * @route   GET /api/loans/check-eligibility/:loanProductId
 */
const checkEligibility = asyncHandler(async (req, res) => {
  const { loanProductId } = req.params;
  const eligibility = await LoanService.checkLoanEligibility(req.user._id, loanProductId);
  res.status(200).json({ success: true, data: eligibility });
});

/**
 * @desc    Loan Officer acknowledges receipt and starts review
 * @route   PATCH /api/loans/:id/review
 */
const markAsUnderReview = asyncHandler(async (req, res) => {
  const loan = await LoanService.markAsUnderReview(req.params.id);
  res.status(200).json({ success: true, data: loan });
});

/**
 * @desc    Approve loan application
 * @route   PATCH /api/loans/:id/approve
 */
const approveLoan = asyncHandler(async (req, res) => {
  const loan = await LoanService.approve(req.params.id, req.body);
  res.status(200).json({ success: true, data: loan });
});

/**
 * @desc    Reject loan application
 * @route   PATCH /api/loans/:id/reject
 */
const rejectLoan = asyncHandler(async (req, res) => {
  const loan = await LoanService.reject(req.params.id, req.body);
  res.status(200).json({ success: true, data: loan });
});

/**
 * @desc    Mark loan as disbursed (after offline transfer)
 * @route   PATCH /api/loans/:id/disburse
 */
const markAsDisbursed = asyncHandler(async (req, res) => {
  const loan = await LoanService.markAsDisbursed(req.params.id);
  res.status(200).json({ success: true, data: loan });
});

/**
 * @desc    List loans for a specific member (Admin/Officer)
 * @route   GET /api/loans/member/:memberId
 */
const listMemberLoans = asyncHandler(async (req, res) => {
  const loans = await LoanService.getByMember(req.params.memberId);
  res.status(200).json({ success: true, data: loans });
});

/**
 * @desc    List my own loans
 * @route   GET /api/loans/my-loans
 */
const listMyLoans = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const member = await Member.findOne({ userId });
  if (!member) {
    return res.status(200).json({ success: true, data: [] });
  }

  const loans = await LoanService.getByMember(member._id);
  res.status(200).json({ success: true, data: loans });
});

/**
 * @desc    Get loan stats for a cooperative
 * @route   GET /api/loans/cooperative/:cooperativeId/stats
 */
const getLoanStats = asyncHandler(async (req, res) => {
  const { cooperativeId } = req.params;
  const coopObjId = mongoose.Types.ObjectId.createFromHexString(cooperativeId);

  const totalResult = await Loan.aggregate([
    { $match: { cooperativeId: coopObjId, status: { $in: ["approved", "disbursed", "repaid"] } } },
    { $group: { _id: null, total: { $sum: "$amount" } } }
  ]);
  const totalDisbursed = totalResult.length > 0 ? totalResult[0].total : 0;

  const activeLoans = await Loan.countDocuments({
    cooperativeId: coopObjId,
    status: { $in: ["approved", "disbursed"] }
  });

  const totalLoans = await Loan.countDocuments({
    cooperativeId: coopObjId,
    status: { $in: ["approved", "disbursed", "repaid"] }
  });

  const repaidLoans = await Loan.countDocuments({
    cooperativeId: coopObjId,
    status: "repaid"
  });
  const repaymentRate = totalLoans > 0 ? Math.round((repaidLoans / totalLoans) * 1000) / 10 : 0;

  const overdueLoans = await Loan.aggregate([
    { $match: { cooperativeId: coopObjId, status: "disbursed" } },
    {
      $addFields: {
        expectedEnd: {
          $add: [
            "$createdAt",
            { $multiply: [{ $ifNull: ["$durationMonths", 12] }, 30 * 24 * 60 * 60 * 1000] }
          ]
        }
      }
    },
    { $match: { expectedEnd: { $lt: new Date() } } },
    { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$amount" } } }
  ]);
  const overdueCount = overdueLoans.length > 0 ? overdueLoans[0].count : 0;
  const overdueAmount = overdueLoans.length > 0 ? overdueLoans[0].total : 0;

  res.status(200).json({
    success: true,
    data: {
      totalDisbursed,
      activeLoans,
      repaymentRate,
      overdueLoans: overdueCount,
      overdueAmount
    }
  });
});

/**
 * @desc    List all loans for a cooperative
 * @route   GET /api/loans/cooperative/:cooperativeId
 */
const listCooperativeLoans = asyncHandler(async (req, res) => {
  const { cooperativeId } = req.params;
  const { status } = req.query;

  const filter = { cooperativeId };
  if (status) {
    filter.status = status;
  }

  const loans = await Loan.find(filter)
    .populate({
      path: "memberId",
      populate: { path: "userId", select: "firstName lastName email" }
    })
    .populate("loanProductId", "name")
    .sort({ createdAt: -1 })
    .lean();

  const formatted = loans.map(loan => {
    const totalRepaid = (loan.repayments || []).reduce((sum, r) => sum + (r.amount || 0), 0);
    const outstanding = Math.max(0, loan.amount - totalRepaid);
    return {
      _id: loan._id,
      member: loan.memberId?.userId
        ? `${loan.memberId.userId.firstName} ${loan.memberId.userId.lastName}`
        : "Unknown",
      email: loan.memberId?.userId?.email || "",
      loanProduct: loan.loanProductId?.name || "N/A",
      amount: loan.amount,
      outstanding,
      interestRate: loan.interestRate,
      purpose: loan.purpose || "",
      durationMonths: loan.durationMonths || 0,
      status: loan.status,
      createdAt: loan.createdAt,
      dueDate: loan.durationMonths
        ? new Date(new Date(loan.createdAt).getTime() + loan.durationMonths * 30 * 24 * 60 * 60 * 1000).toISOString()
        : null,
      repayments: loan.repayments || []
    };
  });

  res.status(200).json({
    success: true,
    data: formatted
  });
});

module.exports = {
  applyForLoan,
  checkEligibility,
  markAsUnderReview,
  approveLoan,
  rejectLoan,
  markAsDisbursed,
  listMemberLoans,
  getLoanStats,
  listCooperativeLoans,
  listMyLoans
};
