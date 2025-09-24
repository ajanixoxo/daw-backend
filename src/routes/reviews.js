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
        if (!entity) {
          return res.status(404).json({ message: 'Product not found or not available' });
        }
      } else if (storeId) {
        entity = await Store.findById(storeId);
        entityType = 'store';
        if (!entity) {
          return res.status(404).json({ message: 'Store not found or not available' });
        }
      } else if (cooperativeId) {
        entity = await Cooperative.findById(cooperativeId);
        entityType = 'cooperative';
        if (!entity) {
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




// Delete review (Buyer - own reviews only, Admin - any review)
router.delete('/:id', 
  auth, 
  authorizeRoles(ROLES.BUYER, ROLES.ADMIN),
  async (req, res) => {
    try {
      const reviewId = req.params.id;

      // Find review
      const review = await Review.findById(reviewId);
      if (!review) {
        return res.status(404).json({ message: 'Review not found' });
      }

      // Check permissions
      const isOwner = review.buyerId.toString() === req.user._id.toString();
      const isAdmin = req.user.role === ROLES.ADMIN;

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ 
          message: 'You can only delete your own reviews' 
        });
      }

      // Store review info for response
      const reviewSummary = review.getSummary();

      // Delete the review
      await Review.findByIdAndDelete(reviewId);

      res.json({
        message: 'Review deleted successfully',
        deletedReview: reviewSummary,
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error deleting review', 
        error: error.message 
      });
    }
  }
);

// Get review by ID (public for approved reviews)
router.get('/:id', 
  async (req, res) => {
    try {
      const reviewId = req.params.id;

      const review = await Review.findById(reviewId)
        .populate('buyerId', 'name profilePicture')
        .populate('productId', 'title imageUrl')
        .populate('storeId', 'name')
        .populate('cooperativeId', 'name');

      if (!review) {
        return res.status(404).json({ message: 'Review not found' });
      }

      // Only show approved reviews to public, unless user is owner or admin
      if (review.status !== 'approved') {
        // Check if user is authenticated and is owner or admin
        if (!req.user) {
          return res.status(404).json({ message: 'Review not found' });
        }

        const isOwner = review.buyerId._id.toString() === req.user._id.toString();
        const isAdmin = req.user.role === ROLES.ADMIN;

        if (!isOwner && !isAdmin) {
          return res.status(404).json({ message: 'Review not found' });
        }
      }

      res.json({
        review: {
          ...review.getSummary(),
          buyer: review.buyerId,
          product: review.productId,
          store: review.storeId,
          cooperative: review.cooperativeId,
          images: review.images,
          verification: review.verification,
        },
        message: 'Review retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error fetching review', 
        error: error.message 
      });
    }
  }
);


module.exports = router;