import ContributionService from "../../services/contribution.service.js";

/**
 * Controller goals:
 * - trigger payment creation (manual/for testing)
 * - list contributions for a member
 * - mark payment as received (update status + transaction info)
 */

export const createContribution = async (req, res) => {
  try {
    const c = await ContributionService.createContribution(req.body);
    return res.status(201).json({ contribution: c });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

export const listByMember = async (req, res) => {
  try {
    const list = await ContributionService.getMemberContributions(req.params.memberId);
    return res.json(list);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

export const markPaid = async (req, res) => {
  try {
    const updated = await ContributionService.markPaid(req.params.id, req.body);
    return res.json({ contribution: updated });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};
