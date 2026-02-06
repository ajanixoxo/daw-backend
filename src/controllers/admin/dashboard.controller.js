const asyncHandler = require('express-async-handler');
const User = require('@models/userModel/user.js');
const Loan = require('@models/loanModel/loan.model.js');
const Product = require('@models/marketPlace/productModel.js');
const Cooperative = require('@models/cooperativeModel/cooperative.model.js');

/**
 * Get Admin Dashboard Stats
 * GET /api/admin/dashboard/stats
 */
const getDashboardStats = asyncHandler(async (req, res) => {
    // 1. Active Users
    // Fetching count of all users
    const activeUsersCount = await User.countDocuments();

    // 2. Cooperatives Stats
    // Pending Cooperatives = Cooperatives where the Admin's KYC is pending
    const pendingCooperativesAgg = await Cooperative.aggregate([
        {
            $lookup: {
                from: "users", // ensure this matches your actual collection name in MongoDB (usually lowercase plural)
                localField: "adminId",
                foreignField: "_id",
                as: "admin"
            }
        },
        { $unwind: "$admin" },
        {
            $match: {
                "admin.kyc_status": { $ne: "verified" } // Pending if not verified (covers 'pending' and 'rejected' or null)
            }
        },
        { $count: "count" }
    ]);
    const pendingCooperativesCount = pendingCooperativesAgg.length > 0 ? pendingCooperativesAgg[0].count : 0;

    const totalCooperativesCount = await Cooperative.countDocuments();

    // 3. Products Stats
    const activeProductsCount = await Product.countDocuments({ status: "available" });

    // 4. Loans Stats (Disbursed or Repaid count as "Total Loans Disbursed" historically)
    const loansStats = await Loan.aggregate([
        {
            $match: {
                status: { $in: ["disbursed", "repaid"] }
            }
        },
        {
            $group: {
                _id: null,
                totalCount: { $sum: 1 },
                totalValue: { $sum: "$amount" }
            }
        }
    ]);

    const totalLoansCount = loansStats.length > 0 ? loansStats[0].totalCount : 0;
    const totalLoansValue = loansStats.length > 0 ? loansStats[0].totalValue : 0;

    // 5. New Stats for User Page
    // Number of Sellers (Users with 'seller' role)
    const numberOfSellers = await User.countDocuments({ roles: "seller" });

    // Number of Categories (Distinct categories in products)
    const categories = await Product.distinct("category");
    const numberOfCategories = categories.length;

    res.status(200).json({
        success: true,
        data: {
            activeUsers: {
                value: activeUsersCount,
                label: "Active Users"
            },
            cooperatives: {
                total: totalCooperativesCount,
                pending: pendingCooperativesCount,
                label: "Cooperatives"
            },
            products: {
                total: activeProductsCount,
                label: "Total Products"
            },
            loans: {
                count: totalLoansCount,
                value: totalLoansValue,
                label: "Total Loans Disbursed"
            },
            pendingApprovals: {
                value: pendingCooperativesCount,
                label: "Pending Approvals"
            },
            // Add new stats
            numberOfSellers: {
                value: numberOfSellers,
                subtitle: "Total Sellers"
            },
            numberOfCategories: {
                value: numberOfCategories,
                subtitle: "Active Categories"
            },
            totalUser: {
                value: activeUsersCount,
                percentageChange: 12.5 // Static for now, consistent with mock
            }
        }
    });
});

/**
 * Get Pending Cooperatives List
 * GET /api/admin/cooperatives/pending
 */
const getPendingCooperatives = asyncHandler(async (req, res) => {
    const pendingCoops = await Cooperative.aggregate([
        {
            $lookup: {
                from: "users",
                localField: "adminId",
                foreignField: "_id",
                as: "admin"
            }
        },
        { $unwind: { path: "$admin", preserveNullAndEmptyArrays: true } },

        {
            $project: {
                name: 1,
                description: 1,
                logoUrl: 1,
                createdAt: 1,
                // Project admin details needed for frontend
                admin: {
                    firstName: 1,
                    lastName: 1,
                    email: 1,
                    kyc_status: 1
                }
            }
        },
        { $sort: { createdAt: -1 } }
    ]);

    res.status(200).json({
        success: true,
        count: pendingCoops.length,
        data: pendingCoops
    });
});

/**
 * Get All Users (Admin)
 * GET /api/admin/users
 */
const getAllUsers = asyncHandler(async (req, res) => {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Search
    const searchQuery = req.query.search;
    let query = {};
    if (searchQuery) {
        query = {
            $or: [
                { firstName: { $regex: searchQuery, $options: "i" } },
                { lastName: { $regex: searchQuery, $options: "i" } },
                { email: { $regex: searchQuery, $options: "i" } }
            ]
        };
    }

    const users = await User.find(query)
        .select("-password -otp -otpExpiry -otpExpires -pin") // Exclude sensitive fields
        .populate("shop", "name description") // Optional: Populate shop if needed
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const totalUsers = await User.countDocuments(query);

    res.status(200).json({
        success: true,
        count: users.length,
        pagination: {
            total: totalUsers,
            page,
            pages: Math.ceil(totalUsers / limit)
        },
        data: users
    });
});

module.exports = {
    getDashboardStats,
    getPendingCooperatives,
    getAllUsers
};
