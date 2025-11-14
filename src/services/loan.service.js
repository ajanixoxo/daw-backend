const Loan = require("../models/loanModel/loan.model.js");
const Member = require("../models/memberModel/member.model.js");
const SubscriptionTier = require("../models/subscriptionTierModel/subscriptionTier.model.js");
const Contribution = require("../models/contributionModel/contribution.model.js");

/**
 * Service goals:
 * - validate loan request against tier loanSettings and contribution history
 * - create loan record (status pending)
 * - admin approves (status changed and disbursement handled elsewhere)
 */

module.exports = {
  async applyForLoan({ memberId, amount, durationMonths, purpose }) {
    const member = await Member.findById(memberId).populate("subscriptionTierId").lean();
    if (!member) throw new Error("Member not found");
    if (member.status !== "active") throw new Error("Member must be active to apply for loan");

    const tier = await SubscriptionTier.findById(member.subscriptionTierId);
    if (!tier) throw new Error("Subscription tier not found");

    const settings = tier.loanSettings || {};
    if (amount > (settings.maxAmount || 0)) {
      throw new Error("Requested amount exceeds tier limit");
    }

    // check contribution history eligibility
    const minPaidMonths = settings.eligibilityCriteria?.minPaidMonths || 0;
    if (minPaidMonths > 0) {
      // count paid contributions
      const paidCount = await Contribution.countDocuments({ memberId, status: "paid" });
      if (paidCount < minPaidMonths) throw new Error("Insufficient paid contribution history for loan eligibility");
    }

    const loan = await Loan.create({
      memberId,
      cooperativeId: member.cooperativeId,
      subscriptionTierId: tier._id,
      amount,
      interestRate: settings.interestRate || 0,
      durationMonths,
      status: "pending",
      eligibilityReport: {
        paidContributions: await Contribution.countDocuments({ memberId, status: "paid" })
      }
    });
    return loan;
  },

  async approve(loanId, { approverId }) {
    // approve flow; real systems would log approver, change balances, etc.
    const loan = await Loan.findByIdAndUpdate(loanId, { status: "approved" }, { new: true });
    if (!loan) throw new Error("Loan not found");
    return loan;
  },

  async getByMember(memberId) {
    return Loan.find({ memberId }).sort({ createdAt: -1 }).lean();
  }
};
