const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { authorizeRoles, authorizeOwnership } = require('../middleware/authorize');
const { ROLES } = require('../config/roles');
const Contribution = require('../models/Contribution');
const Cooperative = require('../models/Cooperative');
const Membership = require('../models/Membership');
const User = require('../models/User');

const router = express.Router();

// Validation middleware
const validateContribution = [
  body('cooperativeId').isMongoId().withMessage('Valid cooperative ID is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Valid amount is required'),
  body('type').isIn(['savings', 'loan_repayment', 'emergency_fund', 'investment', 'donation', 'fee', 'other'])
    .withMessage('Valid contribution type is required'),
  body('method').isIn(['cash', 'bank_transfer', 'mobile_money', 'wallet', 'check', 'other'])
    .withMessage('Valid payment method is required'),
  body('description').optional().trim(),
  body('frequency').optional().isIn(['one_time', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually'])
    .withMessage('Valid frequency is required'),
  body('schedule.startDate').optional().isISO8601().withMessage('Valid start date is required'),
  body('schedule.endDate').optional().isISO8601().withMessage('Valid end date is required'),
];

// Add contribution (Buyer + Seller)
router.post('/', 
  auth, 
  authorizeRoles(ROLES.BUYER, ROLES.SELLER),
  validateContribution,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { 
        cooperativeId, 
        amount, 
        type, 
        method, 
        description, 
        frequency, 
        schedule 
      } = req.body;

      // Check if cooperative exists and is active
      const cooperative = await Cooperative.findById(cooperativeId);
      if (!cooperative) {
        return res.status(404).json({ message: 'Cooperative not found' });
      }

      if (!cooperative.isActiveAndVerified()) {
        return res.status(400).json({ 
          message: 'Cooperative must be active and verified' 
        });
      }

      // Check if cooperative enables contributions
      if (!cooperative.settings.enableContributions) {
        return res.status(400).json({ 
          message: 'This cooperative does not accept contributions' 
        });
      }

      // Check if user is a member of the cooperative
      const membership = await Membership.findOne({
        cooperativeId,
        userId: req.user._id,
        status: 'active',
      });

      if (!membership) {
        return res.status(403).json({ 
          message: 'You must be a member of the cooperative to make contributions' 
        });
      }

      // Check if user can access benefits (fees are up to date)
      if (!membership.canAccessBenefits()) {
        return res.status(400).json({ 
          message: 'Your cooperative fees must be up to date to make contributions' 
        });
      }

      // Generate contribution reference
      const reference = await Contribution.generateReference();

      // Determine if contribution is recurring
      const isRecurring = frequency && frequency !== 'one_time';
      
      // Calculate next due date for recurring contributions
      let nextDueDate = null;
      if (isRecurring && schedule && schedule.startDate) {
        nextDueDate = new Date(schedule.startDate);
      }

      // Create contribution
      const contribution = new Contribution({
        userId: req.user._id,
        cooperativeId,
        amount,
        type,
        method,
        reference,
        description: description || `${type} contribution`,
        frequency: frequency || 'one_time',
        status: 'pending',
        schedule: {
          startDate: schedule?.startDate,
          endDate: schedule?.endDate,
          nextDueDate,
          isRecurring,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await contribution.save();

      res.status(201).json({
        message: 'Contribution submitted successfully',
        contribution: contribution.getSummary(),
        nextSteps: isRecurring ? 
          'Your recurring contribution has been set up' : 
          'Your contribution will be processed shortly',
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error submitting contribution', 
        error: error.message 
      });
    }
  }
);

// View contribution history (User(Self) + Coop Admin + Admin)
router.get('/:userId', 
  auth, 
  authorizeRoles(ROLES.BUYER, ROLES.SELLER, ROLES.COOPERATIVE_ADMIN, ROLES.ADMIN),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { 
        page = 1, 
        limit = 20, 
        type, 
        status, 
        cooperativeId,
        startDate,
        endDate
      } = req.query;

      // Check if user has access to this contribution history
      if (req.user.role === ROLES.ADMIN) {
        // Admin can see all contributions
      } else if (req.user.role === ROLES.COOPERATIVE_ADMIN) {
        if (cooperativeId) {
          // Check if user is admin of this cooperative
          const membership = await Membership.findOne({
            cooperativeId,
            userId: req.user._id,
            roleInCoop: 'admin',
            status: 'active',
          });

          if (!membership) {
            return res.status(403).json({ 
              message: 'You can only view contributions from your cooperative' 
            });
          }
        }
      } else {
        // Regular users can only see their own contributions
        if (userId !== req.user._id.toString()) {
          return res.status(403).json({ 
            message: 'You can only view your own contributions' 
          });
        }
      }

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Build query
      const query = { userId };
      if (type) query.type = type;
      if (status) query.status = status;
      if (cooperativeId) query.cooperativeId = cooperativeId;

      let start, end;
      if (startDate) start = new Date(startDate);
      if (endDate) end = new Date(endDate);

      const contributions = await Contribution.find(query)
        .populate('cooperativeId', 'name')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });

      const total = await Contribution.countDocuments(query);

      // Get contribution summary
      const summary = await Contribution.getUserSummary(userId, cooperativeId);

      res.json({
        userId,
        contributions: contributions.map(c => c.getSummary()),
        summary,
        pagination: {
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          total,
        },
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error fetching contribution history', 
        error: error.message 
      });
    }
  }
);

