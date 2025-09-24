const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/authorize');
const { ROLES } = require('../config/roles');
const User = require('../models/User');
const Store = require('../models/Store');
const Product = require('../models/Product');
const Cooperative = require('../models/Cooperative');
const Membership = require('../models/Membership');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Loan = require('../models/Loan');
const Contribution = require('../models/Contribution');
const Review = require('../models/Review');
const Notification = require('../models/Notification');

const router = express.Router();

// All admin routes require admin role
router.use(auth, authorizeRoles(ROLES.ADMIN));

// View platform stats
router.get('/dashboard', async (req, res) => {
  try {
    // Get user statistics
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });
    const suspendedUsers = await User.countDocuments({ status: 'suspended' });
    
    const userStats = {
      total: totalUsers,
      active: activeUsers,
      suspended: suspendedUsers,
      inactive: totalUsers - activeUsers - suspendedUsers,
    };

    // Get cooperative statistics
    const totalCooperatives = await Cooperative.countDocuments();
    const activeCooperatives = await Cooperative.countDocuments({ status: 'active' });
    const verifiedCooperatives = await Cooperative.countDocuments({ verificationStatus: 'verified' });

    const cooperativeStats = {
      total: totalCooperatives,
      active: activeCooperatives,
      verified: verifiedCooperatives,
      pending: totalCooperatives - activeCooperatives,
    };

    // Get store statistics
    const totalStores = await Store.countDocuments();
    const activeStores = await Store.countDocuments({ status: 'active' });
    const verifiedStores = await Store.countDocuments({ 'verification.isVerified': true });

    const storeStats = {
      total: totalStores,
      active: activeStores,
      verified: verifiedStores,
      pending: totalStores - activeStores,
    };

    // Get product statistics
    const totalProducts = await Product.countDocuments();
    const approvedProducts = await Product.countDocuments({ status: 'approved' });
    const pendingProducts = await Product.countDocuments({ status: 'pending' });

    const productStats = {
      total: totalProducts,
      approved: approvedProducts,
      pending: pendingProducts,
      rejected: totalProducts - approvedProducts - pendingProducts,
    };

    // Get order statistics
    const totalOrders = await Order.countDocuments();
    const completedOrders = await Order.countDocuments({ status: 'completed' });
    const pendingOrders = await Order.countDocuments({ status: 'pending' });

    const orderStats = {
      total: totalOrders,
      completed: completedOrders,
      pending: pendingOrders,
      cancelled: totalOrders - completedOrders - pendingOrders,
    };

    // Get financial statistics
    const totalPayments = await Payment.countDocuments({ status: 'completed' });
    const totalRevenue = await Payment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const financialStats = {
      totalPayments,
      totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
      averageOrderValue: totalOrders > 0 ? (totalRevenue.length > 0 ? totalRevenue[0].total / totalOrders : 0) : 0,
    };

    // Get loan statistics
    const totalLoans = await Loan.countDocuments();
    const activeLoans = await Loan.countDocuments({ status: 'active' });
    const overdueLoans = await Loan.countDocuments({
      status: 'active',
      dueDate: { $lt: new Date() },
    });

    const loanStats = {
      total: totalLoans,
      active: activeLoans,
      overdue: overdueLoans,
      pending: totalLoans - activeLoans,
    };

    // Get contribution statistics
    const totalContributions = await Contribution.countDocuments();
    const confirmedContributions = await Contribution.countDocuments({ status: 'confirmed' });
    const totalContributionAmount = await Contribution.aggregate([
      { $match: { status: 'confirmed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const contributionStats = {
      total: totalContributions,
      confirmed: confirmedContributions,
      pending: totalContributions - confirmedContributions,
      totalAmount: totalContributionAmount.length > 0 ? totalContributionAmount[0].total : 0,
    };

    // Get review statistics
    const totalReviews = await Review.countDocuments();
    const approvedReviews = await Review.countDocuments({ status: 'approved' });
    const pendingReviews = await Review.countDocuments({ status: 'pending' });

    const reviewStats = {
      total: totalReviews,
      approved: approvedReviews,
      pending: pendingReviews,
      rejected: totalReviews - approvedReviews - pendingReviews,
    };

    // Get notification statistics
    const totalNotifications = await Notification.countDocuments();
    const unreadNotifications = await Notification.countDocuments({ status: 'unread' });
    const scheduledNotifications = await Notification.countDocuments({ 'scheduling.isScheduled': true });

    const notificationStats = {
      total: totalNotifications,
      unread: unreadNotifications,
      scheduled: scheduledNotifications,
      read: totalNotifications - unreadNotifications,
    };

    res.json({
      message: 'Platform statistics retrieved successfully',
              statistics: {
          users: userStats,
          cooperatives: cooperativeStats,
          stores: storeStats,
          products: productStats,
          orders: orderStats,
          financial: financialStats,
          loans: loanStats,
          contributions: contributionStats,
          reviews: reviewStats,
          notifications: notificationStats,
        },
      lastUpdated: new Date(),
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching platform statistics', 
      error: error.message 
    });
  }
});

// Suspend user
router.patch('/users/:id/suspend', 
  [
    body('reason').trim().notEmpty().withMessage('Suspension reason is required'),
    body('duration').optional().isInt({ min: 1 }).withMessage('Duration must be a positive integer'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { reason, duration } = req.body;
      const userId = req.params.id;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (user.role === ROLES.ADMIN) {
        return res.status(400).json({ 
          message: 'Cannot suspend another admin user' 
        });
      }

      // Calculate suspension end date
      let suspensionEndDate = null;
      if (duration) {
        suspensionEndDate = new Date();
        suspensionEndDate.setDate(suspensionEndDate.getDate() + duration);
      }

      user.status = 'suspended';
      user.updatedAt = new Date();
      
      // Store suspension details
      user.suspensionDetails = {
        reason,
        suspendedAt: new Date(),
        suspendedBy: req.user._id,
        duration,
        endDate: suspensionEndDate,
      };

      await user.save();

      res.json({
        message: 'User suspended successfully',
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          status: user.status,
          suspensionDetails: user.suspensionDetails,
        },
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error suspending user', 
        error: error.message 
      });
    }
  }
);

