import Member from "../models/memberModel/member.model.js";
import SubscriptionTier from "../models/subscriptionTierModel/subscriptionTier.model.js";
import Cooperative from "../models/cooperativeModel/cooperative.model.js";

/**
 * Service goals:
 * - create member with monthlyContribution populated from tier
 * - avoid duplicates
 * - attach member id to Cooperative.members
 */

export default {
  async joinCooperative({ userId, cooperativeId, subscriptionTierId }) {
    // validate
    const coop = await Cooperative.findById(cooperativeId);
    if (!coop) throw new Error("Cooperative not found");

    const tier = await SubscriptionTier.findById(subscriptionTierId);
    if (!tier) throw new Error("Subscription tier not found");

    // check duplicate membership
    const existing = await Member.findOne({ userId, cooperativeId });
    if (existing) throw new Error("User is already a member of this cooperative");

    const member = await Member.create({
      userId,
      cooperativeId,
      subscriptionTierId,
      monthlyContribution: tier.monthlyContribution,
      status: "active",
      joinDate: new Date()
    });

    // attach to cooperative
    coop.members = coop.members || [];
    coop.members.push(member._id);
    await coop.save();

    return member;
  },

  async getMembers(cooperativeId) {
    return Member.find({ cooperativeId }).populate("subscriptionTierId userId").lean();
  },

  async updateStatus(id, status) {
    return Member.findByIdAndUpdate(id, { status }, { new: true });
  },

  async getById(id) {
    return Member.findById(id).populate("subscriptionTierId userId").lean();
  }
};
