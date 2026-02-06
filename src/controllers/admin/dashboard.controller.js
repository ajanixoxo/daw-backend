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
    const activeUsersCount = await User.countDocuments({ status: "active" });

    // 2. Cooperatives Stats
    const pendingCooperativesCount = await Cooperative.countDocuments({ status: "pending" });
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

    // 5. Pending Approvals (Cooperatives List)
    // Fetching a preview list here might be useful, or a separate endpoint.
    // The prompt asked for "Pending Approval Table" to fetch from Cooperatives.
    // We'll keep this endpoint for stats only to be clean.

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
                total: activeProductsCount, // Currently mapping "Total Products" on UI to "Active/Available"
                label: "Total Products"
            },
            loans: {
                count: totalLoansCount,
                value: totalLoansValue,
                label: "Total Loans Disbursed"
            },
            pendingApprovals: {
                value: pendingCooperativesCount, // For the stat card
                label: "Pending Approvals"
            }
        }
    });
});

module.exports = {
    getDashboardStats
};