// Reactivate user
router.patch('/users/:id/reactivate', async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.status !== 'suspended') {
      return res.status(400).json({ 
        message: 'User is not suspended' 
      });
    }

    user.status = 'active';
    user.updatedAt = new Date();
    user.suspensionDetails = null;

    await user.save();

    res.json({
      message: 'User reactivated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        status: user.status,
      },
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error reactivating user', 
      error: error.message 
    });
  }
});

// Suspend store
router.patch('/stores/:id/suspend', 
  [
    body('reason').trim().notEmpty().withMessage('Suspension reason is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { reason } = req.body;
      const storeId = req.params.id;

      const store = await Store.findById(storeId);
      if (!store) {
        return res.status(404).json({ message: 'Store not found' });
      }

      store.status = 'suspended';
      store.updatedAt = new Date();
      store.suspensionDetails = {
        reason,
        suspendedAt: new Date(),
        suspendedBy: req.user._id,
      };

      await store.save();

      res.json({
        message: 'Store suspended successfully',
        store: {
          id: store._id,
          name: store.name,
          status: store.status,
          suspensionDetails: store.suspensionDetails,
        },
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error suspending store', 
        error: error.message 
      });
    }
  }
);

// Reactivate store
router.patch('/stores/:id/reactivate', async (req, res) => {
  try {
    const storeId = req.params.id;

    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    if (store.status !== 'suspended') {
      return res.status(400).json({ 
        message: 'Store is not suspended' 
      });
    }

    store.status = 'active';
    store.updatedAt = new Date();
    store.suspensionDetails = null;

    await store.save();

    res.json({
      message: 'Store reactivated successfully',
      store: {
        id: store._id,
        name: store.name,
        status: store.status,
      },
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error reactivating store', 
      error: error.message 
    });
  }
});

