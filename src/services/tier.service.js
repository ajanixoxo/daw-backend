const SubscriptionTier = require("../models/subscriptionTierModel/subscriptionTier.model.js");
const Cooperative = require("../models/cooperativeModel/cooperative.model.js");

/**
 * Service goals:
 * - ensure cooperative exists
 * - create / update tier documents
 */

module.exports = {
  async createTier(data) {
    const coop = await Cooperative.findById(data.cooperativeId);
    if (!coop) {throw new Error("Cooperative not found");}
    const tier = await SubscriptionTier.create(data);
    // attach to cooperative
    coop.subscriptionTiers = coop.subscriptionTiers || [];
    coop.subscriptionTiers.push(tier._id);
    await coop.save();
    return tier;
  },

  async getTiers(cooperativeId) {
    return SubscriptionTier.find({ cooperativeId, isActive: true }).lean();
  },

  async updateTier(id, data) {
    return SubscriptionTier.findByIdAndUpdate(id, data, { new: true });
  }
};
