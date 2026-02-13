const MemberService = require("../../services/member.service.js");
const User = require("../../models/userModel/user.js");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { verificationEmailTemplate } = require("@utils/EmailTemplate/template.js");

const JWT_SECRET = process.env.JWT_SECRET;
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

/**
 * Controller goals:
 * - join: logged-in user (buyer or seller) joins cooperative; tier selection; no duplicate shop/membership
 * - approve: (if admin workflow) set status approved
 * - list: members per cooperative
 * - get: single member
 */

const join = async (req, res) => {
  try {
    // Always use authenticated user id; never trust userId from body (security)
    const userId = req.user?._id;
    const { cooperativeId, subscriptionTierId } = req.body || {};
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!cooperativeId || !subscriptionTierId) {
      return res.status(400).json({ error: "cooperativeId and subscriptionTierId are required" });
    }
    // Validate ObjectIds so service receives valid ids (deterministic errors)
    if (!mongoose.Types.ObjectId.isValid(cooperativeId)) {
      return res.status(400).json({ error: "Invalid cooperativeId" });
    }
    if (!mongoose.Types.ObjectId.isValid(subscriptionTierId)) {
      return res.status(400).json({ error: "Invalid subscriptionTierId" });
    }
    const member = await MemberService.joinCooperative({
      userId,
      cooperativeId,
      subscriptionTierId
    });

    // Return updated user so the frontend can sync roles in localStorage
    const updatedUser = await require("../../models/userModel/user.js")
      .findById(userId)
      .select("firstName lastName email phone roles isVerified status shop member avatar")
      .populate("shop", "_id name")
      .populate("member", "_id cooperativeId")
      .lean();

    return res.status(201).json({ message: "Joined", member, user: updatedUser });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

const approve = async (req, res) => {
  try {
    const member = await MemberService.updateStatus(req.params.id, "active");
    return res.json({ message: "Approved", member });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

const listMembers = async (req, res) => {
  try {
    const members = await MemberService.getMembers(req.params.cooperativeId);
    return res.json(members);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

const getMember = async (req, res) => {
  try {
    const member = await MemberService.getById(req.params.id);
    if (!member) {return res.status(404).json({ error: "Not found" });}
    return res.json(member);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

const getDetails = async (req, res) => {
  try {
    const details = await MemberService.getDetails(req.params.id);
    if (!details) return res.status(404).json({ error: "Member not found" });
    return res.json(details);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

const removeMember = async (req, res) => {
  try {
    await MemberService.removeMember(req.params.id);
    return res.json({ message: "Member removed successfully" });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

/**
 * CASE 3: Guest joins cooperative.
 * No auth. If email already exists → require login (do not create duplicate user).
 * If new user: create user (buyer), then joinCooperative (creates shop + member + cooperative role).
 */
const guestJoin = async (req, res) => {
  try {
    const {
      email,
      password,
      confirmPassword,
      firstName,
      lastName,
      phone,
      cooperativeId,
      subscriptionTierId
    } = req.body || {};

    if (!email || !password || !confirmPassword || !firstName || !phone || !cooperativeId || !subscriptionTierId) {
      return res.status(400).json({
        error: "email, password, confirmPassword, firstName, phone, cooperativeId, and subscriptionTierId are required"
      });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Passwords must match" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    if (!mongoose.Types.ObjectId.isValid(cooperativeId)) {
      return res.status(400).json({ error: "Invalid cooperativeId" });
    }
    if (!mongoose.Types.ObjectId.isValid(subscriptionTierId)) {
      return res.status(400).json({ error: "Invalid subscriptionTierId" });
    }

    // If user already exists, do not create duplicate; require login and use POST /join
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({
        error: "User already exists. Please log in and use the Join Cooperative flow."
      });
    }

    // Create user with buyer role only; joinCooperative will add seller + cooperative and create shop
    const otp = generateOTP();
    const otpExpiry = Date.now() + 10 * 60 * 1000;
    const newUser = await User.create({
      firstName: (firstName || "").trim(),
      lastName: (lastName || "").trim(),
      email: email.toLowerCase().trim(),
      password,
      phone: (phone || "").trim(),
      roles: ["buyer"],
      isVerified: false,
      otp,
      otpExpiry
    });

    await verificationEmailTemplate(newUser.email, newUser.firstName, otp);
    if (!JWT_SECRET) {
      return res.status(500).json({ error: "JWT_SECRET is not configured on the server" });
    }
    const tempToken = jwt.sign(
      { _id: newUser._id, email: newUser.email },
      JWT_SECRET,
      { expiresIn: "15min" }
    );

    const member = await MemberService.joinCooperative({
      userId: newUser._id,
      cooperativeId,
      subscriptionTierId
    });

    return res.status(201).json({
      message: "Account created and joined cooperative. OTP sent to email for verification.",
      member,
      token: tempToken,
      user: {
        _id: newUser._id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        phone: newUser.phone,
        verified: newUser.isVerified,
        roles: newUser.roles
      }
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

module.exports = {
  join,
  guestJoin,
  approve,
  listMembers,
  getMember,
  getDetails,
  removeMember
};
