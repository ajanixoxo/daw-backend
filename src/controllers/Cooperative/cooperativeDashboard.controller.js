const Cooperative = require("@models/cooperativeModel/cooperative.model");
const Member = require("@models/memberModel/member.model");
const Contribution = require("@models/contributionModel/contribution.model");
const User = require("@models/userModel/user");

/**
 * Get dashboard statistics for cooperative admin
 * Returns total members count and total revenue
 */
exports.getCooperativeDashboardStats = async (req, res) => {
  try {
    // Since there's only one cooperative (DAW), get the first cooperative
    const cooperative = await Cooperative.findOne();
    
    if (!cooperative) {
      return res.status(404).json({
        success: false,
        message: "Cooperative not found"
      });
    }

    // Get total members count
    const totalMembers = await Member.countDocuments({
      cooperativeId: cooperative._id
    });

    // Get total revenue from paid contributions
    const revenueResult = await Contribution.aggregate([
      {
        $match: {
          cooperativeId: cooperative._id,
          status: "paid"
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" }
        }
      }
    ]);

    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

    return res.status(200).json({
      success: true,
      data: {
        totalMembers,
        totalRevenue
      }
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics",
      error: error.message
    });
  }
};

/**
 * Get revenue chart data for the past 12 months
 * Returns monthly revenue aggregated from contributions
 */
exports.getRevenueChartData = async (req, res) => {
  try {
    const cooperative = await Cooperative.findOne();
    
    if (!cooperative) {
      return res.status(404).json({
        success: false,
        message: "Cooperative not found"
      });
    }

    // Calculate date 12 months ago
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    // Aggregate contributions by month
    const revenueData = await Contribution.aggregate([
      {
        $match: {
          cooperativeId: cooperative._id,
          status: "paid",
          createdAt: { $gte: twelveMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          revenue: { $sum: "$amount" }
        }
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 }
      }
    ]);

    // Format data with month names
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const formattedData = revenueData.map(item => ({
      month: monthNames[item._id.month - 1],
      revenue: item.revenue
    }));

    return res.status(200).json({
      success: true,
      data: formattedData
    });
  } catch (error) {
    console.error("Error fetching revenue chart data:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch revenue chart data",
      error: error.message
    });
  }
};

/**
 * Get top members ranked by total contribution amount
 * Returns top 10 members with highest total contributions
 */
exports.getTopMembers = async (req, res) => {
  try {
    const cooperative = await Cooperative.findOne();
    
    if (!cooperative) {
      return res.status(404).json({
        success: false,
        message: "Cooperative not found"
      });
    }

    // Aggregate contributions by member and sort by total amount
    const topMembers = await Contribution.aggregate([
      {
        $match: {
          cooperativeId: cooperative._id,
          status: "paid"
        }
      },
      {
        $group: {
          _id: "$member",
          totalContributed: { $sum: "$amount" },
          contributionCount: { $sum: 1 }
        }
      },
      {
        $sort: { totalContributed: -1 }
      },
      {
        $limit: 10
      },
      {
        $lookup: {
          from: "members",
          localField: "_id",
          foreignField: "_id",
          as: "memberData"
        }
      },
      {
        $unwind: "$memberData"
      },
      {
        $lookup: {
          from: "users",
          localField: "memberData.userId",
          foreignField: "_id",
          as: "userData"
        }
      },
      {
        $unwind: "$userData"
      },
      {
        $project: {
          userId: "$userData._id",
          firstName: "$userData.firstName",
          lastName: "$userData.lastName",
          email: "$userData.email",
          avatar: "$userData.avatar",
          totalContributed: 1,
          contributionCount: 1
        }
      }
    ]);

    return res.status(200).json({
      success: true,
      data: topMembers
    });
  } catch (error) {
    console.error("Error fetching top members:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch top members",
      error: error.message
    });
  }
};

/**
 * Get recent members who joined the DAW cooperative
 * Returns the 4 most recent members
 */
exports.getRecentMembers = async (req, res) => {
  try {
    const cooperative = await Cooperative.findOne();
    
    if (!cooperative) {
      return res.status(404).json({
        success: false,
        message: "Cooperative not found"
      });
    }

    // Find the 4 most recent members (no date filter)
    const recentMembers = await Member.find({
      cooperativeId: cooperative._id
    })
      .populate("userId", "firstName lastName email")
      .populate("subscriptionTierId", "name")
      .sort({ createdAt: -1 })
      .limit(4)
      .lean();

    // Format the response
    const formattedMembers = recentMembers.map(member => ({
      userId: member.userId._id,
      firstName: member.userId.firstName,
      lastName: member.userId.lastName,
      email: member.userId.email,
      joinDate: member.createdAt,
      subscriptionTier: member.subscriptionTierId?.name || "N/A",
      status: member.status || "active"
    }));

    return res.status(200).json({
      success: true,
      data: formattedMembers
    });
  } catch (error) {
    console.error("Error fetching recent members:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch recent members",
      error: error.message
    });
  }
};