// Get contribution statistics for cooperative (Coop Admin + Admin)
router.get('/stats/cooperative/:cooperativeId', 
  auth, 
  authorizeRoles(ROLES.COOPERATIVE_ADMIN, ROLES.ADMIN),
  async (req, res) => {
    try {
      const { cooperativeId } = req.params;
      const { startDate, endDate } = req.query;

      // Check if cooperative exists
      const cooperative = await Cooperative.findById(cooperativeId);
      if (!cooperative) {
        return res.status(404).json({ message: 'Cooperative not found' });
      }

      // Check if user has permission to view stats
      if (req.user.role === ROLES.COOPERATIVE_ADMIN) {
        const membership = await Membership.findOne({
          cooperativeId,
          userId: req.user._id,
          roleInCoop: 'admin',
          status: 'active',
        });

        if (!membership) {
          return res.status(403).json({ 
            message: 'You can only view stats for your cooperative' 
          });
        }
      }

      let start, end;
      if (startDate) start = new Date(startDate);
      if (endDate) end = new Date(endDate);

      const stats = await Contribution.getCooperativeStats(cooperativeId, start, end);

      res.json({
        cooperativeId,
        statistics: stats,
        period: {
          startDate: start,
          endDate: end,
        },
        lastUpdated: new Date(),
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error fetching contribution statistics', 
        error: error.message 
      });
    }
  }
);

// Get due contributions for user
router.get('/due/:userId', 
  auth, 
  authorizeRoles(ROLES.BUYER, ROLES.SELLER, ROLES.COOPERATIVE_ADMIN, ROLES.ADMIN),
  async (req, res) => {
    try {
      const { userId } = req.params;

      // Check if user has access
      if (req.user.role === ROLES.ADMIN) {
        // Admin can see all due contributions
      } else if (req.user.role === ROLES.COOPERATIVE_ADMIN) {
        // Coop admin can see due contributions for their cooperative members
        const memberships = await Membership.find({
          userId: req.user._id,
          roleInCoop: 'admin',
          status: 'active',
        });
        
        const cooperativeIds = memberships.map(m => m.cooperativeId);
        
        // Check if the user is a member of any of these cooperatives
        const userMembership = await Membership.findOne({
          userId,
          cooperativeId: { $in: cooperativeIds },
          status: 'active',
        });

        if (!userMembership) {
          return res.status(403).json({ 
            message: 'You can only view due contributions for your cooperative members' 
          });
        }
      } else {
        // Regular users can only see their own due contributions
        if (userId !== req.user._id.toString()) {
          return res.status(403).json({ 
            message: 'You can only view your own due contributions' 
          });
        }
      }

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const dueContributions = await Contribution.getDueContributions(userId);

      res.json({
        userId,
        dueContributions: dueContributions.map(c => c.getSummary()),
        count: dueContributions.length,
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error fetching due contributions', 
        error: error.message 
      });
    }
  }
);

