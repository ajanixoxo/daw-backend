const Member = require("../models/memberModel/member.model.js");
const SubscriptionTier = require("../models/subscriptionTierModel/subscriptionTier.model.js");
const Cooperative = require("../models/cooperativeModel/cooperative.model.js");
const Shop = require("../models/marketPlace/shopModel.js");
const User = require("../models/userModel/user.js");
const Loan = require("../models/loanModel/loan.model.js");
const Contribution = require("../models/contributionModel/contribution.model.js");
const Order = require("../models/marketPlace/orderModel.js");
const Product = require("../models/marketPlace/productModel.js");
const marketplaceService = require("./marketPlace/marketPlaceServices.js");

/**
 * Service goals:
 * - create member with monthlyContribution populated from tier
 * - avoid duplicate membership (one per user per cooperative)
 * - attach member id to Cooperative.members
 * - shop creation ONLY if user does not already have one (CASE 1: seller joins → skip shop; CASE 2: buyer joins → create shop)
 * - grant cooperative role additively; preserve existing seller/buyer roles
 */

module.exports = {
  async joinCooperative({ userId, cooperativeId, subscriptionTierId }) {
    // Validate cooperative and tier exist
    const coop = await Cooperative.findById(cooperativeId);
    if (!coop) {throw new Error("Cooperative not found");}

    const tier = await SubscriptionTier.findById(subscriptionTierId);
    if (!tier) {throw new Error("Subscription tier not found");}
    // Guard: tier must belong to the cooperative being joined (backend cannot trust frontend)
    if (String(tier.cooperativeId) !== String(cooperativeId)) {
      throw new Error("Subscription tier does not belong to this cooperative");
    }
    if (tier.isActive === false) {throw new Error("Subscription tier is not active");}

    // Guard: prevent duplicate cooperative membership (idempotent — second join returns error)
    const existingMember = await Member.findOne({ userId, cooperativeId });
    if (existingMember) {throw new Error("User is already a member of this cooperative");}

    let member;
    try {
      member = await Member.create({
        userId,
        cooperativeId,
        subscriptionTierId,
        monthlyContribution: tier.monthlyContribution,
        status: "active",
        joinDate: new Date()
      });
    } catch (err) {
      // DB unique index (userId, cooperativeId) race safety: treat duplicate key as already member
      if (err.code === 11000) {throw new Error("User is already a member of this cooperative");}
      throw err;
    }

    // Attach member to cooperative
    coop.members = coop.members || [];
    coop.members.push(member._id);
    await coop.save();

    // Shop creation ONLY if user does not already have one (CASE 1: seller → skip; CASE 2: buyer → create)
    // Reuse marketplace createShop so one-shop-per-user is enforced in one place.
    const existingShop = await Shop.findOne({ owner_id: userId });
    if (existingShop) {
      // Existing seller joining cooperative — upgrade their shop to member shop
      existingShop.is_member_shop = true;
      existingShop.cooperative_id = cooperativeId;
      await existingShop.save();
    } else {
      const newShop = await marketplaceService.createShop({
        owner_id: userId,
        cooperative_id: cooperativeId,
        name: "My Shop",
        description: "",
        category: "general",
        is_member_shop: true,
        status: "active"
      });
      const u = await User.findById(userId);
      if (u) {
        const roles = new Set(Array.isArray(u.roles) ? u.roles : []);
        roles.add("buyer");
        roles.add("seller");
        u.roles = [...roles];
        u.shop = newShop._id;
        await u.save();
      }
    }

    // Always add cooperative role additively (CASE 1 and CASE 2). Do not overwrite existing roles.
    const u = await User.findById(userId);
    if (u) {
      const roles = new Set(Array.isArray(u.roles) ? u.roles : []);
      roles.add("member");
      u.roles = [...roles];
      await u.save();
    }

    return member;
  },

  async getMembers(cooperativeId) {
    return Member.find({ cooperativeId })
      .populate("userId", "firstName lastName email phone roles status")
      .populate("subscriptionTierId", "name monthlyContribution")
      .sort({ createdAt: -1 })
      .lean();
  },

  async updateStatus(id, status) {
    return Member.findByIdAndUpdate(id, { status }, { new: true });
  },

  async getById(id) {
    return Member.findById(id).populate("subscriptionTierId userId").lean();
  },

  async getDetails(id) {
    const member = await Member.findById(id)
      .populate("userId", "firstName lastName email phone roles status avatar")
      .populate("subscriptionTierId", "name monthlyContribution")
      .lean();

    if (!member) return null;

    // Fetch Shop linked to this user
    const shop = await Shop.findOne({ owner_id: member.userId._id }).lean();

    // Fetch Contribution Stats (Total Paid)
    const contributionStats = await Contribution.aggregate([
      { $match: { memberId: member._id, status: "paid" } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
    ]);
    const totalContributions = contributionStats[0]?.total || 0;
    const contributionsCount = contributionStats[0]?.count || 0;

    // Fetch Loan Stats
    // Active loans, Total Loans taken
    const loanStats = await Loan.aggregate([
      { $match: { memberId: member._id } },
      {
        $group: {
          _id: null,
          totalLoans: { $sum: 1 },
          activeLoans: { $sum: { $cond: [{ $in: ["$status", ["active", "disbursed", "approved"]] }, 1, 0] } },
          totalAmount: { $sum: "$amount" }
        }
      }
    ]);
    const totalLoans = loanStats[0]?.totalLoans || 0;
    const activeLoans = loanStats[0]?.activeLoans || 0;

    // Marketplace Stats
    let totalSales = 0;
    let ordersCompleted = 0;
    let productsListed = 0;

    if (shop) {
      // Products Listed
      productsListed = await Product.countDocuments({ shop_id: shop._id });

      // Sales & Orders
      const orderStats = await Order.aggregate([
         { $match: { shop_id: shop._id } },
         { 
           $group: {
             _id: null,
             totalSales: { 
               $sum: { $cond: [{ $eq: ["$payment_status", "paid"] }, "$total_amount", 0] }
             },
             ordersCompleted: {
               $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] }
             }
           }
         }
      ]);

      if (orderStats.length > 0) {
        totalSales = orderStats[0].totalSales || 0;
        ordersCompleted = orderStats[0].ordersCompleted || 0;
      }
    }
    
    return {
      member,
      shop,
      stats: {
        totalContributions,
        contributionsCount,
        totalLoans,
        activeLoans,
        totalSales,
        productsListed,
        ordersCompleted
      }
    };
  }
};
