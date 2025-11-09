import Contribution from "../models/contributionModel/contribution.model.js";
import Member from "../models/memberModel/member.model.js";

/**
 * Service goals:
 * - create a contribution record for a member (used by cron or manual)
 * - generate monthly contributions for active members
 * - mark contribution as paid and append to member.paymentHistory
 */

export default {
  async createContribution({ memberId, cooperativeId, amount, month }) {
    // ensure record uniqueness for member-month if desired
    const exists = await Contribution.findOne({ memberId, month });
    if (exists) throw new Error("Contribution for this member and month already exists");

    return Contribution.create({ memberId, cooperativeId, amount, month });
  },

  async getMemberContributions(memberId) {
    return Contribution.find({ memberId }).sort({ createdAt: -1 }).lean();
  },

  async markPaid(contributionId, { transactionId, paidAt = new Date() }) {
    const c = await Contribution.findByIdAndUpdate(
      contributionId,
      { status: "paid", transactionId, paidAt },
      { new: true }
    );
    if (!c) throw new Error("Contribution not found");

    // append to member.paymentHistory
    await Member.findByIdAndUpdate(c.memberId, {
      $push: {
        paymentHistory: {
          month: c.month,
          amount: c.amount,
          status: "paid",
          transactionId,
          paidAt
        }
      }
    });

    return c;
  },

  // generate monthly contributions for all active members
  async generateMonthlyForAll(activeMembers) {
    const monthName = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
    const created = [];
    for (const m of activeMembers) {
      // skip if existing contribution present
      const exists = await Contribution.findOne({ memberId: m._id, month: monthName });
      if (exists) continue;
      const c = await Contribution.create({
        memberId: m._id,
        cooperativeId: m.cooperativeId,
        amount: m.monthlyContribution,
        month: monthName,
        status: "pending"
      });
      created.push(c);
    }
    return created;
  }
};
