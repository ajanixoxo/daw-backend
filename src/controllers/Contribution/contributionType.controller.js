const ContributionType = require("../../models/contributionModel/contributionType.model.js");

/**
 * Create a new contribution type for a cooperative
 */
const createContributionType = async (req, res) => {
  try {
    const { name, type, frequency, amount, cooperativeId, loanEligibilityMonths } = req.body;

    if (!name || !type || !amount || !cooperativeId) {
      return res.status(400).json({
        success: false,
        message: "name, type, amount, and cooperativeId are required"
      });
    }

    const contributionType = await ContributionType.create({
      name,
      type,
      frequency: frequency || (type === "recurring" ? "monthly" : "n/a"),
      amount,
      cooperativeId,
      loanEligibilityMonths: loanEligibilityMonths || 3,
      status: "pending"
    });

    return res.status(201).json({
      success: true,
      data: contributionType
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A contribution type with this name already exists for this cooperative"
      });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * List all contribution types for a cooperative
 */
const listContributionTypes = async (req, res) => {
  try {
    const { cooperativeId } = req.params;

    const types = await ContributionType.find({ cooperativeId })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: types
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * Update contribution type status (approve / reject)
 */
const updateContributionTypeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["active", "pending", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be active, pending, or rejected"
      });
    }

    const updated = await ContributionType.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Contribution type not found" });
    }

    return res.status(200).json({
      success: true,
      data: updated
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = {
  createContributionType,
  listContributionTypes,
  updateContributionTypeStatus
};
