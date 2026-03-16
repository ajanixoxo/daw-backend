const ContributionService = require("../../services/contribution.service.js");
const Contribution = require("../../models/contributionModel/contribution.model.js");
const Member = require("../../models/memberModel/member.model.js");
const Cooperative = require("../../models/cooperativeModel/cooperative.model.js");
const Payment = require("../../models/paymentModel/payment.model.js");
const User = require("../../models/userModel/user.js");
const WalletLedger = require("../../models/walletLedger/ledger.js");
const vigipayClient = require("../../utils/vigipayClient/vigipayClient.js");

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

const listMyContributions = async (req, res) => {
  try {
    const userId = req.user._id;
    const Member = require("../../models/memberModel/member.model.js");
    
    // Find member by user ID
    const member = await Member.findOne({ userId });
    
    // If no member found, return empty list or specific error? 
    // Return empty list is safer for UI
    if (!member) {
      return res.json([]);
    }

    const list = await ContributionService.getMemberContributions(member._id);
    return res.json(list);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

const getContributionSummary = async (req, res) => {
  try {
    const userId = req.user._id;
    const Member = require("../../models/memberModel/member.model.js");
    const Contribution = require("../../models/contributionModel/contribution.model.js");
    const SubscriptionTier = require("../../models/subscriptionTierModel/subscriptionTier.model.js");

    const member = await Member.findOne({ userId }).populate("subscriptionTierId");
    if (!member) {
      return res.status(404).json({ success: false, message: "Member record not found for this user" });
    }

    // DEBUG: Check what's being returned
    console.log("Contribution Summary - Member:", {
        id: member._id,
        tier: member.subscriptionTierId,
        joinDate: member.joinDate,
        createdAt: member.createdAt
    });

    // Get last paid contribution
    const lastContribution = await Contribution.findOne({
      memberId: member._id,
      status: "paid"
    }).sort({ createdAt: -1 });

    // Calculate next due date
    // Fallback to createdAt if joinDate is missing
    const baseDate = member.joinDate || member.createdAt || new Date(); 
    let nextDueDate = new Date(baseDate);
    
    if (lastContribution) {
      nextDueDate = new Date(lastContribution.createdAt); 
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);
    } else {
        // If no contributions, next due is 1 month after join/creation
        // (Or should it be immediate? Usually subscription implies paying to join or end of month. 
        // Logic here: 1 month after join date)
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
    }

    return res.status(200).json({
      success: true,
      data: {
        currentTier: member.subscriptionTierId?.name || "N/A",
        monthlyAmount: member.monthlyContribution,
        lastContributionAmount: lastContribution?.amount || 0,
        lastContributionDate: lastContribution?.createdAt || null,
        nextDueDate: nextDueDate,
        status: member.status
      }
    });
  } catch (err) {
    console.error("Error fetching contribution summary:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const initiateContributionPayment = async (req, res) => {
  try {
    const { amount, month } = req.body;
    const userId = req.user._id;

    const member = await Member.findOne({ userId: userId }).populate("userId");
    if (!member) {
      return res.status(404).json({ success: false, message: "Member record not found" });
    }

    let contribution = await Contribution.findOne({
      memberId: member._id,
      month,
      status: { $ne: "paid" }
    });

    if (!contribution) {
        contribution = await Contribution.create({
            memberId: member._id,
            cooperativeId: member.cooperativeId,
            amount: amount || member.monthlyContribution,
            month: month,
            status: "pending"
        });
    } else {
        if (amount && amount !== contribution.amount) {
            contribution.amount = amount;
            await contribution.save();
        }
    }

    const user = member.userId;
    const paymentAmount = contribution.amount;

    const payload = {
      customerReference: contribution._id.toString(),
      amount: paymentAmount,
      description: `Contribution for ${month}`,
      customerName: `${user.firstName} ${user.lastName}`,
      customerEmail: user.email,
      customerMobile: user.phone,
      returnUrl: `${process.env.FRONTEND_URL}/payment/success`,
      integrationKey: process.env.VIGIPAY_INTEGRATION_KEY
    };

    const vigipayRes = await vigipayClient.post(
      "/api/v1/Payment",
      payload
    );

    const data = vigipayRes?.data?.responseData;
    if (!data) {
      throw new Error("Invalid response from payment gateway");
    }

    await Payment.create({
        userId: user._id,
        amount: paymentAmount,
        description: payload.description,
        transactionReference: data.transactionReference,
        redirectUrl: data.redirectUrl,
        channel: data.channel || "vigipay",
        vigipayStatus: "pending",
        paymentType: "contribution",
        contributionId: contribution._id,
        name: payload.customerName,
        email: payload.customerEmail,
        phone: payload.customerMobile,
        rawResponse: data
    });

    return res.status(200).json({
      success: true,
      message: "Payment initiated",
      paymentUrl: data.redirectUrl,
      reference: data.transactionReference
    });

  } catch (err) {
    console.error("Initiate contribution payment error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const verifyContributionPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    const verifyRes = await vigipayClient.get(
      `/api/v1/Payment/${reference}/requery`
    );

    const data = verifyRes.data.responseData;
    
    const payment = await Payment.findOne({ transactionReference: reference });
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment record not found" });
    }

    payment.vigipayStatus = data.status === "Successful" ? "successful" : "failed";
    payment.rawResponse = data;
    await payment.save();

    if (payment.vigipayStatus !== "successful") {
      return res.json({ 
          success: false, 
          message: "Payment failed at gateway", 
          status: payment.vigipayStatus 
      });
    }

    if (!payment.contributionId) {
        return res.status(400).json({ success: false, message: "Not a contribution payment" });
    }

    const contribution = await Contribution.findById(payment.contributionId);
    if (!contribution) {
        return res.status(404).json({ success: false, message: "Contribution not found" });
    }

    if (contribution.status === "paid") {
        return res.json({ success: true, message: "Contribution already processed" });
    }

    await ContributionService.markPaid(contribution._id, {
        transactionId: reference,
        paidAt: new Date()
    });

    const cooperative = await Cooperative.findById(contribution.cooperativeId);
    if (!cooperative) {
        throw new Error("Cooperative not found");
    }

    const adminUser = await User.findById(cooperative.adminId);
    if (!adminUser || !adminUser.walletId) {
        throw new Error("Cooperative admin wallet not configured"); 
    }

    await WalletLedger.create({
        userId: adminUser._id,
        walletId: adminUser.walletId,
        reference: reference,
        merchantRef: contribution._id.toString(),
        type: "CREDIT",
        amount: payment.amount,
        status: "SUCCESS",
        channel: "vigipay",
        beneficiaryAccount: adminUser.walletId,
        rawWebhookPayload: data,
        transactionDate: new Date()
    });

    adminUser.wallet_balance = (adminUser.wallet_balance || 0) + payment.amount;
    await adminUser.save();

    return res.json({
        success: true,
        message: "Contribution verified and wallet credited",
        data: contribution
    });

  } catch (err) {
    console.error("Verify contribution payment error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createContribution,
  listByMember,
  markPaid,
  getContributionStats,
  listCooperativeContributions,
  getLoanEligibility,
  getContributionSummary,
  initiateContributionPayment,
  verifyContributionPayment,
  listMyContributions
};
