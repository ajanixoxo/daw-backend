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
    const formatted = contributions.map(c => {
      const currency = c.currency || (c.memberId?.userId?.currency) || "NGN";
      const ngnAmount = c.amount;
      const usdAmount = TIER_USD_MAP[ngnAmount] || ngnAmount; // Fallback to raw amount if no map found
      const displayAmount = currency === "USD" ? usdAmount : ngnAmount;

      return {
        _id: c._id,
        member: c.memberId?.userId
          ? `${c.memberId.userId.firstName} ${c.memberId.userId.lastName}`
          : "Unknown",
        email: c.memberId?.userId?.email || "",
        type: c.contributionTypeId?.name || c.month || "N/A",
        amount: displayAmount, // amount in the specific currency
        currency: currency,
        date: c.paidAt || c.createdAt,
        status: c.status
      };
    });

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

/**
 * Fixed tier NGN→USD mapping (business-defined, not a live rate).
 * Cooperative tiers: ₦20k→$25, ₦50k→$50, ₦120k→$120
 * Normal seller subscription: ₦20k→$20
 */
const TIER_USD_MAP = { 20000: 25, 50000: 50, 120000: 120 };
const SELLER_SUBSCRIPTION_NGN = 20000;
const SELLER_SUBSCRIPTION_USD = 20;

