const Loan = require("../models/loanModel/loan.model.js");
const Member = require("../models/memberModel/member.model.js");
const SubscriptionTier = require("../models/subscriptionTierModel/subscriptionTier.model.js");
const Contribution = require("../models/contributionModel/contribution.model.js");
const { checkLoanEligibility } = require("./loanEligibility.service.js");
const LoanProduct = require("../models/loanModel/loanProduct.model.js");

/**
 * Service goals:
 * - validate loan request against tier loanSettings and contribution history
 * - create loan record (status pending)
 * - admin approves (status changed and disbursement handled elsewhere)
 */

module.exports = {
  /**
   * Apply for a loan after eligibility check
   */
  async applyForLoan({ userId, loanProductId, businessInfo, location, documents, guarantor }) {
    // 1. Mandatory Eligibility Check
    const eligibility = await checkLoanEligibility(userId, loanProductId);
    if (!eligibility.eligible) {
      const failedChecks = eligibility.checks.filter(c => !c.passed).map(c => c.title).join(", ");
      throw new Error(`Ineligible for loan. Failed checks: ${failedChecks}. Contact support for disputes.`);
    }

    const member = await Member.findOne({ userId });
    const product = await LoanProduct.findById(loanProductId);
    if (!product) throw new Error("Loan product not found");

    // 2. Guarantor Requirement Check
    // ONLY when loan amount exceeds user's tier limit.
    const isOverLimit = (eligibility.activeTotal + product.amount) > eligibility.tierLimit;
    if (isOverLimit && !guarantor?.memberId) {
      throw new Error(`Guarantor is required for loans exceeding your tier limit of ₦${eligibility.tierLimit.toLocaleString()}`);
    }

    const loan = await Loan.create({
      memberId: member._id,
      cooperativeId: member.cooperativeId,
      loanProductId,
      amount: product.amount,
      interestRate: product.interestRate,
      durationMonths: product.repaymentTerm,
      monthlyPayment: product.monthlyPayment,
      location,
      purpose: product.purpose,
      businessInfo,
      documents: documents || [],
      guarantor: guarantor || null,
      status: "pending",
      eligibilityReport: eligibility
    });

    return loan;
  },

  async approve(loanId, { notes }) {
    const loan = await Loan.findById(loanId);
    if (!loan) throw new Error("Loan not found");

    loan.status = "approved";
    loan.approvedAt = new Date();
    if (notes) loan.notes = notes; // Assuming notes field might exist or be added

    return await loan.save();
  },

  async reject(loanId, { reason }) {
    const loan = await Loan.findById(loanId);
    if (!loan) throw new Error("Loan not found");

    loan.status = "rejected";
    loan.rejectedReason = reason;

    return await loan.save();
  },

  async markAsDisbursed(loanId) {
    const loan = await Loan.findById(loanId);
    if (!loan) throw new Error("Loan not found");

    loan.status = "disbursed";
    loan.disbursedAt = new Date();

    return await loan.save();
  },

  async markAsUnderReview(loanId) {
    const loan = await Loan.findByIdAndUpdate(
      loanId,
      { status: "under_review" },
      { new: true }
    );
    if (!loan) throw new Error("Loan not found");
    return loan;
  },

  async getByMember(memberId) {
    return Loan.find({ memberId }).populate("loanProductId").sort({ createdAt: -1 }).lean();
  }
};
