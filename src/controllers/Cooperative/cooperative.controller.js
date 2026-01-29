const CoopService = require("../../services/cooperative.service.js");
const Cooperative = require("../../models/cooperativeModel/cooperative.model.js");
const SubscriptionTier = require("../../models/subscriptionTierModel/subscriptionTier.model.js");

/**
 * Controller goals:
 * - createCooperative: Create a cooperative record (admin-driven).
 * - getCooperative: Return cooperative with tiers & members.
 * - listCooperatives: List all cooperatives (paginated/filterable).
 * - updateCooperative: Update org metadata.
 * - getDAWCooperative: Public endpoint; returns the single DAW cooperative and its tiers (no auth).
 */

const getDAWCooperative = async (req, res) => {
  try {
    const cooperative = await Cooperative.findOne({ name: "DAW" }).lean();
    if (!cooperative) {
      return res.status(404).json({ error: "DAW cooperative not found" });
    }
    const tiers = await SubscriptionTier.find({
      cooperativeId: cooperative._id,
      isActive: true,
    })
      .select("_id name monthlyContribution")
      .sort({ name: 1 })
      .lean();
    return res.json({
      cooperative: {
        _id: cooperative._id,
        name: cooperative.name,
        description: cooperative.description,
        isActive: cooperative.isActive,
      },
      tiers,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const createCooperative = async (req, res) => {
  try {
    const cooperative = await CoopService.createCooperative(req.body);
    return res.status(201).json({ message: "Cooperative created", cooperative });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

const getCooperative = async (req, res) => {
  try {
    const cooperative = await CoopService.getCooperative(req.params.id);
    if (!cooperative) return res.status(404).json({ error: "Not found" });
    return res.json(cooperative);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

const listCooperatives = async (req, res) => {
  try {
    const cooperatives = await CoopService.getAll(req.query);
    return res.json(cooperatives);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateCooperative = async (req, res) => {
  try {
    const updated = await CoopService.updateCooperative(req.params.id, req.body);
    return res.json({ message: "Updated", cooperative: updated });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

module.exports = {
  getDAWCooperative,
  createCooperative,
  getCooperative,
  listCooperatives,
  updateCooperative
};
