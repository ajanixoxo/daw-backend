const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/authorize');
const { ROLES } = require('../config/roles');
const Favorites = require('../models/Favorites');
const Product = require('../models/Product');
const User = require('../models/User');

const router = express.Router();

// Validation middleware
const validateProductId = [
  body('productId').notEmpty().isMongoId().withMessage('Valid product ID is required'),
];

// Add product to favorites
router.post('/', 
  auth, 
  validateProductId,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { productId } = req.body;
      const userId = req.user._id;

      // Check if product exists and is available
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

    //   if (!product.isVisibleToBuyers()) {
    //     return res.status(400).json({ 
    //       message: 'Product is not available for favoriting' 
    //     });
    //   }

      // Check if already favorited
      const existingFavorite = await Favorites.findOne({ userId, productId });
      console.log(existingFavorite);
      if (existingFavorite) {
        return res.status(400).json({ 
          message: 'Product is already in your favorites' 
        });
      }

      // Create new favorite
      const favorite = new Favorites({
        userId,
        productId,
        addedAt: new Date(),
      });

      await favorite.save();

      // Populate product details for response
      await favorite.populate({
        path: 'productId',
        select: 'title description price imageUrl category',
        populate: {
          path: 'sellerId',
          select: 'name'
        }
      });

      res.status(201).json({
        message: 'Product added to favorites successfully',
        favorite: favorite.getSummary(),
        product: favorite.productId,
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({ 
          message: 'Product is already in your favorites' 
        });
      }
      res.status(500).json({ 
        message: 'Error adding product to favorites', 
        error: error.message 
      });
    }
  }
);

// Remove product from favorites
router.delete('/:productId', 
  auth, 
  async (req, res) => {
    try {
      const { productId } = req.params;
      const userId = req.user._id;

      // Validate productId format
      if (!productId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ message: 'Invalid product ID format' });
      }

      const favorite = await Favorites.findOneAndDelete({ userId, productId });

      if (!favorite) {
        return res.status(404).json({ 
          message: 'Product not found in your favorites' 
        });
      }

      res.json({
        message: 'Product removed from favorites successfully',
        removedFavorite: favorite.getSummary(),
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error removing product from favorites', 
        error: error.message 
      });
    }
  }
);

// Get user's favorites
router.get('/', 
  auth, 
  async (req, res) => {
    try {
      const { page = 1, limit = 20, sortBy = 'addedAt', sortOrder = 'desc' } = req.query;
      const userId = req.user._id;

      const favorites = await Favorites.find({userId}).populate({
        path: 'productId',
        select: 'title description price imageUrl category status isActive stockStatus inventory',
        populate: [
          {
            path: 'sellerId',
            select: 'name'
          },
          {
            path: 'storeId',
            select: 'name'
          }
        ]
      }).skip((page - 1) * limit).limit(limit).sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 });
     

    //   // Filter out favorites with deleted or inactive products
    //   const validFavorites = favorites.filter(fav => 
    //     fav.productId && fav.productId.isVisibleToBuyers()
    //   );

      const totalCount = await Favorites.countDocuments({userId});

      res.json({
        favorites: favorites,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalFavorites: totalCount,
          limit: parseInt(limit),
        },
        message: 'Favorites retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error fetching favorites', 
        error: error.message 
      });
    }
  }
);

// Check if product is favorited by user
router.get('/check/:productId', 
  auth, 
  async (req, res) => {
    try {
      const { productId } = req.params;
      const userId = req.user._id;

      // Validate productId format
      if (!productId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ message: 'Invalid product ID format' });
      }

      const isFavorited = await Favorites.isFavorited(userId, productId);

      res.json({
        productId,
        isFavorited,
        message: isFavorited ? 'Product is in favorites' : 'Product is not in favorites'
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error checking favorite status', 
        error: error.message 
      });
    }
  }
);

// Get favorites count for user
router.get('/count', 
  auth, 
  async (req, res) => {
    try {
      const userId = req.user._id;
      const count = await Favorites.getUserFavoritesCount(userId);

      res.json({
        userId,
        favoritesCount: count,
        message: 'Favorites count retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error fetching favorites count', 
        error: error.message 
      });
    }
  }
);

// Get product's favorites count (public)
router.get('/product/:productId/count', 
  async (req, res) => {
    try {
      const { productId } = req.params;

      // Validate productId format
      if (!productId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ message: 'Invalid product ID format' });
      }

      // Check if product exists
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      const count = await Favorites.getProductFavoritesCount(productId);

      res.json({
        productId,
        favoritesCount: count,
        message: 'Product favorites count retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error fetching product favorites count', 
        error: error.message 
      });
    }
  }
);

// Get most favorited products (public)
router.get('/popular', 
  async (req, res) => {
    try {
      const { limit = 10 } = req.query;

      const popularProducts = await Favorites.getMostFavorited({
        limit: parseInt(limit)
      });

      res.json({
        popularProducts,
        count: popularProducts.length,
        message: 'Most favorited products retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error fetching popular products', 
        error: error.message 
      });
    }
  }
);

// Clear all favorites (user)
router.delete('/', 
  auth, 
  async (req, res) => {
    try {
      const userId = req.user._id;

      const result = await Favorites.deleteMany({ userId });

      res.json({
        message: 'All favorites cleared successfully',
        deletedCount: result.deletedCount,
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error clearing favorites', 
        error: error.message 
      });
    }
  }
);

// Get user's favorites (Admin access)
router.get('/user/:userId', 
  auth, 
  authorizeRoles(ROLES.ADMIN),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const favorites = await Favorites.getUserFavorites(userId, {
        page: parseInt(page),
        limit: parseInt(limit),
      });

      const totalCount = await Favorites.getUserFavoritesCount(userId);

      res.json({
        userId,
        user: {
          name: user.name,
          email: user.email,
        },
        favorites,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalFavorites: totalCount,
          limit: parseInt(limit),
        },
        message: 'User favorites retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error fetching user favorites', 
        error: error.message 
      });
    }
  }
);

module.exports = router;
