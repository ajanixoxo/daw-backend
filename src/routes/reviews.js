const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { authorizeRoles, authorizeOwnership } = require('../middleware/authorize');
const { ROLES } = require('../config/roles');
const Review = require('../models/Review');
const Product = require('../models/Product');
const Store = require('../models/Store');
const Cooperative = require('../models/Cooperative');
const Order = require('../models/Order');
const User = require('../models/User');

const router = express.Router();

// Validation middleware
const validateReview = [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').trim().notEmpty().withMessage('Review comment is required'),
  body('title').optional().trim().isLength({ max: 100 }).withMessage('Title must be less than 100 characters'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
];

// Add review (Buyer)
router.post('/', 
  auth, 
  authorizeRoles(ROLES.BUYER),
  validateReview,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { 
        productId, 
        storeId, 
        cooperativeId, 
        rating, 
        comment, 
        title, 
        tags 
      } = req.body;

      // Validate that only one entity is being reviewed
      const entityCount = [productId, storeId, cooperativeId].filter(Boolean).length;
      if (entityCount !== 1) {
        return res.status(400).json({ 
          message: 'You must review exactly one entity (product, store, or cooperative)' 
        });
      }

      // Check if entity exists and user has permission to review it
      let entity, entityType;
      
      if (productId) {
        entity = await Product.findById(productId);
        entityType = 'product';
        if (!entity || !entity.isVisibleToBuyers()) {
          return res.status(404).json({ message: 'Product not found or not available' });
        }
      } else if (storeId) {
        entity = await Store.findById(storeId);
        entityType = 'store';
        if (!entity || !entity.isActiveAndVerified()) {
          return res.status(404).json({ message: 'Store not found or not available' });
        }
      } else if (cooperativeId) {
        entity = await Cooperative.findById(cooperativeId);
        entityType = 'cooperative';
        if (!entity || !entity.isActiveAndVerified()) {
          return res.status(404).json({ message: 'Cooperative not found or not available' });
        }
      }

      // Check if user has already reviewed this entity
      const existingReview = await Review.findOne({
        buyerId: req.user._id,
        [entityType + 'Id']: entity._id,
      });

      if (existingReview) {
        return res.status(400).json({ 
          message: `You have already reviewed this ${entityType}` 
        });
      }

      // For product reviews, check if user has purchased the product (optional verification)
      if (productId) {
        const hasPurchased = await Order.findOne({
          buyerId: req.user._id,
          'items.productId': productId,
          status: { $in: ['completed', 'delivered'] },
        });

        if (hasPurchased) {
          // Mark review as purchase verified
          req.body.verification = {
            isVerified: true,
            purchaseVerified: true,
            orderId: hasPurchased._id,
          };
        }
      }

      // Create review
      const review = new Review({
        buyerId: req.user._id,
        productId,
        storeId,
        cooperativeId,
        rating,
        comment,
        title,
        tags,
        type: entityType,
        status: 'pending', // Requires moderation
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Set verification if available
      if (req.body.verification) {
        review.verification = req.body.verification;
      }

      await review.save();

      res.status(201).json({
        message: 'Review submitted successfully and pending moderation',
        review: review.getSummary(),
        nextSteps: 'Your review will be reviewed by our moderation team',
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error submitting review', 
        error: error.message 
      });
    }
  }
);

// Get reviews for product
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 20, rating, sortBy = 'createdAt' } = req.query;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const reviews = await Review.getEntityReviews('product', productId, {
      page: parseInt(page),
      limit: parseInt(limit),
      rating: rating ? parseInt(rating) : undefined,
      sortBy,
    });

    const stats = await Review.getEntityStats('product', productId);

    res.json({
      productId,
      reviews,
      statistics: stats,
      pagination: {
        totalPages: Math.ceil(stats.totalReviews / limit),
        currentPage: parseInt(page),
        total: stats.totalReviews,
      },
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching product reviews', 
      error: error.message 
    });
  }
});

// Get reviews for store
router.get('/store/:storeId', async (req, res) => {
  try {
    const { storeId } = req.params;
    const { page = 1, limit = 20, rating, sortBy = 'createdAt' } = req.query;

    // Check if store exists
    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    const reviews = await Review.getEntityReviews('store', storeId, {
      page: parseInt(page),
      limit: parseInt(limit),
      rating: rating ? parseInt(rating) : undefined,
      sortBy,
    });

    const stats = await Review.getEntityStats('store', storeId);

    res.json({
      storeId,
      reviews,
      statistics: stats,
      pagination: {
        totalPages: Math.ceil(stats.totalReviews / limit),
        currentPage: parseInt(page),
        total: stats.totalReviews,
      },
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching store reviews', 
      error: error.message 
    });
  }
});

// Get reviews for cooperative
router.get('/cooperative/:cooperativeId', async (req, res) => {
  try {
    const { cooperativeId } = req.params;
    const { page = 1, limit = 20, rating, sortBy = 'createdAt' } = req.query;

    // Check if cooperative exists
    const cooperative = await Cooperative.findById(cooperativeId);
    if (!cooperative) {
      return res.status(404).json({ message: 'Cooperative not found' });
    }

    const reviews = await Review.getEntityReviews('cooperative', cooperativeId, {
      page: parseInt(page),
      limit: parseInt(limit),
      rating: rating ? parseInt(rating) : undefined,
      sortBy,
    });

    const stats = await Review.getEntityStats('cooperative', cooperativeId);

    res.json({
      cooperativeId,
      reviews,
      statistics: stats,
      pagination: {
        totalPages: Math.ceil(stats.totalReviews / limit),
        currentPage: parseInt(page),
        total: stats.totalReviews,
      },
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching cooperative reviews', 
      error: error.message 
    });
  }
});

