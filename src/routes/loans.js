const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { authorizeRoles, authorizeOwnership } = require('../middleware/authorize');
const { checkLoanAccess } = require('../middleware/tierAccess');
const { ROLES } = require('../config/roles');
const Loan = require('../models/Loan');
const Cooperative = require('../models/Cooperative');
const Membership = require('../models/Membership');
const User = require('../models/User');

const router = express.Router();

// Get loan tiers
router.get('/tiers', (req, res) => {
  try {
    const tiers = Loan.getLoanTiers();
    res.json({
      message: 'Loan tiers retrieved successfully',
      tiers
    });
  } catch (error) {
    console.error('Get loan tiers error:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve loan tiers',
      error: error.message 
    });
  }
});

// Validation middleware
const validateLoanRequest = [
  body('cooperativeId').isMongoId().withMessage('Valid cooperative ID is required'),
  body('type').isIn(['business', 'agricultural', 'emergency', 'education', 'housing', 'equipment', 'other'])
    .withMessage('Valid loan type is required'),
  body('loanCategory').isIn(['emergency', 'growth', 'large-scale'])
    .withMessage('Valid loan category is required'),
  body('amount').isFloat({ min: 1 }).withMessage('Valid loan amount is required'),
  body('interestRate').isFloat({ min: 0, max: 100 }).withMessage('Valid interest rate is required'),
  body('term').isInt({ min: 1 }).withMessage('Valid loan term is required'),
  body('termUnit').isIn(['days', 'weeks', 'months', 'years']).withMessage('Valid term unit is required'),
  body('repaymentPlan').isIn(['weekly', 'biweekly', 'monthly', 'quarterly', 'annually', 'custom'])
    .withMessage('Valid repayment plan is required'),
  body('imageUrl').optional().trim().isURL().withMessage('Invalid image URL format'),
  body('collateral.type').optional().isIn(['property', 'vehicle', 'equipment', 'savings', 'guarantor', 'other'])
    .withMessage('Valid collateral type is required'),
  body('collateral.description').optional().trim(),
  body('collateral.value').optional().isFloat({ min: 0 }).withMessage('Valid collateral value is required'),
];

const validateLoanApproval = [
  body('approvedAmount').isFloat({ min: 1 }).withMessage('Valid approved amount is required'),
  body('approvedTerm').isInt({ min: 1 }).withMessage('Valid approved term is required'),
  body('approvedInterestRate').isFloat({ min: 0, max: 100 }).withMessage('Valid approved interest rate is required'),
  body('conditions').optional().isArray().withMessage('Conditions must be an array'),
  body('notes').optional().trim(),
];

// Request a loan (Buyer + Seller + Coop Admin)
router.post('/', 
  auth, 
  checkLoanAccess, // Check tier-based loan access
  authorizeRoles(ROLES.BUYER, ROLES.SELLER, ROLES.COOPERATIVE_ADMIN),
  validateLoanRequest,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { cooperativeId, type, amount, interestRate, term, termUnit, repaymentPlan, imageUrl, collateral } = req.body;

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

      // Check if cooperative enables loans
      if (!cooperative.settings.enableLoans) {
        return res.status(400).json({ 
          message: 'This cooperative does not offer loans' 
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
          message: 'You must be a member of the cooperative to request a loan' 
        });
      }

      // Check if user is eligible for loans
      if (!membership.isLoanEligible()) {
        return res.status(400).json({ 
          message: 'You are not eligible for loans at this time' 
        });
      }

      // Check if user has active loans
      const activeLoans = await Loan.countDocuments({
        userId: req.user._id,
        status: { $in: ['pending', 'approved', 'active'] },
      });

      if (activeLoans > 0) {
        return res.status(400).json({ 
          message: 'You already have an active loan request or loan' 
        });
      }

      // Create loan request
      const loan = new Loan({
        userId: req.user._id,
        cooperativeId,
        type,
        amount,
        interestRate,
        term,
        termUnit,
        repaymentPlan,
        imageUrl: imageUrl || '',
        status: 'pending',
        collateral,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await loan.save();

      res.status(201).json({
        message: 'Loan request submitted successfully',
        loan: loan.getSummary(),
        nextSteps: 'Your loan request will be reviewed by cooperative administrators',
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error submitting loan request', 
        error: error.message 
      });
    }
  }
);

