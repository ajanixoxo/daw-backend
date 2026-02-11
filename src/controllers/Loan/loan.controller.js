const LoanService = require("../../services/loan.service.js");
const Loan = require("../../models/loanModel/loan.model.js");
const Member = require("../../models/memberModel/member.model.js");
const mongoose = require("mongoose");

/**
 * Controller goals:
 * - applyForLoan: member requests loan
 * - approveLoan: admin approves loan
 * - rejectLoan: admin rejects loan
 * - listLoans: member's loans
 * - getLoanStats: cooperative-scoped stats
 * - listCooperativeLoans: all loans for a cooperative (with optional status filter)
 */

const applyForLoan = async (req, res) => {
  try {
    const loan = await LoanService.applyForLoan(req.body);
    return res.status(201).json({ success: true, data: loan });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const approveLoan = async (req, res) => {
  try {
    const loan = await LoanService.approve(req.params.id, req.body);
    return res.json({ success: true, data: loan });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const rejectLoan = async (req, res) => {
  try {
    const loan = await Loan.findByIdAndUpdate(
      req.params.id,
      { status: "rejected" },
      { new: true }
    );
    if (!loan) {
      return res.status(404).json({ success: false, message: "Loan not found" });
    }
    return res.json({ success: true, data: loan });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const listMemberLoans = async (req, res) => {
  try {
    const loans = await LoanService.getByMember(req.params.memberId);
    return res.json({ success: true, data: loans });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * Get loan stats for a cooperative
 */
const getLoanStats = async (req, res) => {
  try {
    const { cooperativeId } = req.params;
    const coopObjId = mongoose.Types.ObjectId.createFromHexString(cooperativeId);

    // Total disbursed (approved + disbursed + repaid)
    const totalResult = await Loan.aggregate([
      { $match: { cooperativeId: coopObjId, status: { $in: ["approved", "disbursed", "repaid"] } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalDisbursed = totalResult.length > 0 ? totalResult[0].total : 0;

    // Active loans (approved or disbursed)
    const activeLoans = await Loan.countDocuments({
      cooperativeId: coopObjId,
      status: { $in: ["approved", "disbursed"] }
    });

    // Total loans (for repayment rate calculation)
    const totalLoans = await Loan.countDocuments({
      cooperativeId: coopObjId,
      status: { $in: ["approved", "disbursed", "repaid"] }
    });

    // Repaid loans
    const repaidLoans = await Loan.countDocuments({
      cooperativeId: coopObjId,
      status: "repaid"
    });
    const repaymentRate = totalLoans > 0 ? Math.round((repaidLoans / totalLoans) * 1000) / 10 : 0;

    // Overdue: loans that are disbursed and past their expected end date
    // For simplicity, count disbursed loans older than their durationMonths
    const overdueLoans = await Loan.aggregate([
      {
        $match: {
          cooperativeId: coopObjId,
          status: "disbursed"
        }
      },
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

    return res.status(200).json({
      success: true,
      data: {
        totalDisbursed,
        activeLoans,
        repaymentRate,
        overdueLoans: overdueCount,
        overdueAmount
      }
    });
  } catch (err) {
    console.error("Error fetching loan stats:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * List all loans for a cooperative, optionally filtered by status
 * Query params: ?status=pending|approved|disbursed|rejected|repaid
 */
const listCooperativeLoans = async (req, res) => {
  try {
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
      .populate("subscriptionTierId", "name")
      .sort({ createdAt: -1 })
      .lean();

    // Flatten for frontend
    const formatted = loans.map(loan => {
      const totalRepaid = (loan.repayments || []).reduce((sum, r) => sum + (r.amount || 0), 0);
      const outstanding = Math.max(0, loan.amount - totalRepaid);
      return {
        _id: loan._id,
        member: loan.memberId?.userId
          ? `${loan.memberId.userId.firstName} ${loan.memberId.userId.lastName}`
          : "Unknown",
        email: loan.memberId?.userId?.email || "",
        category: loan.subscriptionTierId?.name || "N/A",
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

    return res.status(200).json({
      success: true,
      data: formatted
    });
  } catch (err) {
    console.error("Error listing cooperative loans:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  applyForLoan,
  approveLoan,
  rejectLoan,
  listMemberLoans,
  getLoanStats,
  listCooperativeLoans
};
