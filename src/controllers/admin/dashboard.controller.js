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

module.exports = {
    getDashboardStats,
    getPendingCooperatives
};
