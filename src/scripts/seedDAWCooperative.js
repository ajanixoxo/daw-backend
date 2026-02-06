/**
 * Ensures the DAW (Digital African Women) cooperative exists in the database
 * with three subscription tiers. Run once on app startup after DB connect.
 *
 * Admin is determined by env:
 * - DAW_COOP_ADMIN_EMAIL (required): existing user email, OR email for a new admin.
 * - If that user exists → use as admin.
 * - If not, and you provide DAW_COOP_ADMIN_PASSWORD, DAW_COOP_ADMIN_FIRST_NAME,
 *   DAW_COOP_ADMIN_PHONE (and optionally DAW_COOP_ADMIN_LAST_NAME), the seed
 *   creates the admin user with your provided details. No random password is used.
 */

const Cooperative = require("../models/cooperativeModel/cooperative.model.js");
const SubscriptionTier = require("../models/subscriptionTierModel/subscriptionTier.model.js");
const User = require("../models/userModel/user.js");

const DAW_COOP_NAME = "DAW";

async function seedDAWCooperative() {
  try {
    const existing = await Cooperative.findOne({ name: DAW_COOP_NAME });
    if (existing) {
      console.log("[seed] DAW cooperative already exists");
      return;
    }

    const adminEmail = process.env.DAW_COOP_ADMIN_EMAIL?.toLowerCase?.()?.trim?.();
    if (!adminEmail) {
      console.log(
        "[seed] DAW cooperative skipped: set DAW_COOP_ADMIN_EMAIL (and optionally DAW_COOP_ADMIN_PASSWORD, DAW_COOP_ADMIN_FIRST_NAME, DAW_COOP_ADMIN_LAST_NAME, DAW_COOP_ADMIN_PHONE to create the admin)"
      );
      return;
    }

    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      const password = process.env.DAW_COOP_ADMIN_PASSWORD;
      const firstName = process.env.DAW_COOP_ADMIN_FIRST_NAME?.trim?.();
      const phone = process.env.DAW_COOP_ADMIN_PHONE?.trim?.();
      if (!password || !firstName || !phone) {
        console.log(
          "[seed] DAW cooperative skipped: no user with DAW_COOP_ADMIN_EMAIL. Create that user first, or set DAW_COOP_ADMIN_PASSWORD, DAW_COOP_ADMIN_FIRST_NAME, and DAW_COOP_ADMIN_PHONE to create the admin."
        );
        return;
      }
      admin = await User.create({
        firstName,
        lastName: (process.env.DAW_COOP_ADMIN_LAST_NAME || "").trim() || undefined,
        email: adminEmail,
        phone,
        password,
        roles: ["admin"],
        isVerified: false,
      });
      console.log("[seed] Created DAW cooperative admin from env");
    }

    const coop = await Cooperative.create({
      name: DAW_COOP_NAME,
      description: "Digital African Women Cooperative",
      adminId: admin._id,
      subscriptionTiers: [],
      isActive: true,
    });

    const tier1 = await SubscriptionTier.create({
      cooperativeId: coop._id,
      name: "Tier 1",
      monthlyContribution: 25000,
      isActive: true,
    });
    const tier2 = await SubscriptionTier.create({
      cooperativeId: coop._id,
      name: "Tier 2",
      monthlyContribution: 30000,
      isActive: true,
    });
    const tier3 = await SubscriptionTier.create({
      cooperativeId: coop._id,
      name: "Tier 3",
      monthlyContribution: 50000,
      isActive: true,
    });

    coop.subscriptionTiers = [tier1._id, tier2._id, tier3._id];
    await coop.save();

    console.log("[seed] DAW cooperative and 3 tiers created successfully");
  } catch (err) {
    console.error("[seed] Failed to seed DAW cooperative:", err.message);
  }
}

module.exports = { seedDAWCooperative };