// Suspend product
router.patch('/products/:id/suspend', 
  [
    body('reason').trim().notEmpty().withMessage('Suspension reason is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { reason } = req.body;
      const productId = req.params.id;

      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      product.status = 'suspended';
      product.updatedAt = new Date();
      product.suspensionDetails = {
        reason,
        suspendedAt: new Date(),
        suspendedBy: req.user._id,
      };

      await product.save();

      res.json({
        message: 'Product suspended successfully',
        product: {
          id: product._id,
          title: product.title,
          status: product.status,
          suspensionDetails: product.suspensionDetails,
        },
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error suspending product', 
        error: error.message 
      });
    }
  }
);

// Reactivate product
router.patch('/products/:id/reactivate', async (req, res) => {
  try {
    const productId = req.params.id;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (product.status !== 'suspended') {
      return res.status(400).json({ 
        message: 'Product is not suspended' 
      });
    }

    product.status = 'approved';
    product.updatedAt = new Date();
    product.suspensionDetails = null;

    await product.save();

    res.json({
      message: 'Product reactivated successfully',
      product: {
        id: product._id,
        title: product.title,
        status: product.status,
      },
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error reactivating product', 
      error: error.message 
    });
  }
});

// Get system health status
router.get('/health', async (req, res) => {
  try {
    // Check database connection
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

    // Check model counts
    const userCount = await User.countDocuments();
    const cooperativeCount = await Cooperative.countDocuments();
    const storeCount = await Store.countDocuments();
    const productCount = await Product.countDocuments();

    // Check for any critical issues
    const criticalIssues = [];
    
    // Check for overdue loans
    const overdueLoans = await Loan.countDocuments({
      status: 'active',
      dueDate: { $lt: new Date() },
    });
    
    if (overdueLoans > 0) {
      criticalIssues.push(`${overdueLoans} overdue loans`);
    }

    // Check for failed payments
    const failedPayments = await Payment.countDocuments({
      status: 'failed',
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
    });
    
    if (failedPayments > 10) {
      criticalIssues.push(`${failedPayments} failed payments in last 24 hours`);
    }

    const healthStatus = {
      status: criticalIssues.length > 0 ? 'warning' : 'healthy',
      timestamp: new Date(),
      database: dbStatus,
      models: {
        users: userCount,
        cooperatives: cooperativeCount,
        stores: storeCount,
        products: productCount,
      },
      criticalIssues,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };

    res.json({
      message: 'System health status retrieved successfully',
      health: healthStatus,
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching system health status', 
      error: error.message 
    });
  }
});

// Get admin audit log
router.get('/audit-log', async (req, res) => {
  try {
    const { page = 1, limit = 50, action, userId, startDate, endDate } = req.query;

    // This would typically come from a separate audit log collection
    // For now, we'll return a placeholder response
    const auditLog = {
      entries: [],
      pagination: {
        totalPages: 0,
        currentPage: parseInt(page),
        total: 0,
      },
    };

    res.json({
      message: 'Audit log retrieved successfully',
      auditLog,
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching audit log', 
      error: error.message 
    });
  }
});

// Export platform data
router.get('/export/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { format = 'json', startDate, endDate } = req.query;

    let data;
    let filename;

    switch (type) {
      case 'users':
        data = await User.find().select('-password');
        filename = 'users-export';
        break;
      case 'cooperatives':
        data = await Cooperative.find();
        filename = 'cooperatives-export';
        break;
      case 'stores':
        data = await Store.find();
        filename = 'stores-export';
        break;
      case 'products':
        data = await Product.find();
        filename = 'products-export';
        break;
      case 'orders':
        data = await Order.find();
        filename = 'orders-export';
        break;
      case 'payments':
        data = await Payment.find();
        filename = 'payments-export';
        break;
      default:
        return res.status(400).json({ 
          message: 'Invalid export type. Supported types: users, cooperatives, stores, products, orders, payments' 
        });
    }

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      res.json(data);
    } else {
      res.status(400).json({ 
        message: 'Only JSON format is currently supported' 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      message: 'Error exporting data', 
      error: error.message 
    });
  }
});

module.exports = router;
