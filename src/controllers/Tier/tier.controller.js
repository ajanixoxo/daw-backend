import TierService from "../../services/tier.service.js";

/**
 * Controller goals:
 * - createTier: Create a subscription tier for a cooperative
 * - listTiers: List tiers for a coop
 * - updateTier: Update tier details
 */

export const createTier = async (req, res) => {
  try {
    const tier = await TierService.createTier(req.body);
    return res.status(201).json({ tier });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

export const listTiers = async (req, res) => {
  try {
    const tiers = await TierService.getTiers(req.params.cooperativeId);
    return res.json(tiers);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

export const updateTier = async (req, res) => {
  try {
    const tier = await TierService.updateTier(req.params.id, req.body);
    return res.json({ tier });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};
