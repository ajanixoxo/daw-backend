const ContributionService = require("../../services/contribution.service.js");
const Contribution = require("../../models/contributionModel/contribution.model.js");
const Member = require("../../models/memberModel/member.model.js");
const Cooperative = require("../../models/cooperativeModel/cooperative.model.js");

/**
 * Controller goals:
 * - trigger payment creation (manual/for testing)
 * - list contributions for a member
 * - mark payment as received (update status + transaction info)
 * - cooperative-scoped stats, listings, and loan eligibility
 */

const createContribution = async (req, res) => {
  try {
    const c = await ContributionService.createContribution(req.body);
    return res.status(201).json({ contribution: c });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

const listByMember = async (req, res) => {
  try {
    const list = await ContributionService.getMemberContributions(req.params.memberId);
    return res.json(list);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

const markPaid = async (req, res) => {
  try {
    const updated = await ContributionService.markPaid(req.params.id, req.body);
    return res.json({ contribution: updated });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

/**
 * Get contribution stats for a cooperative
 * Returns: totalContributions, activeMembers, loanEligible, overdueContributions
 */
const getContributionStats = async (req, res) => {
  try {
    const { cooperativeId } = req.params;

    // Total contribution amount (only paid)
    const totalResult = await Contribution.aggregate([
      { $match: { cooperativeId: require("mongoose").Types.ObjectId.createFromHexString(cooperativeId), status: "paid" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalContributions = totalResult.length > 0 ? totalResult[0].total : 0;

    // Active contributors: members who have at least 1 paid contribution
    const activeContributors = await Contribution.distinct("memberId", {
      cooperativeId: require("mongoose").Types.ObjectId.createFromHexString(cooperativeId),
      status: "paid"
    });

    // Overdue contributions
    const overdueResult = await Contribution.aggregate([
      { $match: { cooperativeId: require("mongoose").Types.ObjectId.createFromHexString(cooperativeId), status: "missed" } },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$amount" } } }
    ]);
    const overdueCount = overdueResult.length > 0 ? overdueResult[0].count : 0;
    const overdueAmount = overdueResult.length > 0 ? overdueResult[0].total : 0;

    // Loan eligible: members with 3+ paid contributions
    const loanEligibleResult = await Contribution.aggregate([
      { $match: { cooperativeId: require("mongoose").Types.ObjectId.createFromHexString(cooperativeId), status: "paid" } },
      { $group: { _id: "$memberId", paidCount: { $sum: 1 } } },
      { $match: { paidCount: { $gte: 3 } } },
      { $count: "eligible" }
    ]);
    const loanEligible = loanEligibleResult.length > 0 ? loanEligibleResult[0].eligible : 0;

    return res.status(200).json({
      success: true,
      data: {
        totalContributions,
        activeMembers: activeContributors.length,
        loanEligible,
        overdueContributions: overdueCount,
        overdueAmount
      }
    });
  } catch (err) {
    console.error("Error fetching contribution stats:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * List all contributions for a cooperative (populated with member name & type)
 */
const listCooperativeContributions = async (req, res) => {
  try {
    const { cooperativeId } = req.params;

    const contributions = await Contribution.find({ cooperativeId })
      .populate({
        path: "memberId",
        populate: { path: "userId", select: "firstName lastName email" }
      })
      .populate("contributionTypeId", "name type")
      .sort({ createdAt: -1 })
      .lean();

    // Flatten for frontend consumption
    const formatted = contributions.map(c => ({
      _id: c._id,
      member: c.memberId?.userId
        ? `${c.memberId.userId.firstName} ${c.memberId.userId.lastName}`
        : "Unknown",
      email: c.memberId?.userId?.email || "",
      type: c.contributionTypeId?.name || c.month || "N/A",
      amount: c.amount,
      date: c.paidAt || c.createdAt,
      status: c.status
    }));

    return res.status(200).json({
      success: true,
      data: formatted
    });
  } catch (err) {
    console.error("Error listing cooperative contributions:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get loan eligibility data for cooperative members
 * Shows each member's contribution months and eligibility status
 */
const getLoanEligibility = async (req, res) => {
  try {
    const { cooperativeId } = req.params;
    const mongoose = require("mongoose");

    // Aggregate paid contributions by member and type
    const memberContributions = await Contribution.aggregate([
      { $match: { cooperativeId: mongoose.Types.ObjectId.createFromHexString(cooperativeId) } },
      {
        $group: {
          _id: { memberId: "$memberId", contributionTypeId: "$contributionTypeId" },
          totalContributions: { $sum: "$amount" },
          paidMonths: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] } }
        }
      }
    ]);

    // Populate member user info
    const populatedResults = [];
    for (const mc of memberContributions) {
      const member = await Member.findById(mc._id.memberId)
        .populate("userId", "firstName lastName email")
        .lean();

      if (!member || !member.userId) {continue;}

      // Get contribution type name
      let typeName = "N/A";
      if (mc._id.contributionTypeId) {
        const ContributionType = require("../../models/contributionModel/contributionType.model.js");
        const ct = await ContributionType.findById(mc._id.contributionTypeId).lean();
        typeName = ct?.name || "N/A";
      }

      // Determine eligibility: 3+ months of paid contributions = eligible
      let eligibilityStatus = "ineligible";
      if (mc.paidMonths >= 3) {
        eligibilityStatus = "eligible";
      } else if (mc.paidMonths > 0) {
        eligibilityStatus = "under_review";
      }

      populatedResults.push({
        memberId: mc._id.memberId,
        memberName: `${member.userId.firstName} ${member.userId.lastName}`,
        email: member.userId.email,
        totalContributions: mc.totalContributions,
        type: typeName,
        contributionMonths: mc.paidMonths,
        status: eligibilityStatus
      });
    }

    return res.status(200).json({
      success: true,
      data: populatedResults
    });
  } catch (err) {
    console.error("Error fetching loan eligibility:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createContribution,
  listByMember,
  markPaid,
  getContributionStats,
  listCooperativeContributions,
  getLoanEligibility
};
