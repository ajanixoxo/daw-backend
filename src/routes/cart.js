const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { authorizePermissions } = require('../middleware/authorize');
const { PERMISSIONS } = require('../config/roles');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

const router = express.Router();

// Validation middleware
const validateCartItem = [
  body('productId').notEmpty().withMessage('Product ID is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
];

// Add to cart
router.post(
  '/add',
  auth,
  authorizePermissions(PERMISSIONS.MANAGE_CART),
  validateCartItem,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { productId, quantity } = req.body;

      // Verify product exists
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      // Find or create cart
      let cart = await Cart.findOne({ userId: req.user._id });
      if (!cart) {
        cart = new Cart({ userId: req.user._id, products: [] });
      }

      // Check if product already in cart
      const existingProductIndex = cart.products.findIndex(
        item => item.productId.toString() === productId
      );

      if (existingProductIndex > -1) {
        // Update quantity if product exists
        cart.products[existingProductIndex].quantity += quantity;
      } else {
        // Add new product if it doesn't exist
        cart.products.push({ productId, quantity });
      }

      await cart.save();

      // Populate product details
      await cart.populate('products.productId');

      res.json(cart);
    } catch (error) {
      res.status(500).json({ message: 'Error adding to cart', error: error.message });
    }
  }
);

// Get user's cart
router.get(
  '/',
  auth,
  authorizePermissions(PERMISSIONS.MANAGE_CART),
  async (req, res) => {
    try {
      const cart = await Cart.findOne({ userId: req.user._id })
        .populate('products.productId');

      if (!cart) {
        return res.json({ products: [] });
      }

      res.json(cart);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching cart', error: error.message });
    }
  }
);

// Update cart item quantity
router.put(
  '/update',
  auth,
  authorizePermissions(PERMISSIONS.MANAGE_CART),
  validateCartItem,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { productId, quantity } = req.body;

      const cart = await Cart.findOne({ userId: req.user._id });
      if (!cart) {
        return res.status(404).json({ message: 'Cart not found' });
      }

      const productIndex = cart.products.findIndex(
        item => item.productId.toString() === productId
      );

      if (productIndex === -1) {
        return res.status(404).json({ message: 'Product not found in cart' });
      }

      if (quantity === 0) {
        // Remove product if quantity is 0
        cart.products.splice(productIndex, 1);
      } else {
        // Update quantity
        cart.products[productIndex].quantity = quantity;
      }

      await cart.save();
      await cart.populate('products.productId');

      res.json(cart);
    } catch (error) {
      res.status(500).json({ message: 'Error updating cart', error: error.message });
    }
  }
);

// Remove item from cart
router.delete(
  '/:productId',
  auth,
  authorizePermissions(PERMISSIONS.MANAGE_CART),
  async (req, res) => {
    try {
      const cart = await Cart.findOne({ userId: req.user._id });
      if (!cart) {
        return res.status(404).json({ message: 'Cart not found' });
      }

      const productIndex = cart.products.findIndex(
        item => item.productId.toString() === req.params.productId
      );

      if (productIndex === -1) {
        return res.status(404).json({ message: 'Product not found in cart' });
      }

      cart.products.splice(productIndex, 1);
      await cart.save();
      await cart.populate('products.productId');

      res.json(cart);
    } catch (error) {
      res.status(500).json({ message: 'Error removing item from cart', error: error.message });
    }
  }
);

// Clear cart
router.delete(
  '/',
  auth,
  authorizePermissions(PERMISSIONS.MANAGE_CART),
  async (req, res) => {
    try {
      const cart = await Cart.findOne({ userId: req.user._id });
      if (!cart) {
        return res.status(404).json({ message: 'Cart not found' });
      }

      cart.products = [];
      await cart.save();

      res.json({ message: 'Cart cleared successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error clearing cart', error: error.message });
    }
  }
);

module.exports = router; 