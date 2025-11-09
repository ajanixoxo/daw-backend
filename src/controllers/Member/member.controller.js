import MemberService from "../../services/member.service.js";

/**
 * Controller goals:
 * - join: user joins cooperative; set monthlyContribution from tier; creates member record
 * - approve: (if admin workflow) set status approved
 * - list: members per cooperative
 * - get: single member
 */

export const join = async (req, res) => {
  try {
    const member = await MemberService.joinCooperative(req.body);
    return res.status(201).json({ message: "Joined", member });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

export const approve = async (req, res) => {
  try {
    const member = await MemberService.updateStatus(req.params.id, "active");
    return res.json({ message: "Approved", member });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

export const listMembers = async (req, res) => {
  try {
    const members = await MemberService.getMembers(req.params.cooperativeId);
    return res.json(members);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

export const getMember = async (req, res) => {
  try {
    const member = await MemberService.getById(req.params.id);
    if (!member) return res.status(404).json({ error: "Not found" });
    return res.json(member);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};
