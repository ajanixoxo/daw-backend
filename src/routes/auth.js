const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { ROLES } = require('../config/roles');
const Cooperative = require('../models/Cooperative');
const Membership = require('../models/Membership');
const Store = require('../models/Store');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Review = require('../models/Review');

const router = express.Router();

// Validation middleware
const validateRegistration = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').trim().isEmail().withMessage('Please enter a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/\d/)
    .withMessage('Password must contain a number'),
  body('confirmPassword')
    .notEmpty()
    .withMessage('Confirm password is required')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
  body('role')
    .optional()
    .isIn(Object.values(ROLES))
    .withMessage('Invalid role specified'),
];

const validateLogin = [
  body('email').trim().isEmail().withMessage('Please enter a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
];

// Register a new user
router.post('/register', validateRegistration, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, confirmPassword, role = ROLES.BUYER } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user
    const user = new User({
      name,
      email,
      password,
      role,
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key-here',
      { expiresIn: '24h' }
    );

    // Update last login
    user.lastLogin = Date.now();
    await user.save();

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating user', error: error.message });
  }
});

// Login user
router.post('/login', validateLogin, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, loginType } = req.body;
    
    

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if user is active
    if (!user.isActive()) {
      return res.status(403).json({ message: 'Your account is not active' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id,
        role: loginType==="admin" ? ROLES.ADMIN : "buyer"
       },
      process.env.JWT_SECRET || 'your-secret-key-here',
      { expiresIn: '24h' }
    );

    // Update last login
    user.lastLogin = Date.now();
    await user.save();

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
});

