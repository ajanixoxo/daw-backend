const Member = require("../models/memberModel/member.model");
const Product = require("../models/marketPlace/productModel");
const Order = require("../models/marketPlace/orderModel");
const Loan = require("../models/loanModel/loan.model");
const LoanProduct = require("../models/loanModel/loanProduct.model");

const TIER_LIMITS = {
  "Basic": 1000000,
  "Standard": 5000000,
  "Premium": 10000000,
  "Tier 1": 1000000,   // Legacy mapping
  "Tier 2": 5000000,
  "Tier 3": 10000000
};

/**
 * Check eligibility for a loan based on 6 criteria
 * @param {string} userId - ID of the user applying
 * @param {string} loanProductId - ID of the loan product selected
 * @returns {Object} - { eligible: boolean, checks: Array, tierLimit: number, activeTotal: number }
 */
const checkLoanEligibility = async (userId, loanProductId) => {
  const checks = [];
  let isEligible = true;

  // 1. Is User a Cooperative Member?
  const member = await Member.findOne({ userId }).populate("subscriptionTierId");
  const isMember = !!member;
  checks.push({
    id: 1,
    title: "Cooperative Member",
    passed: isMember,
    message: isMember ? "Verified member" : "Not a member. Please join cooperative."
  });
  if (!isMember) isEligible = false;

  // If not a member, we can't perform other checks accurately
  if (!isMember) {
    return { eligible: false, checks };
  }

  // 2. Contribution Status (No missed/pending payments)
  const missedPayments = member.paymentHistory.filter(p => p.status !== "paid");
  const isContributing = missedPayments.length === 0;
  checks.push({
    id: 2,
    title: "Contribution Status",
    passed: isContributing,
    message: isContributing ? "Contributions current" : `You have ${missedPayments.length} missed/pending contributions.`
  });
  if (!isContributing) isEligible = false;

  // 3. Membership Contribution Consistency (6+ months)
  const paidMonthsCount = member.paymentHistory.filter(p => p.status === "paid").length;
  const hasConsistency = paidMonthsCount >= 6;
  checks.push({
    id: 3,
    title: "6-Month Consistency",
    passed: hasConsistency,
    message: hasConsistency ? "Consistency verified" : `Minimum 6 months contribution required (Current: ${paidMonthsCount})`
  });
  if (!hasConsistency) isEligible = false;

  // 4. Check Total Active Loans Tier Limit
  const selectedProduct = await LoanProduct.findById(loanProductId);
  const activeLoans = await Loan.find({ 
    memberId: member._id, 
    status: { $in: ["approved", "disbursed"] } 
  });
  
  const activeTotal = activeLoans.reduce((sum, l) => sum + l.amount, 0);
  const requestedAmount = selectedProduct ? selectedProduct.amount : 0;
  const totalProjected = activeTotal + requestedAmount;
  
  const tierName = member.subscriptionTierId?.name || "Basic";
  const tierLimit = TIER_LIMITS[tierName] || 1000000;
  
  const withinLimit = totalProjected <= tierLimit;
  checks.push({
    id: 4,
    title: "Tier Limit Check",
    passed: withinLimit,
    message: withinLimit 
      ? `Within ${tierName} limit (₦${tierLimit.toLocaleString()})` 
      : `Total loans (₦${totalProjected.toLocaleString()}) exceeds ${tierName} limit (₦${tierLimit.toLocaleString()})`
  });
  if (!withinLimit) isEligible = false;

  // 5. Does user have products on Marketplace?
  // We need to find the user's shop first
  const Shop = require("../models/marketPlace/shopModel");
  const shop = await Shop.findOne({ owner_id: userId });
  const hasProducts = shop ? await Product.exists({ shop_id: shop._id }) : false;
  
  checks.push({
    id: 5,
    title: "Marketplace Presence",
    passed: !!hasProducts,
    message: hasProducts ? "Products verified" : "You must have products on marketplace to qualify"
  });
  if (!hasProducts) isEligible = false;

  // 6. Sales Activity (Last 30 Days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const salesCount = shop ? await Order.countDocuments({ 
    shop_id: shop._id, 
    payment_status: "paid", 
    createdAt: { $gte: thirtyDaysAgo } 
  }) : 0;
  
  const hasMinSales = salesCount >= 5;
  checks.push({
    id: 6,
    title: "Sales Activity (30 Days)",
    passed: hasMinSales,
    message: hasMinSales ? `${salesCount} sales in 30 days` : "Minimum of 5 sales in last 30 days required"
  });
  if (!hasMinSales) isEligible = false;

  return {
    eligible: isEligible,
    checks,
    tierLimit,
    activeTotal,
    requestedAmount,
    tierName
  };
};

module.exports = {
  checkLoanEligibility
};
