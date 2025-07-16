const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { authorizePermissions, authorizeRoles } = require('../middleware/authorize');
const { ROLES, PERMISSIONS } = require('../config/roles');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

const router = express.Router();

// Validation middleware
const validateOrder = [
  body('products').isArray().withMessage('Products must be an array'),
  body('products.*.productId').notEmpty().withMessage('Product ID is required'),
  body('products.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
];

// Create order from cart
router.post(
  '/',
  auth,
  authorizePermissions(PERMISSIONS.CREATE_ORDER),
  async (req, res) => {
    try {
      // Get user's cart
      const cart = await Cart.findOne({ userId: req.user._id })
        .populate('products.productId');

      if (!cart || cart.products.length === 0) {
        return res.status(400).json({ message: 'Cart is empty' });
      }

      // Calculate total amount and prepare order products
      let totalAmount = 0;
      const orderProducts = [];

      for (const item of cart.products) {
        const product = item.productId;
        const price = product.price;
        const quantity = item.quantity;

        totalAmount += price * quantity;
        orderProducts.push({
          productId: product._id,
          quantity: quantity,
          price: price,
        });
      }

      // Create order
      const order = new Order({
        userId: req.user._id,
        products: orderProducts,
        totalAmount: totalAmount,
      });

      await order.save();

      // Clear cart
      cart.products = [];
      await cart.save();

      // Populate order details
      await order.populate('products.productId');
      await order.populate('userId', 'name email');

      res.status(201).json(order);
    } catch (error) {
      res.status(500).json({ message: 'Error creating order', error: error.message });
    }
  }
);

// Get all orders (Admin and Seller)
router.get(
  '/',
  auth,
  authorizePermissions(PERMISSIONS.READ_ORDER),
  async (req, res) => {
    try {
      const query = {};
      
      // Sellers can only see orders containing their products
      if (req.user.role === ROLES.SELLER) {
        const sellerProducts = await Product.find({ sellerId: req.user._id });
        const productIds = sellerProducts.map(product => product._id);
        query['products.productId'] = { $in: productIds };
      }

      const orders = await Order.find(query)
        .populate('userId', 'name email')
        .populate('products.productId')
        .sort({ createdAt: -1 });

      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching orders', error: error.message });
    }
  }
);

// Get user's orders
router.get(
  '/my-orders',
  auth,
  authorizePermissions(PERMISSIONS.READ_ORDER),
  async (req, res) => {
    try {
      const orders = await Order.find({ userId: req.user._id })
        .populate('products.productId')
        .sort({ createdAt: -1 });

      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching orders', error: error.message });
    }
  }
);

// Get order by ID
router.get(
  '/:id',
  auth,
  authorizePermissions(PERMISSIONS.READ_ORDER),
  async (req, res) => {
    try {
      const order = await Order.findById(req.params.id)
        .populate('userId', 'name email')
        .populate('products.productId');

      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      // Check if user has permission to view this order
      if (
        req.user.role !== ROLES.ADMIN &&
        order.userId.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({ message: 'Not authorized to view this order' });
      }

      res.json(order);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching order', error: error.message });
    }
  }
);

// Update order status (Admin and Seller)
router.patch(
  '/:id/status',
  auth,
  authorizePermissions(PERMISSIONS.UPDATE_ORDER),
  [
    body('status')
      .isIn(['pending', 'processing', 'shipped', 'delivered', 'cancelled'])
      .withMessage('Invalid status'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const order = await Order.findById(req.params.id)
        .populate('products.productId');

      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      // Sellers can only update orders containing their products
      if (req.user.role === ROLES.SELLER) {
        const hasSellerProduct = order.products.some(
          item => item.productId.sellerId.toString() === req.user._id.toString()
        );

        if (!hasSellerProduct) {
          return res.status(403).json({ message: 'Not authorized to update this order' });
        }
      }

      order.status = req.body.status;
      await order.save();

      res.json(order);
    } catch (error) {
      res.status(500).json({ message: 'Error updating order status', error: error.message });
    }
  }
);

// Cancel order (User can cancel their own pending orders)
router.delete(
  '/:id',
  auth,
  authorizePermissions(PERMISSIONS.CANCEL_ORDER),
  async (req, res) => {
    try {
      const order = await Order.findOne({
        _id: req.params.id,
        userId: req.user._id,
        status: 'pending',
      });

      if (!order) {
        return res.status(404).json({ message: 'Order not found or cannot be cancelled' });
      }

      order.status = 'cancelled';
      await order.save();

      res.json({ message: 'Order cancelled successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error cancelling order', error: error.message });
    }
  }
);

module.exports = router; 