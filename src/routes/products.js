const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { authorizePermissions, authorizeOwnership } = require('../middleware/authorize');
const { PERMISSIONS } = require('../config/roles');
const Product = require('../models/Product');

const router = express.Router();

// Validation middleware
const validateProduct = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('imageUrl').trim().notEmpty().withMessage('Image URL is required'),
];

// Create product
router.post(
  '/',
  auth,
  authorizePermissions(PERMISSIONS.CREATE_PRODUCT),
  validateProduct,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const product = new Product({
        ...req.body,
        sellerId: req.user._id,
      });

      await product.save();
      res.status(201).json(product);
    } catch (error) {
      res.status(500).json({ message: 'Error creating product', error: error.message });
    }
  }
);

// Get all products with filters and pagination
router.get('/', async (req, res) => {
  try {
    const { 
      category,
      minPrice,
      maxPrice,
      search,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    
    // Apply filters
    if (category) query.category = category;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }
    if (search) {
      query.$text = { $search: search };
    }

    // Count total documents for pagination
    const total = await Product.countDocuments(query);

    // Get paginated results
    const products = await Product.find(query)
      .sort({ [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('sellerId', 'name email');

    res.json({
      products,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalProducts: total,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products', error: error.message });
  }
});

// Get product by ID
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('sellerId', 'name email');
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching product', error: error.message });
  }
});

// Update product
router.put(
  '/:id',
  auth,
  authorizePermissions(PERMISSIONS.UPDATE_PRODUCT),
  authorizeOwnership('sellerId'),
  validateProduct,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const product = await Product.findOneAndUpdate(
        { _id: req.params.id, sellerId: req.user._id },
        req.body,
        { new: true, runValidators: true }
      );

      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      res.json(product);
    } catch (error) {
      res.status(500).json({ message: 'Error updating product', error: error.message });
    }
  }
);

// Delete product
router.delete(
  '/:id',
  auth,
  authorizePermissions(PERMISSIONS.DELETE_PRODUCT),
  authorizeOwnership('sellerId'),
  async (req, res) => {
    try {
      const product = await Product.findOneAndDelete({
        _id: req.params.id,
        sellerId: req.user._id,
      });

      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      res.json({ message: 'Product deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting product', error: error.message });
    }
  }
);

// Get seller's products
router.get(
  '/seller/my-products',
  auth,
  authorizePermissions(PERMISSIONS.READ_PRODUCT),
  async (req, res) => {
    try {
      const products = await Product.find({ sellerId: req.user._id });
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching seller products', error: error.message });
    }
  }
);

module.exports = router; 