// Get current user profile with comprehensive information
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Base profile response
    const profileResponse = {
      user: user.toObject(),
      cooperative: null,
      membership: null,
      stores: [],
      products: [],
      orders: {
        summary: {
          total: 0,
          pending: 0,
          completed: 0,
          cancelled: 0
        },
        recent: []
      },
      reviews: {
        summary: {
          total: 0,
          averageRating: 0
        },
        recent: []
      },
      statistics: {}
    };

    // For non-buyer users, include comprehensive information
    if (user.role !== ROLES.BUYER) {
      console.log(`Fetching comprehensive profile for ${user.role} user: ${user.email}`);

      // Get cooperative information if user is part of one
      if (user.cooperativeId) {
        const cooperative = await Cooperative.findById(user.cooperativeId);
        if (cooperative) {
          profileResponse.cooperative = cooperative.getSummary();
        }
      }

      const associatedCooperativeAdmin = await Cooperative.findOne({ adminId: user._id });

      if (associatedCooperativeAdmin) {
        profileResponse.associated_coorporative_admin = associatedCooperativeAdmin._id
      }

      // Get membership information
      const memberships = await Membership.find({ userId: user._id })
        .populate('cooperativeId', 'name description cooperative_id imageUrl contactInfo')
        .sort({ joinedAt: -1 });

      if (memberships.length > 0) {
        profileResponse.membership = memberships.map(membership => ({
          id: membership._id,
          cooperative: membership.cooperativeId,
          roleInCoop: membership.roleInCoop,
          status: membership.status,
          membershipNumber: membership.membershipNumber,
          joinedAt: membership.joinedAt,
          approvedAt: membership.approvedAt,
          fees: membership.fees
        }));

        // If user doesn't have cooperativeId but has active membership, use the first active one
        if (!user.cooperativeId && memberships.length > 0) {
          const activeMembership = memberships.find(m => m.status === 'active');
          if (activeMembership && activeMembership.cooperativeId) {
            profileResponse.cooperative = activeMembership.cooperativeId;
          }
        }
      }

      // Get user's stores (for sellers/cooperative admins)
      if (user.role === ROLES.SELLER || user.role === ROLES.COOPERATIVE_ADMIN || user.role === ROLES.ADMIN) {
        const stores = await Store.find({ sellerId: user._id })
          .populate('cooperativeId', 'name cooperative_id')
          .sort({ createdAt: -1 });

        profileResponse.stores = stores.map(store => ({
          id: store._id,
          name: store.name,
          description: store.description,
          imageUrl: store.imageUrl,
          status: store.status,
          cooperative: store.cooperativeId,
          contactInfo: store.contactInfo,
          location: store.location,
          stats: store.stats,
          verification: store.verification,
          createdAt: store.createdAt
        }));
      }

      // Get user's products (for sellers/cooperative admins)
      if (user.role === ROLES.SELLER || user.role === ROLES.COOPERATIVE_ADMIN || user.role === ROLES.ADMIN) {
        const products = await Product.find({ sellerId: user._id })
          .populate('storeId', 'name')
          .populate('cooperativeId', 'name cooperative_id')
          .sort({ createdAt: -1 })
          .limit(20); // Limit to recent 20 products

        profileResponse.products = products.map(product => ({
          id: product._id,
          title: product.title,
          description: product.description,
          category: product.category,
          subcategory: product.subcategory,
          price: product.price,
          imageUrl: product.imageUrl,
          status: product.status,
          stockStatus: product.stockStatus,
          inventory: product.inventory,
          store: product.storeId,
          cooperative: product.cooperativeId,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt
        }));
      }

      // Get order statistics (for all non-buyers)
      const orderStats = await Order.aggregate([
        { $match: { sellerId: user._id } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalAmount' }
          }
        }
      ]);

      let totalOrders = 0;
      let totalRevenue = 0;
      const orderSummary = {
        total: 0,
        pending: 0,
        completed: 0,
        cancelled: 0,
        totalRevenue: 0
      };

      orderStats.forEach(stat => {
        totalOrders += stat.count;
        totalRevenue += stat.totalAmount;
        orderSummary[stat._id] = stat.count;
      });
      orderSummary.total = totalOrders;
      orderSummary.totalRevenue = totalRevenue;

      profileResponse.orders.summary = orderSummary;

      // Get recent orders
      const recentOrders = await Order.find({ sellerId: user._id })
        .populate('buyerId', 'name email')
        .populate('storeId', 'name')
        .sort({ createdAt: -1 })
        .limit(5);

      profileResponse.orders.recent = recentOrders.map(order => ({
        id: order._id,
        orderNumber: order.orderNumber,
        buyer: order.buyerId,
        store: order.storeId,
        status: order.status,
        totalAmount: order.totalAmount,
        itemCount: order.items.length,
        createdAt: order.createdAt
      }));

      // Get review statistics
      const reviewStats = await Review.aggregate([
        { $match: { sellerId: user._id } },
        {
          $group: {
            _id: null,
            totalReviews: { $sum: 1 },
            averageRating: { $avg: '$rating' }
          }
        }
      ]);

      if (reviewStats.length > 0) {
        profileResponse.reviews.summary = {
          total: reviewStats[0].totalReviews,
          averageRating: Math.round(reviewStats[0].averageRating * 10) / 10
        };
      }

      // Get recent reviews
      const recentReviews = await Review.find({ sellerId: user._id })
        .populate('buyerId', 'name profilePicture')
        .populate('productId', 'title imageUrl')
        .sort({ createdAt: -1 })
        .limit(5);

      profileResponse.reviews.recent = recentReviews.map(review => ({
        id: review._id,
        buyer: review.buyerId,
        product: review.productId,
        rating: review.rating,
        comment: review.comment,
        status: review.status,
        createdAt: review.createdAt
      }));

      // Calculate comprehensive statistics
      profileResponse.statistics = {
        totalStores: profileResponse.stores.length,
        totalProducts: profileResponse.products.length,
        totalOrders: orderSummary.total,
        totalRevenue: orderSummary.totalRevenue,
        totalReviews: profileResponse.reviews.summary.total,
        averageRating: profileResponse.reviews.summary.averageRating,
        activeStores: profileResponse.stores.filter(s => s.status === 'active').length,
        approvedProducts: profileResponse.products.filter(p => p.status === 'approved').length,
        pendingProducts: profileResponse.products.filter(p => p.status === 'pending').length,
        inStockProducts: profileResponse.products.filter(p => p.stockStatus === 'In Stock').length,
        outOfStockProducts: profileResponse.products.filter(p => p.stockStatus === 'Out of Stock').length
      };
    } else {
      // For buyers, include basic order and review information
      const buyerOrders = await Order.find({ buyerId: user._id })
        .populate('storeId', 'name')
        .sort({ createdAt: -1 })
        .limit(5);

      profileResponse.orders.recent = buyerOrders.map(order => ({
        id: order._id,
        orderNumber: order.orderNumber,
        store: order.storeId,
        status: order.status,
        totalAmount: order.totalAmount,
        itemCount: order.items.length,
        createdAt: order.createdAt
      }));

      const buyerOrderStats = await Order.aggregate([
        { $match: { buyerId: user._id } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalSpent: { $sum: '$totalAmount' }
          }
        }
      ]);

      let totalSpent = 0;
      let totalBuyerOrders = 0;
      buyerOrderStats.forEach(stat => {
        totalBuyerOrders += stat.count;
        totalSpent += stat.totalSpent;
        profileResponse.orders.summary[stat._id] = stat.count;
      });
      profileResponse.orders.summary.total = totalBuyerOrders;
      profileResponse.orders.summary.totalSpent = totalSpent;
    }

    console.log(`Profile response prepared for user: ${user.email}, role: ${user.role}`);
    res.json(profileResponse);
  } catch (error) {
    console.error('Error fetching comprehensive profile:', error);
    res.status(500).json({ 
      message: 'Error fetching profile', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Logout user (optional - client-side can handle token removal)
router.post('/logout', auth, async (req, res) => {
  try {
    // You could implement token blacklisting here
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error logging out', error: error.message });
  }
});

module.exports = router; 