const getContributionSummary = async (req, res) => {
  try {
    const userId = req.user._id;
    const Member = require("../../models/memberModel/member.model.js");

    // Fetch user to get currency preference
    const user = await User.findById(userId).select("currency");
    const isUSD = user?.currency === "USD";

    const member = await Member.findOne({ userId }).populate("subscriptionTierId").populate("pendingTierId");

    // ── Normal seller (not a cooperative member) ────────────────────────
    if (!member) {
      const monthlyAmount = isUSD ? SELLER_SUBSCRIPTION_USD : SELLER_SUBSCRIPTION_NGN;
      const now = new Date();
      const nextDueDate = new Date(now);
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);

      return res.status(200).json({
        success: true,
        data: {
          userType: "seller",
          currency: isUSD ? "USD" : "NGN",
          currentTier: "Seller Subscription",
          monthlyAmount,
          usdAmount: SELLER_SUBSCRIPTION_USD,
          ngnAmount: SELLER_SUBSCRIPTION_NGN,
          lastContributionAmount: 0,
          lastContributionDate: null,
          nextDueDate,
          status: "active"
        }
      });
    }

    // ── Cooperative member ───────────────────────────────────────────────
    const lastContribution = await Contribution.findOne({
      memberId: member._id,
      status: "paid"
    }).sort({ createdAt: -1 });

    const baseDate = member.joinDate || member.createdAt || new Date();
    let nextDueDate = new Date(baseDate);
    if (lastContribution?.paidAt) {
      nextDueDate = new Date(lastContribution.paidAt);
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);
    } else {
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);
    }

    const ngnAmount = member.monthlyContribution;
    const usdAmount = TIER_USD_MAP[ngnAmount] || null;
    const monthlyAmount = isUSD && usdAmount ? usdAmount : ngnAmount;

    const pendingTier = member.pendingTierId;
    let pendingTierInfo = null;
    if (pendingTier) {
      const pendingNgn = pendingTier.monthlyContribution;
      const pendingUsd = TIER_USD_MAP[pendingNgn] || null;
      pendingTierInfo = {
        _id: pendingTier._id,
        name: pendingTier.name,
        monthlyContribution: pendingNgn,
        usdAmount: pendingUsd
      };
    }

    return res.status(200).json({
      success: true,
      data: {
        userType: "cooperative",
        currency: isUSD ? "USD" : "NGN",
        currentTier: member.subscriptionTierId?.name || "N/A",
        currentTierId: member.subscriptionTierId?._id || null,
        monthlyAmount,
        usdAmount,
        ngnAmount,
        lastContributionAmount: lastContribution?.amount || 0,
        lastContributionDate: lastContribution?.paidAt || null,
        nextDueDate,
        status: member.status,
        pendingTier: pendingTierInfo,
        pendingTierEffectiveMonth: member.pendingTierEffectiveMonth || null
      }
    });
  } catch (err) {
    console.error("Error fetching contribution summary:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const initiateContributionPayment = async (req, res) => {
  try {
    const { amount, month, paymentPlatform = "vigipay" } = req.body;
    const userId = req.user._id;

    // Fetch user for currency + contact details
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const isUSD = user.currency === "USD";

    // USD users may ONLY pay via PayPal
    if (isUSD && paymentPlatform !== "paypal") {
      return res.status(400).json({
        success: false,
        message: "USD accounts can only pay via PayPal"
      });
    }

    const member = await Member.findOne({ userId }).populate("pendingTierId");

    // ── Normal seller subscription (no cooperative member record) ────────
    if (!member) {
      const paymentAmount = isUSD ? SELLER_SUBSCRIPTION_USD : SELLER_SUBSCRIPTION_NGN;
      const currency    = isUSD ? "USD" : "NGN";
      const description = `Seller subscription for ${month}`;
      const customerName = `${user.firstName} ${user.lastName}`;

      return initiateSellerSubscriptionPayment({
        res, user, paymentAmount, currency, description, customerName,
        month, paymentPlatform
      });
    }

    // ── Cooperative member ───────────────────────────────────────────────

    // Apply pending tier if this month matches the scheduled effective month
    if (member.pendingTierId && member.pendingTierEffectiveMonth === month) {
      const newTier = member.pendingTierId;
      await Member.findByIdAndUpdate(member._id, {
        subscriptionTierId: newTier._id,
        monthlyContribution: newTier.monthlyContribution,
        pendingTierId: null,
        pendingTierEffectiveMonth: null
      });
      member.monthlyContribution = newTier.monthlyContribution;
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
        amount: member.monthlyContribution, // always stored in NGN
        currency: isUSD ? "USD" : "NGN",
        paidAmount: isUSD ? (TIER_USD_MAP[member.monthlyContribution] || member.monthlyContribution) : member.monthlyContribution,
        month,
        status: "pending"
      });
    } else {
      // If it exists but currency/paidAmount aren't set, update them
      contribution.currency = isUSD ? "USD" : "NGN";
      contribution.paidAmount = isUSD ? (TIER_USD_MAP[contribution.amount] || contribution.amount) : contribution.amount;
      await contribution.save();
    }

    // For USD members use the fixed tier USD amount; NGN members pay NGN
    const ngnAmount = contribution.amount;
    const paymentAmount = isUSD ? (TIER_USD_MAP[ngnAmount] || ngnAmount) : ngnAmount;
    const currency = isUSD ? "USD" : "NGN";
    const description = `Contribution for ${month}`;
    const customerName = `${user.firstName} ${user.lastName}`;

    const paymentRecord = await buildAndSendPayment({
      res, user, paymentAmount, currency, description, customerName,
      paymentPlatform, paymentType: "contribution",
      contributionId: contribution._id
    });

    return paymentRecord;

  } catch (err) {
    console.error("Initiate contribution payment error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── Shared payment helpers ──────────────────────────────────────────────────

async function initiateSellerSubscriptionPayment({
  res, user, paymentAmount, currency, description, customerName,
  month, paymentPlatform
}) {
  return buildAndSendPayment({
    res, user, paymentAmount, currency, description, customerName,
    paymentPlatform, paymentType: "seller_subscription", contributionId: null
  });
}

async function buildAndSendPayment({
  res, user, paymentAmount, currency, description, customerName,
  paymentPlatform, paymentType, contributionId
}) {
  const axios = require("axios");

  // ── Paystack (NGN only) ────────────────────────────────────────────────
  if (paymentPlatform === "paystack") {
    const reference = `CONTRIB-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const paystackRes = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: user.email,
        amount: Math.round(paymentAmount * 100), // kobo
        currency: "NGN",
        reference,
        callback_url: `${process.env.FRONTEND_URL}/payment/success?type=${paymentType}`,
        metadata: {
          contributionId: contributionId?.toString(),
          userId: user._id.toString(),
          paymentType
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const paystackData = paystackRes.data?.data;
    if (!paystackData?.authorization_url) {
      throw new Error("Could not retrieve Paystack authorization URL");
    }

    await Payment.create({
      userId: user._id,
      amount: paymentAmount,
      description,
      currency: "NGN",
      transactionReference: reference,
      redirectUrl: paystackData.authorization_url,
      channel: "paystack",
      paystackStatus: "pending",
      paymentType,
      contributionId,
      name: customerName,
      email: user.email,
      phone: user.phone,
      rawResponse: paystackData
    });

    return res.status(200).json({
      success: true,
      message: "Payment initiated",
      paymentUrl: paystackData.authorization_url,
      reference
    });
  }

  // ── PayPal (USD) ──────────────────────────────────────────────────────
  if (paymentPlatform === "paypal") {
    const credentials = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString("base64");

    const tokenRes = await axios.post(
      `${process.env.PAYPAL_BASE_URL}/v1/oauth2/token`,
      "grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );
    const accessToken = tokenRes.data.access_token;

    const paypalRes = await axios.post(
      `${process.env.PAYPAL_BASE_URL}/v2/checkout/orders`,
      {
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: contributionId?.toString() || user._id.toString(),
          description,
          amount: { currency_code: "USD", value: paymentAmount.toFixed(2) }
        }],
        application_context: {
          brand_name: process.env.APP_NAME || "DAW",
          landing_page: "BILLING",
          user_action: "PAY_NOW",
          return_url: `${process.env.FRONTEND_URL}/payment/success?type=${paymentType}`,
          cancel_url: `${process.env.FRONTEND_URL}/payment/cancel?type=${paymentType}`
        }
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    const paypalOrder = paypalRes.data;
    const approvalUrl = paypalOrder.links?.find((l) => l.rel === "approve")?.href;
    if (!approvalUrl) throw new Error("Could not retrieve PayPal approval URL");

    await Payment.create({
      userId: user._id,
      amount: paymentAmount,
      description,
      currency: "USD",
      transactionReference: paypalOrder.id,
      redirectUrl: approvalUrl,
      channel: "paypal",
      paypalStatus: "pending",
      paymentType,
      contributionId,
      name: customerName,
      email: user.email,
      phone: user.phone,
      rawResponse: paypalOrder
    });

    return res.status(200).json({
      success: true,
      message: "Payment initiated",
      paymentUrl: approvalUrl,
      reference: paypalOrder.id
    });
  }

  // ── VígiPay (default, NGN) ────────────────────────────────────────────
  const vigipayPayload = {
    customerReference: contributionId?.toString() || user._id.toString(),
    amount: paymentAmount,
    description,
    customerName,
    customerEmail: user.email,
    customerMobile: user.phone,
    returnUrl: `${process.env.FRONTEND_URL}/payment/success`,
    integrationKey: process.env.VIGIPAY_INTEGRATION_KEY
  };

  const vigipayRes = await vigipayClient.post("/api/v1/Payment", vigipayPayload);
  const data = vigipayRes?.data?.responseData;
  if (!data) throw new Error("Invalid response from VígiPay");

  await Payment.create({
    userId: user._id,
    amount: paymentAmount,
    description,
    currency: "NGN",
    transactionReference: data.transactionReference,
    redirectUrl: data.redirectUrl,
    channel: "vigipay",
    vigipayStatus: "pending",
    paymentType,
    contributionId,
    name: customerName,
    email: user.email,
    phone: user.phone,
    rawResponse: data
  });

  return res.status(200).json({
    success: true,
    message: "Payment initiated",
    paymentUrl: data.redirectUrl,
    reference: data.transactionReference
  });
}

const verifyContributionPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    const payment = await Payment.findOne({ transactionReference: reference });
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment record not found" });
    }

    const channel = payment.channel || "vigipay";
    let isSuccessful = false;
    let rawData = {};

    // ── Verify with the correct gateway ──────────────────────────────────
    if (channel === "paystack") {
      const axios = require("axios");
      const verifyRes = await axios.get(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
      );
      const txn = verifyRes.data?.data;
      rawData = txn;
      isSuccessful = txn?.status === "success";
      payment.paystackStatus = isSuccessful ? "successful" : "failed";
      payment.rawResponse = txn;
      await payment.save();

    } else if (channel === "paypal") {
      const axios = require("axios");
      const credentials = Buffer.from(
        `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
      ).toString("base64");
      const tokenRes = await axios.post(
        `${process.env.PAYPAL_BASE_URL}/v1/oauth2/token`,
        "grant_type=client_credentials",
        {
          headers: {
            Authorization: `Basic ${credentials}`,
            "Content-Type": "application/x-www-form-urlencoded"
          }
        }
      );
      const accessToken = tokenRes.data.access_token;
      const captureRes = await axios.post(
        `${process.env.PAYPAL_BASE_URL}/v2/checkout/orders/${reference}/capture`,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          }
        }
      );
      rawData = captureRes.data;
      isSuccessful = captureRes.data?.status === "COMPLETED";
      payment.paypalStatus = isSuccessful ? "successful" : "failed";
      payment.rawResponse = rawData;
      await payment.save();

    } else {
      // Vigipay
      const verifyRes = await vigipayClient.get(`/api/v1/Payment/${reference}/requery`);
      rawData = verifyRes.data.responseData;
      isSuccessful = rawData?.status === "Successful";
      payment.vigipayStatus = isSuccessful ? "successful" : "failed";
      payment.rawResponse = rawData;
      await payment.save();
    }

    if (!isSuccessful) {
      return res.json({ success: false, message: "Payment failed at gateway" });
    }

    // ── Seller subscription: no cooperative wallet credit needed ─────────
    if (payment.paymentType === "seller_subscription" || !payment.contributionId) {
      return res.json({
        success: true,
        message: "Seller subscription payment verified successfully"
      });
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
    if (!cooperative) throw new Error("Cooperative not found");

    const adminUser = await User.findById(cooperative.adminId);
    if (!adminUser || !adminUser.walletId) throw new Error("Cooperative admin wallet not configured");

    await WalletLedger.create({
      userId: adminUser._id,
      walletId: adminUser.walletId,
      reference,
      merchantRef: contribution._id.toString(),
      type: "CREDIT",
      amount: payment.amount,
      status: "SUCCESS",
      channel,
      beneficiaryAccount: adminUser.walletId,
      rawWebhookPayload: rawData,
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