// Confirm contribution (Coop Admin + Admin)
router.patch('/:id/confirm', 
  auth, 
  authorizeRoles(ROLES.COOPERATIVE_ADMIN, ROLES.ADMIN),
  [
    body('verificationNotes').optional().trim(),
  ],
  async (req, res) => {
    try {
      const { verificationNotes } = req.body;
      const contributionId = req.params.id;

      const contribution = await Contribution.findById(contributionId);
      if (!contribution) {
        return res.status(404).json({ message: 'Contribution not found' });
      }

      // Check if user has permission to confirm this contribution
      if (req.user.role === ROLES.COOPERATIVE_ADMIN) {
        // Check if user is admin of the cooperative that owns this contribution
        const membership = await Membership.findOne({
          cooperativeId: contribution.cooperativeId,
          userId: req.user._id,
          roleInCoop: 'admin',
          status: 'active',
        });

        if (!membership) {
          return res.status(403).json({ 
            message: 'You can only confirm contributions from your cooperative' 
          });
        }
      }

      if (contribution.status !== 'pending') {
        return res.status(400).json({ 
          message: 'Only pending contributions can be confirmed' 
        });
      }

      // Update contribution status
      contribution.status = 'confirmed';
      contribution.verification = {
        verifiedBy: req.user._id,
        verifiedAt: new Date(),
        verificationNotes: verificationNotes || '',
      };
      contribution.timeline.confirmedAt = new Date();
      contribution.updatedAt = new Date();

      await contribution.save();

      res.json({
        message: 'Contribution confirmed successfully',
        contribution: contribution.getSummary(),
        verification: contribution.verification,
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error confirming contribution', 
        error: error.message 
      });
    }
  }
);

// Cancel contribution (User(Self) + Coop Admin + Admin)
router.patch('/:id/cancel', 
  auth, 
  authorizeRoles(ROLES.BUYER, ROLES.SELLER, ROLES.COOPERATIVE_ADMIN, ROLES.ADMIN),
  [
    body('reason').trim().notEmpty().withMessage('Cancellation reason is required'),
  ],
  async (req, res) => {
    try {
      const { reason } = req.body;
      const contributionId = req.params.id;

      const contribution = await Contribution.findById(contributionId);
      if (!contribution) {
        return res.status(404).json({ message: 'Contribution not found' });
      }

      // Check if user has permission to cancel this contribution
      if (req.user.role === ROLES.ADMIN) {
        // Admin can cancel any contribution
      } else if (req.user.role === ROLES.COOPERATIVE_ADMIN) {
        // Check if user is admin of the cooperative that owns this contribution
        const membership = await Membership.findOne({
          cooperativeId: contribution.cooperativeId,
          userId: req.user._id,
          roleInCoop: 'admin',
          status: 'active',
        });

        if (!membership) {
          return res.status(403).json({ 
            message: 'You can only cancel contributions from your cooperative' 
          });
        }
      } else {
        // Regular users can only cancel their own contributions
        if (contribution.userId.toString() !== req.user._id.toString()) {
          return res.status(403).json({ 
            message: 'You can only cancel your own contributions' 
          });
        }
      }

      if (contribution.status === 'confirmed') {
        return res.status(400).json({ 
          message: 'Confirmed contributions cannot be cancelled' 
        });
      }

      // Update contribution status
      contribution.status = 'cancelled';
      contribution.timeline.cancelledAt = new Date();
      contribution.notes = reason;
      contribution.updatedAt = new Date();

      await contribution.save();

      res.json({
        message: 'Contribution cancelled successfully',
        contribution: contribution.getSummary(),
        reason,
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error cancelling contribution', 
        error: error.message 
      });
    }
  }
);

module.exports = router;

