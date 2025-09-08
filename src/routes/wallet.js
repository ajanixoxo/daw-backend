const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { authorizeRoles, authorizeOwnership } = require('../middleware/authorize');
const { ROLES } = require('../config/roles');
const WalletTransaction = require('../models/WalletTransaction');
const User = require('../models/User');
const Payment = require('../models/Payment');

const router = express.Router();

// Validation middleware
const validateWalletTopup = [
  body('amount').isFloat({ min: 0.01 }).withMessage('Valid amount is required'),
  body('method').isIn(['bank_transfer', 'mobile_money', 'card', 'crypto'])
    .withMessage('Valid topup method is required'),
  body('gateway.name').trim().notEmpty().withMessage('Gateway name is required'),
];

const validateWalletRefund = [
  body('amount').isFloat({ min: 0.01 }).withMessage('Valid refund amount is required'),
  body('reason').trim().notEmpty().withMessage('Refund reason is required'),
  body('userId').isMongoId().withMessage('Valid user ID is required'),
];

// Add money to wallet (Buyer)
router.post('/topup', 
  auth, 
  authorizeRoles(ROLES.BUYER),
  validateWalletTopup,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { amount, method, gateway, description } = req.body;

      // Get current wallet balance
      const currentBalance = await WalletTransaction.getUserBalance(req.user._id);

      // Generate transaction reference
      const reference = await WalletTransaction.generateReference();

      // Create wallet transaction
      const transaction = new WalletTransaction({
        userId: req.user._id,
        type: 'top_up',
        amount,
        reference,
        status: 'pending',
        previousBalance: currentBalance,
        newBalance: currentBalance + amount,
        currency: 'USD',
        description: description || `Wallet topup via ${method}`,
        metadata: {
          source: method,
          externalReference: reference,
        },
        timeline: {
          initiatedAt: new Date(),
        },
      });

      await transaction.save();

      res.status(201).json({
        message: 'Wallet topup initiated successfully',
        transaction: transaction.getSummary(),
        nextSteps: 'Complete payment through the selected gateway',
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error initiating wallet topup', 
        error: error.message 
      });
    }
  }
);

// Refund to wallet (Admin)
router.post('/refund', 
  auth, 
  authorizeRoles(ROLES.ADMIN),
  validateWalletRefund,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { amount, reason, userId, description } = req.body;

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Get current wallet balance
      const currentBalance = await WalletTransaction.getUserBalance(userId);

      // Generate transaction reference
      const reference = await WalletTransaction.generateReference();

      // Create wallet transaction
      const transaction = new WalletTransaction({
        userId,
        type: 'refund',
        amount,
        reference,
        status: 'completed',
        previousBalance: currentBalance,
        newBalance: currentBalance + amount,
        currency: 'USD',
        description: description || `Admin refund: ${reason}`,
        metadata: {
          source: 'admin_refund',
          externalReference: reference,
        },
        timeline: {
          initiatedAt: new Date(),
          completedAt: new Date(),
        },
      });

      await transaction.save();

      // Update user wallet balance
      user.walletBalance = currentBalance + amount;
      await user.save();

      res.status(201).json({
        message: 'Wallet refund processed successfully',
        transaction: transaction.getSummary(),
        userBalance: user.walletBalance,
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error processing wallet refund', 
        error: error.message 
      });
    }
  }
);

// Get wallet details (Buyer + Admin)
router.get('/:userId', 
  auth, 
  authorizeRoles(ROLES.BUYER, ROLES.ADMIN),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20, type, status, startDate, endDate } = req.query;

      // Check if user has access to this wallet
      if (req.user.role === ROLES.BUYER) {
        if (userId !== req.user._id.toString()) {
          return res.status(403).json({ 
            message: 'You can only view your own wallet' 
          });
        }
      }

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Get wallet balance
      const balance = await WalletTransaction.getUserBalance(userId);

      // Get transaction history
      const query = { userId };
      if (type) query.type = type;
      if (status) query.status = status;

      let start, end;
      if (startDate) start = new Date(startDate);
      if (endDate) end = new Date(endDate);

      const transactions = await WalletTransaction.find(query)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });

      const total = await WalletTransaction.countDocuments(query);

      // Get wallet statistics
      const stats = await WalletTransaction.getUserStats(userId, start, end);

      res.json({
        wallet: {
          userId,
          balance,
          currency: 'USD',
        },
        transactions: transactions.map(t => t.getSummary()),
        statistics: stats,
        pagination: {
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          total,
        },
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error fetching wallet details', 
        error: error.message 
      });
    }
  }
);

