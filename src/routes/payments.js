const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const stripeService = require('../services/stripe');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Order = require('../models/Order');

const router = express.Router();

// Validation middleware
const validatePaymentIntent = [
  body('amount').isFloat({ min: 0.5 }).withMessage('Amount must be at least $0.50'),
  body('currency').optional().isIn(['usd', 'eur', 'gbp']).withMessage('Invalid currency'),
  body('paymentType').isIn(['order', 'subscription', 'wallet_topup', 'masterclass', 'other']).withMessage('Invalid payment type'),
  body('relatedId').optional().isMongoId().withMessage('Invalid related ID'),
];

// POST /api/payments/create-intent - Create payment intent
router.post('/create-intent', auth, validatePaymentIntent, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, currency = 'usd', paymentType, relatedId, description } = req.body;

    // Get or create Stripe customer
    const customer = await stripeService.getOrCreateCustomer(
      req.user.email,
      req.user.name,
      { userId: req.user._id.toString() }
    );

    // Create payment intent
    const { clientSecret, paymentIntentId } = await stripeService.createPaymentIntent(
      amount,
      currency,
      {
        userId: req.user._id.toString(),
        paymentType,
        relatedId: relatedId || '',
        description: description || '',
      }
    );

    // Save payment record
    const payment = new Payment({
      userId: req.user._id,
      stripePaymentIntentId: paymentIntentId,
      stripeCustomerId: customer.id,
      amount,
      currency: currency.toUpperCase(),
      paymentType,
      relatedId,
      description,
      status: 'pending',
    });

    await payment.save();

    res.json({
      clientSecret,
      paymentIntentId,
      customerId: customer.id,
      message: 'Payment intent created successfully',
    });
  } catch (error) {
    console.error('Payment intent creation error:', error);
    res.status(500).json({ 
      message: 'Failed to create payment intent', 
      error: error.message 
    });
  }
});

// POST /api/payments/confirm - Confirm payment
router.post('/confirm', auth, [
  body('paymentIntentId').notEmpty().withMessage('Payment intent ID is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { paymentIntentId } = req.body;

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripeService.retrievePaymentIntent(paymentIntentId);

    // Find payment record
    const payment = await Payment.findOne({ stripePaymentIntentId: paymentIntentId });
    if (!payment) {
      return res.status(404).json({ message: 'Payment record not found' });
    }

    // Check if user owns this payment
    if (payment.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update payment status
    payment.status = paymentIntent.status;
    if (paymentIntent.charges.data.length > 0) {
      const charge = paymentIntent.charges.data[0];
      payment.receiptUrl = charge.receipt_url;
      
      if (charge.payment_method_details) {
        payment.paymentMethod = {
          type: charge.payment_method_details.type,
          last4: charge.payment_method_details.card?.last4,
          brand: charge.payment_method_details.card?.brand,
          country: charge.payment_method_details.card?.country,
        };
      }
    }

    await payment.save();

    // Handle successful payment
    if (paymentIntent.status === 'succeeded') {
      await handleSuccessfulPayment(payment);
    }

    res.json({
      status: paymentIntent.status,
      message: paymentIntent.status === 'succeeded' 
        ? 'Payment completed successfully' 
        : 'Payment status updated',
      payment: {
        id: payment._id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        receiptUrl: payment.receiptUrl,
      },
    });
  } catch (error) {
    console.error('Payment confirmation error:', error);
    res.status(500).json({ 
      message: 'Failed to confirm payment', 
      error: error.message 
    });
  }
});

// GET /api/payments - Get all payments (Admin only) or user's payments
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, paymentType, userId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let filter = {};
    
    // If not admin, only show user's own payments
    if (req.user.role !== 'admin') {
      filter.userId = req.user._id;
    } else {
      // Admin can filter by specific user if provided
      if (userId) filter.userId = userId;
    }
    
    if (status) filter.status = status;
    if (paymentType) filter.paymentType = paymentType;

    const payments = await Payment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'name email role')
      .populate('relatedId');

    const total = await Payment.countDocuments(filter);

    res.json({
      payments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalPayments: total,
        limit: parseInt(limit),
      },
      message: req.user.role === 'admin' ? 'All payments retrieved successfully' : 'User payments retrieved successfully'
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve payments', 
      error: error.message 
    });
  }
});

