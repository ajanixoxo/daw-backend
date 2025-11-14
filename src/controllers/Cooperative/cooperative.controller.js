const CoopService = require("../../services/cooperative.service.js");

/**
 * Controller goals:
 * - createCooperative: Create a cooperative record (admin-driven).
 * - getCooperative: Return cooperative with tiers & members.
 * - listCooperatives: List all cooperatives (paginated/filterable).
 * - updateCooperative: Update org metadata.
 */

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
  createCooperative,
  getCooperative,
  listCooperatives,
  updateCooperative
};