// Get wallet balance (Buyer + Admin)
router.get('/:userId/balance', 
  auth, 
  authorizeRoles(ROLES.BUYER, ROLES.ADMIN),
  async (req, res) => {
    try {
      const { userId } = req.params;

      // Check if user has access to this wallet
      if (req.user.role === ROLES.BUYER) {
        if (userId !== req.user._id.toString()) {
          return res.status(403).json({ 
            message: 'You can only view your own wallet balance' 
          });
        }
      }

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Get wallet balance
      const balance = await WalletTransaction.getUserBalance(userId);

      res.json({
        userId,
        balance,
        currency: 'USD',
        lastUpdated: new Date(),
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error fetching wallet balance', 
        error: error.message 
      });
    }
  }
);

// Get wallet transactions (Buyer + Admin)
router.get('/:userId/transactions', 
  auth, 
  authorizeRoles(ROLES.BUYER, ROLES.ADMIN),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20, type, status, startDate, endDate } = req.query;

      // Check if user has access to this wallet
      if (req.user.role === ROLES.BUYER) {
        if (userId !== req.user._id.toString()) {
          return res.status(403).json({ 
            message: 'You can only view your own wallet transactions' 
          });
        }
      }

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Get transaction history
      const query = { userId };
      if (type) query.type = type;
      if (status) query.status = status;

      let start, end;
      if (startDate) start = new Date(startDate);
      if (endDate) end = new Date(endDate);

      const transactions = await WalletTransaction.find(query)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });

      const total = await WalletTransaction.countDocuments(query);

      res.json({
        transactions: transactions.map(t => t.getSummary()),
        pagination: {
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          total,
        },
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error fetching wallet transactions', 
        error: error.message 
      });
    }
  }
);

// Get wallet statistics (Buyer + Admin)
router.get('/:userId/stats', 
  auth, 
  authorizeRoles(ROLES.BUYER, ROLES.ADMIN),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { startDate, endDate } = req.query;

      // Check if user has access to this wallet
      if (req.user.role === ROLES.BUYER) {
        if (userId !== req.user._id.toString()) {
          return res.status(403).json({ 
            message: 'You can only view your own wallet statistics' 
          });
        }
      }

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      let start, end;
      if (startDate) start = new Date(startDate);
      if (endDate) end = new Date(endDate);

      // Get wallet statistics
      const stats = await WalletTransaction.getUserStats(userId, start, end);

      res.json({
        userId,
        statistics: stats,
        period: {
          startDate: start,
          endDate: end,
        },
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error fetching wallet statistics', 
        error: error.message 
      });
    }
  }
);

// Verify wallet topup (Gateway callback)
router.post('/verify-topup', async (req, res) => {
  try {
    const { reference, status, transactionId, responseCode, responseMessage } = req.body;

    if (!reference) {
      return res.status(400).json({ message: 'Transaction reference is required' });
    }

    // Find transaction by reference
    const transaction = await WalletTransaction.findOne({ reference });
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (transaction.type !== 'top_up') {
      return res.status(400).json({ message: 'Invalid transaction type' });
    }

    // Update transaction with gateway response
    if (status === 'success' || status === 'completed') {
      transaction.status = 'completed';
      transaction.timeline.completedAt = new Date();
      
      // Update user wallet balance
      const user = await User.findById(transaction.userId);
      if (user) {
        user.walletBalance = transaction.newBalance;
        await user.save();
      }
    } else {
      transaction.status = 'failed';
      transaction.timeline.failedAt = new Date();
      
      // Revert balance calculation
      transaction.newBalance = transaction.previousBalance;
    }

    await transaction.save();

    res.json({
      message: 'Wallet topup verification completed',
      transaction: transaction.getSummary(),
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error verifying wallet topup', 
      error: error.message 
    });
  }
});

module.exports = router;