// Mark review as helpful
router.post('/:id/helpful', 
  auth, 
  async (req, res) => {
    try {
      const reviewId = req.params.id;
      const review = await Review.findById(reviewId);

      if (!review) {
        return res.status(404).json({ message: 'Review not found' });
      }

      if (!review.isVisible()) {
        return res.status(404).json({ message: 'Review not found' });
      }

      await review.markHelpful(req.user._id);

      res.json({
        message: 'Review marked as helpful',
        helpfulCount: review.helpful.count,
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error marking review as helpful', 
        error: error.message 
      });
    }
  }
);

// Remove helpful mark
router.delete('/:id/helpful', 
  auth, 
  async (req, res) => {
    try {
      const reviewId = req.params.id;
      const review = await Review.findById(reviewId);

      if (!review) {
        return res.status(404).json({ message: 'Review not found' });
      }

      if (!review.isVisible()) {
        return res.status(404).json({ message: 'Review not found' });
      }

      await review.removeHelpful(req.user._id);

      res.json({
        message: 'Helpful mark removed',
        helpfulCount: review.helpful.count,
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error removing helpful mark', 
        error: error.message 
      });
    }
  }
);

// Flag review
router.post('/:id/flag', 
  auth, 
  [
    body('reason').isIn(['inappropriate', 'spam', 'fake', 'offensive', 'other'])
      .withMessage('Valid flag reason is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { reason } = req.body;
      const reviewId = req.params.id;
      const review = await Review.findById(reviewId);

      if (!review) {
        return res.status(404).json({ message: 'Review not found' });
      }

      if (!review.isVisible()) {
        return res.status(404).json({ message: 'Review not found' });
      }

      // Check if user has already flagged this review
      const existingFlag = review.moderation.flags.find(
        flag => flag.reportedBy.toString() === req.user._id.toString()
      );

      if (existingFlag) {
        return res.status(400).json({ 
          message: 'You have already flagged this review' 
        });
      }

      await review.flagReview(reason, req.user._id);

      res.json({
        message: 'Review flagged successfully',
        flagCount: review.moderation.flags.length,
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error flagging review', 
        error: error.message 
      });
    }
  }
);

// Get pending reviews for moderation (Admin + Coop Admin)
router.get('/moderation/pending', 
  auth, 
  authorizeRoles(ROLES.ADMIN, ROLES.COOPERATIVE_ADMIN),
  async (req, res) => {
    try {
      const { page = 1, limit = 50, type } = req.query;

      let options = {};
      if (type) options.type = type;

      const reviews = await Review.getPendingReviews({
        page: parseInt(page),
        limit: parseInt(limit),
        ...options,
      });

      res.json({
        reviews,
        pagination: {
          totalPages: Math.ceil(reviews.length / limit),
          currentPage: parseInt(page),
          total: reviews.length,
        },
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error fetching pending reviews', 
        error: error.message 
      });
    }
  }
);

// Approve/Reject review (Admin + Coop Admin)
router.patch('/:id/moderate', 
  auth, 
  authorizeRoles(ROLES.ADMIN, ROLES.COOPERATIVE_ADMIN),
  [
    body('status').isIn(['approved', 'rejected', 'hidden']).withMessage('Valid status is required'),
    body('moderationNotes').optional().trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { status, moderationNotes } = req.body;
      const reviewId = req.params.id;
      const review = await Review.findById(reviewId);

      if (!review) {
        return res.status(404).json({ message: 'Review not found' });
      }

      if (!review.isPendingModeration()) {
        return res.status(400).json({ 
          message: 'Only pending reviews can be moderated' 
        });
      }

      // Update review status
      review.status = status;
      review.moderation = {
        ...review.moderation,
        moderatedBy: req.user._id,
        moderatedAt: new Date(),
        moderationNotes: moderationNotes || '',
      };
      review.updatedAt = new Date();

      await review.save();

      res.json({
        message: `Review ${status} successfully`,
        review: review.getSummary(),
        moderation: review.moderation,
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error moderating review', 
        error: error.message 
      });
    }
  }
);

// Get user's reviews (User(Self) + Admin)
router.get('/user/:userId', 
  auth, 
  authorizeRoles(ROLES.BUYER, ROLES.ADMIN),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20, status, type } = req.query;

      // Check if user has access to these reviews
      if (req.user.role === ROLES.BUYER) {
        if (userId !== req.user._id.toString()) {
          return res.status(403).json({ 
            message: 'You can only view your own reviews' 
          });
        }
      }

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Build query
      const query = { buyerId: userId };
      if (status) query.status = status;
      if (type) query.type = type;

      const reviews = await Review.find(query)
        .populate('productId', 'title')
        .populate('storeId', 'name')
        .populate('cooperativeId', 'name')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });

      const total = await Review.countDocuments(query);

      res.json({
        userId,
        reviews: reviews.map(r => r.getSummary()),
        pagination: {
          totalPages: Math.ceil(total / limit),
          currentPage: parseInt(page),
          total,
        },
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error fetching user reviews', 
        error: error.message 
      });
    }
  }
);

module.exports = router;
