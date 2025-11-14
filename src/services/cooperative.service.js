const Cooperative = require("../models/cooperativeModel/cooperative.model.js");
const SubscriptionTier = require("../models/subscriptionTierModel/subscriptionTier.model.js");

/**
 * Service goals:
 * - perform validations and DB operations for cooperatives
 * - link tiers, ensure name uniqueness, return populated objects
 */

module.exports = {
  async createCooperative(data) {
    const exists = await Cooperative.findOne({ name: data.name });
    if (exists) throw new Error("Cooperative name already exists");
    // if subscriptionTiers provided as objects, create them
    let tierIds = [];
    if (data.subscriptionTiers && data.subscriptionTiers.length) {
      const tiers = await SubscriptionTier.insertMany(
        data.subscriptionTiers.map(t => ({ ...t, cooperativeId: null })) // will set below
      );
      tierIds = tiers.map(t => t._id);
    }
    const coopData = { ...data, subscriptionTiers: tierIds };
    const coop = await Cooperative.create(coopData);

    // update cooperativeId on tiers if created
    if (tierIds.length) {
      await SubscriptionTier.updateMany({ _id: { $in: tierIds } }, { cooperativeId: coop._id });
    }
    return coop;
  },

  async getCooperative(id) {
    return Cooperative.findById(id)
      .populate("subscriptionTiers")
      .populate({
        path: "members",
        select: "userId subscriptionTierId monthlyContribution status"
      })
      .lean();
  },

  async getAll(filter = {}) {
    // you can expand pagination/filters later
    return Cooperative.find(filter).sort({ createdAt: -1 }).lean();
  },

  async updateCooperative(id, data) {
    return Cooperative.findByIdAndUpdate(id, data, { new: true });
  }
};