// View loans (User(Self) + Coop Admin + Admin)
router.get('/', 
  auth, 
  authorizeRoles(ROLES.BUYER, ROLES.SELLER, ROLES.COOPERATIVE_ADMIN, ROLES.ADMIN),
  async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 20, 
        status, 
        type, 
        cooperativeId,
        userId 
      } = req.query;

      let query = {};

      // Filter by user (users can only see their own loans, admins can see all)
      if (req.user.role === ROLES.ADMIN) {
        if (userId) query.userId = userId;
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
              message: 'You can only view loans from your cooperative' 
            });
          }
          query.cooperativeId = cooperativeId;
        } else {
          // Get all cooperatives where user is admin
          const memberships = await Membership.find({
            userId: req.user._id,
            roleInCoop: 'admin',
            status: 'active',
          });
          
          const cooperativeIds = memberships.map(m => m.cooperativeId);
          query.cooperativeId = { $in: cooperativeIds };
        }
      } else {
        // Regular users can only see their own loans
        query.userId = req.user._id;
      }

      if (status) query.status = status;
      if (type) query.type = type;

      const loans = await Loan.find(query)
        .populate('userId', 'name email')
        .populate('cooperativeId', 'name')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });

      const total = await Loan.countDocuments(query);

      res.json({
        loans: loans.map(loan => loan.getSummary()),
        pagination: {
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          total,
        },
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error fetching loans', 
        error: error.message 
      });
    }
  }
);

// View loan details (User(Self) + Coop Admin + Admin)
router.get('/:id', 
  auth, 
  authorizeRoles(ROLES.BUYER, ROLES.SELLER, ROLES.COOPERATIVE_ADMIN, ROLES.ADMIN),
  async (req, res) => {
    try {
      const loan = await Loan.findById(req.params.id)
        .populate('userId', 'name email phone')
        .populate('cooperativeId', 'name description')
        .populate('approval.approvedBy', 'name email')
        .populate('guarantors.userId', 'name email phone');

      if (!loan) {
        return res.status(404).json({ message: 'Loan not found' });
      }

      // Check if user has access to this loan
      if (req.user.role === ROLES.ADMIN) {
        // Admin can see all loans
      } else if (req.user.role === ROLES.COOPERATIVE_ADMIN) {
        // Check if user is admin of the cooperative that owns this loan
        const membership = await Membership.findOne({
          cooperativeId: loan.cooperativeId,
          userId: req.user._id,
          roleInCoop: 'admin',
          status: 'active',
        });

        if (!membership) {
          return res.status(403).json({ 
            message: 'You can only view loans from your cooperative' 
          });
        }
      } else {
        // Regular users can only see their own loans
        if (loan.userId.toString() !== req.user._id.toString()) {
          return res.status(403).json({ 
            message: 'You can only view your own loans' 
          });
        }
      }

      res.json({
        loan: loan.getSummary(),
        details: {
          user: loan.userId,
          cooperative: loan.cooperativeId,
          approval: loan.approval,
          guarantors: loan.guarantors,
          collateral: loan.collateral,
          documents: loan.documents,
        },
        paymentSchedule: loan.getPaymentSchedule(),
        nextPayment: loan.calculateNextPayment(),
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error fetching loan details', 
        error: error.message 
      });
    }
  }
);