// GET /api/payments/my - Get user's payments
router.get('/my', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, paymentType } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { userId: req.user._id };
    if (status) filter.status = status;
    if (paymentType) filter.paymentType = paymentType;

    const payments = await Payment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('relatedId');

    const total = await Payment.countDocuments(filter);

    res.json({
      payments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalPayments: total,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve payments', 
      error: error.message 
    });
  }
});

// GET /api/payments/:id - Get single payment
router.get('/:id', auth, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('relatedId');

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    // Check if user owns this payment or is admin
    if (payment.userId._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(payment);
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve payment', 
      error: error.message 
    });
  }
});

// POST /api/payments/:id/refund - Request refund (Admin only)
router.post('/:id/refund', auth, [
  body('amount').optional().isFloat({ min: 0.01 }).withMessage('Refund amount must be positive'),
  body('reason').optional().isIn(['duplicate', 'fraudulent', 'requested_by_customer']).withMessage('Invalid refund reason'),
], async (req, res) => {
  try {
    // Check admin permission
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin role required.' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, reason = 'requested_by_customer' } = req.body;

    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    if (!payment.canBeRefunded()) {
      return res.status(400).json({ message: 'Payment cannot be refunded' });
    }

    // Create refund in Stripe
    const refund = await stripeService.createRefund(
      payment.stripePaymentIntentId,
      amount,
      reason
    );

    // Add refund to payment record
    payment.addRefund({
      stripeRefundId: refund.id,
      amount: refund.amount / 100, // Convert from cents
      reason: refund.reason,
      status: refund.status,
    });

    await payment.save();

    res.json({
      message: 'Refund processed successfully',
      refund: {
        id: refund.id,
        amount: refund.amount / 100,
        status: refund.status,
      },
      payment: {
        id: payment._id,
        status: payment.status,
        totalRefunded: payment.totalRefunded,
      },
    });
  } catch (error) {
    console.error('Refund error:', error);
    res.status(500).json({ 
      message: 'Failed to process refund', 
      error: error.message 
    });
  }
});

// GET /api/payments/admin/all - Get all payments (Admin only, no restrictions)
router.get('/admin/all', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin role required.' });
    }

    const { page = 1, limit = 10, status, paymentType, userId, startDate, endDate, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let filter = {};
    
    if (status) filter.status = status;
    if (paymentType) filter.paymentType = paymentType;
    if (userId) filter.userId = userId;
    
    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const payments = await Payment.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'name email role phone')
      .populate('relatedId');

    const total = await Payment.countDocuments(filter);

    // Calculate summary statistics
    const totalAmount = await Payment.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const statusCounts = await Payment.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    res.json({
      payments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalPayments: total,
        limit: parseInt(limit),
      },
      summary: {
        totalAmount: totalAmount.length > 0 ? totalAmount[0].total : 0,
        statusBreakdown: statusCounts,
      },
      message: 'All payments retrieved successfully'
    });
  } catch (error) {
    console.error('Get all payments error:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve all payments', 
      error: error.message 
    });
  }
});

// GET /api/payments/admin/stats - Get payment statistics (Admin only)
router.get('/admin/stats', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin role required.' });
    }

    const { startDate, endDate } = req.query;
    const dateRange = {};
    
    if (startDate) dateRange.start = startDate;
    if (endDate) dateRange.end = endDate;

    const stats = await Payment.getStats(dateRange);
    const totalPayments = await Payment.countDocuments();
    const successfulPayments = await Payment.countDocuments({ status: 'succeeded' });

    res.json({
      totalPayments,
      successfulPayments,
      successRate: totalPayments > 0 ? ((successfulPayments / totalPayments) * 100).toFixed(2) : 0,
      statusBreakdown: stats,
    });
  } catch (error) {
    console.error('Payment stats error:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve payment statistics', 
      error: error.message 
    });
  }
});

// Helper function to handle successful payments
async function handleSuccessfulPayment(payment) {
  try {
    switch (payment.paymentType) {
      case 'wallet_topup':
        // Add amount to user's wallet
        await User.findByIdAndUpdate(
          payment.userId,
          { $inc: { walletBalance: payment.amount } }
        );
        break;
        
      case 'order':
        // Update order status
        if (payment.relatedId) {
          await Order.findByIdAndUpdate(
            payment.relatedId,
            { status: 'processing' }
          );
        }
        break;
        
      // Add more payment type handlers as needed
      default:
        console.log(`No specific handler for payment type: ${payment.paymentType}`);
    }
  } catch (error) {
    console.error('Error handling successful payment:', error);
  }
}

module.exports = router;