// Approve/Reject loan (Coop Admin + Admin)
router.patch('/:id/status', 
  auth, 
  authorizeRoles(ROLES.COOPERATIVE_ADMIN, ROLES.ADMIN),
  validateLoanApproval,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const loanId = req.params.id;
      const { 
        status, 
        approvedAmount, 
        approvedTerm, 
        approvedInterestRate, 
        conditions, 
        notes 
      } = req.body;

      const loan = await Loan.findById(loanId);
      if (!loan) {
        return res.status(404).json({ message: 'Loan not found' });
      }

      // Check if user has permission to approve this loan
      if (req.user.role === ROLES.COOPERATIVE_ADMIN) {
        // Check if user is admin of the cooperative that owns this loan
        const membership = await Membership.findOne({
          cooperativeId: loan.cooperativeId,
          userId: req.user._id,
          roleInCoop: 'admin',
          status: 'active',
        });

        if (!membership) {
          return res.status(403).json({ 
            message: 'You can only approve loans from your cooperative' 
          });
        }
      }

      if (loan.status !== 'pending') {
        return res.status(400).json({ 
          message: 'Only pending loans can be approved or rejected' 
        });
      }

      // Update loan status
      loan.status = status;
      loan.updatedAt = new Date();

      if (status === 'approved') {
        loan.approval = {
          approvedBy: req.user._id,
          approvedAt: new Date(),
          approvedAmount,
          approvedTerm,
          approvedInterestRate,
          conditions: conditions || [],
          notes: notes || '',
        };

        // Update loan terms if different from request
        if (approvedAmount !== loan.amount) {
          loan.amount = approvedAmount;
        }
        if (approvedTerm !== loan.term) {
          loan.term = approvedTerm;
        }
        if (approvedInterestRate !== loan.interestRate) {
          loan.interestRate = approvedInterestRate;
        }

        // Calculate new totals
        loan.totalInterest = (loan.amount * loan.interestRate * loan.term) / 100;
        loan.totalAmount = loan.amount + loan.totalInterest;
        loan.remainingBalance = loan.totalAmount;
      } else if (status === 'rejected') {
        loan.approval = {
          approvedBy: req.user._id,
          approvedAt: new Date(),
          notes: notes || 'Loan request rejected',
        };
      }

      await loan.save();

      res.json({
        message: `Loan ${status} successfully`,
        loan: loan.getSummary(),
        approval: loan.approval,
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error updating loan status', 
        error: error.message 
      });
    }
  }
);

// Get loan statistics for cooperative (Coop Admin + Admin)
router.get('/stats/cooperative/:cooperativeId', 
  auth, 
  authorizeRoles(ROLES.COOPERATIVE_ADMIN, ROLES.ADMIN),
  async (req, res) => {
    try {
      const { cooperativeId } = req.params;

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

      const stats = await Loan.getCooperativeStats(cooperativeId);

      res.json({
        cooperativeId,
        statistics: stats,
        lastUpdated: new Date(),
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error fetching loan statistics', 
        error: error.message 
      });
    }
  }
);

// Get overdue loans (Coop Admin + Admin)
router.get('/overdue/cooperative/:cooperativeId', 
  auth, 
  authorizeRoles(ROLES.COOPERATIVE_ADMIN, ROLES.ADMIN),
  async (req, res) => {
    try {
      const { cooperativeId } = req.params;

      // Check if user has permission
      if (req.user.role === ROLES.COOPERATIVE_ADMIN) {
        const membership = await Membership.findOne({
          cooperativeId,
          userId: req.user._id,
          roleInCoop: 'admin',
          status: 'active',
        });

        if (!membership) {
          return res.status(403).json({ 
            message: 'Access denied' 
          });
        }
      }

      const overdueLoans = await Loan.find({
        cooperativeId,
        status: 'active',
        dueDate: { $lt: new Date() },
      }).populate('userId', 'name email phone');

      res.json({
        cooperativeId,
        overdueLoans: overdueLoans.map(loan => loan.getSummary()),
        count: overdueLoans.length,
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error fetching overdue loans', 
        error: error.message 
      });
    }
  }
);

module.exports = router;
