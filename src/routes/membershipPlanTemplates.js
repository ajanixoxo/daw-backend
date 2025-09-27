const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/authorize');
const { ROLES } = require('../config/roles');
const MembershipPlanTemplate = require('../models/MembershipPlanTemplate');
const Cooperative = require('../models/Cooperative');
const Membership = require('../models/Membership');

const router = express.Router();

// Validation middleware
const validateMembershipPlanTemplate = [
  body('name').trim().isLength({ min: 3, max: 100 }).withMessage('Plan name must be 3-100 characters'),
  body('description').trim().isLength({ min: 10, max: 500 }).withMessage('Description must be 10-500 characters'),
  body('category').isIn(['basic', 'premium', 'enterprise']).withMessage('Valid category is required'),
  body('pricing.monthlyFee').isFloat({ min: 0 }).withMessage('Valid monthly fee is required'),
  body('pricing.setupFee').optional().isFloat({ min: 0 }).withMessage('Valid setup fee is required'),
  body('loanAccess.enabled').isBoolean().withMessage('Loan access enabled must be boolean'),
  body('loanAccess.maxAmount').optional().isFloat({ min: 0 }).withMessage('Valid maximum loan amount is required'),
  body('loanAccess.minAmount').optional().isFloat({ min: 0 }).withMessage('Valid minimum loan amount is required'),
  body('loanAccess.interestRate').optional().isFloat({ min: 0, max: 100 }).withMessage('Interest rate must be between 0-100%'),
  body('loanAccess.repaymentTerms.minMonths').optional().isInt({ min: 1 }).withMessage('Valid minimum repayment term is required'),
  body('loanAccess.repaymentTerms.maxMonths').optional().isInt({ min: 1 }).withMessage('Valid maximum repayment term is required'),
  body('features').isArray({ min: 1 }).withMessage('At least one feature is required'),
  body('features.*.name').trim().isLength({ min: 1 }).withMessage('Feature name is required'),
  body('features.*.description').trim().isLength({ min: 1 }).withMessage('Feature description is required'),
];

// Create membership plan template (Cooperative Admin only)
router.post('/', 
  auth, 
  authorizeRoles(ROLES.COOPERATIVE_ADMIN),
  validateMembershipPlanTemplate,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { cooperativeId } = req.body;

      // Verify cooperative exists and user is admin
      const cooperative = await Cooperative.findById(cooperativeId);
      if (!cooperative) {
        return res.status(404).json({ message: 'Cooperative not found' });
      }

      // // Check if user is admin of this cooperative
      // const membership = await Membership.findOne({
      //   cooperativeId,
      //   userId: req.user._id,
      //   roleInCoop: 'admin',
      //   status: 'active',
      // });

      if (cooperative.adminId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ 
          message: 'You must be an admin of this cooperative to create membership plan templates' 
        });
      }

      // Validate loan limits if loan access is enabled
      if (req.body.loanAccess.enabled) {
        if (req.body.loanAccess.minAmount >= req.body.loanAccess.maxAmount) {
          return res.status(400).json({ 
            message: 'Minimum loan amount must be less than maximum loan amount' 
          });
        }

        // Validate repayment terms
        if (req.body.loanAccess.repaymentTerms.minMonths >= req.body.loanAccess.repaymentTerms.maxMonths) {
          return res.status(400).json({ 
            message: 'Minimum repayment term must be less than maximum repayment term' 
          });
        }
      }

      // Check if plan with same category already exists
      const existingPlan = await MembershipPlanTemplate.findOne({
        cooperativeId,
        category: req.body.category,
        isActive: true,
      });

      if (existingPlan) {
        return res.status(400).json({ 
          message: `A ${req.body.category} plan already exists for this cooperative` 
        });
      }

      const membershipPlanTemplate = new MembershipPlanTemplate({
        ...req.body,
        cooperativeId,
        createdBy: req.user._id,
      });

      await membershipPlanTemplate.save();

      cooperative.memberships.push(membershipPlanTemplate._id);
      await cooperative.save();

      res.status(201).json({
        message: 'Membership plan template created successfully',
        membershipPlanTemplate: membershipPlanTemplate.getSummary(),
      });
    } catch (error) {
      console.error('Create membership plan template error:', error);
      res.status(500).json({ 
        message: 'Failed to create membership plan template',
        error: error.message 
      });
    }
  }
);

// Get membership plan templates for cooperative
router.get('/cooperative/:cooperativeId', 
  async (req, res) => {
    try {
      const { cooperativeId } = req.params;
      const { includeInactive = false } = req.query;

      const cooperative = await Cooperative.findById(cooperativeId);
      if (!cooperative) {
        return res.status(404).json({ message: 'Cooperative not found' });
      }

      const query = { cooperativeId };
      if (!includeInactive) {
        query.isActive = true;
      }

      const membershipPlanTemplates = await MembershipPlanTemplate.find(query)
        .sort({ displayOrder: 1, createdAt: 1 });

      res.json({
        message: 'Membership plan templates retrieved successfully',
        cooperative: {
          id: cooperative._id,
          name: cooperative.name,
        },
        membershipPlanTemplates: membershipPlanTemplates.map(plan => plan.getSummary()),
      });
    } catch (error) {
      console.error('Get membership plan templates error:', error);
      res.status(500).json({ 
        message: 'Failed to retrieve membership plan templates',
        error: error.message 
      });
    }
  }
);

// Get specific membership plan template
router.get('/:id', 
  async (req, res) => {
    try {
      const membershipPlanTemplate = await MembershipPlanTemplate.findById(req.params.id)
        .populate('cooperativeId', 'name description')
        .populate('createdBy', 'name email');

      if (!membershipPlanTemplate) {
        return res.status(404).json({ message: 'Membership plan template not found' });
      }

      res.json({
        message: 'Membership plan template retrieved successfully',
        membershipPlanTemplate,
      });
    } catch (error) {
      console.error('Get membership plan template error:', error);
      res.status(500).json({ 
        message: 'Failed to retrieve membership plan template',
        error: error.message 
      });
    }
  }
);

// Update membership plan template (Cooperative Admin only)
router.put('/:id', 
  auth, 
  authorizeRoles(ROLES.COOPERATIVE_ADMIN),
  validateMembershipPlanTemplate,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const membershipPlanTemplate = await MembershipPlanTemplate.findById(req.params.id);
      if (!membershipPlanTemplate) {
        return res.status(404).json({ message: 'Membership plan template not found' });
      }

      // Check if user is admin of this cooperative
      const membership = await Membership.findOne({
        cooperativeId: membershipPlanTemplate.cooperativeId,
        userId: req.user._id,
        roleInCoop: 'admin',
        status: 'active',
      });

      if (!membership) {
        return res.status(403).json({ 
          message: 'You must be an admin of this cooperative to update membership plan templates' 
        });
      }

      // Validate loan limits if loan access is enabled
      if (req.body.loanAccess && req.body.loanAccess.enabled) {
        if (req.body.loanAccess.minAmount >= req.body.loanAccess.maxAmount) {
          return res.status(400).json({ 
            message: 'Minimum loan amount must be less than maximum loan amount' 
          });
        }

        // Validate repayment terms
        if (req.body.loanAccess.repaymentTerms.minMonths >= req.body.loanAccess.repaymentTerms.maxMonths) {
          return res.status(400).json({ 
            message: 'Minimum repayment term must be less than maximum repayment term' 
          });
        }
      }

      // Update plan
      Object.assign(membershipPlanTemplate, req.body);
      await membershipPlanTemplate.save();

      res.json({
        message: 'Membership plan template updated successfully',
        membershipPlanTemplate: membershipPlanTemplate.getSummary(),
      });
    } catch (error) {
      console.error('Update membership plan template error:', error);
      res.status(500).json({ 
        message: 'Failed to update membership plan template',
        error: error.message 
      });
    }
  }
);

// Toggle membership plan template status (Cooperative Admin only)
router.patch('/:id/toggle-status', 
  auth, 
  authorizeRoles(ROLES.COOPERATIVE_ADMIN),
  async (req, res) => {
    try {
      const membershipPlanTemplate = await MembershipPlanTemplate.findById(req.params.id);
      if (!membershipPlanTemplate) {
        return res.status(404).json({ message: 'Membership plan template not found' });
      }

      // Check if user is admin of this cooperative
      const membership = await Membership.findOne({
        cooperativeId: membershipPlanTemplate.cooperativeId,
        userId: req.user._id,
        roleInCoop: 'admin',
        status: 'active',
      });

      if (!membership) {
        return res.status(403).json({ 
          message: 'You must be an admin of this cooperative to manage membership plan templates' 
        });
      }

      membershipPlanTemplate.isActive = !membershipPlanTemplate.isActive;
      await membershipPlanTemplate.save();

      res.json({
        message: `Membership plan template ${membershipPlanTemplate.isActive ? 'activated' : 'deactivated'} successfully`,
        membershipPlanTemplate: membershipPlanTemplate.getSummary(),
      });
    } catch (error) {
      console.error('Toggle membership plan template status error:', error);
      res.status(500).json({ 
        message: 'Failed to toggle membership plan template status',
        error: error.message 
      });
    }
  }
);

// Calculate loan terms for amount
router.post('/:id/calculate', 
  body('amount').isFloat({ min: 1 }).withMessage('Valid loan amount is required'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const membershipPlanTemplate = await MembershipPlanTemplate.findById(req.params.id);
      if (!membershipPlanTemplate) {
        return res.status(404).json({ message: 'Membership plan template not found' });
      }

      if (!membershipPlanTemplate.isActive) {
        return res.status(400).json({ message: 'Membership plan template is not active' });
      }

      const { amount } = req.body;
      
      try {
        const terms = membershipPlanTemplate.calculateLoanTerms(amount);
        
        res.json({
          message: 'Loan terms calculated successfully',
          membershipPlanTemplate: membershipPlanTemplate.getSummary(),
          amount,
          terms,
        });
      } catch (error) {
        res.status(400).json({ 
          message: error.message 
        });
      }
    } catch (error) {
      console.error('Calculate loan terms error:', error);
      res.status(500).json({ 
        message: 'Failed to calculate loan terms',
        error: error.message 
      });
    }
  }
);

// Delete membership plan template (Cooperative Admin only)
router.delete('/:id', 
  auth, 
  authorizeRoles(ROLES.COOPERATIVE_ADMIN),
  async (req, res) => {
    try {
      const membershipPlanTemplate = await MembershipPlanTemplate.findById(req.params.id);
      if (!membershipPlanTemplate) {
        return res.status(404).json({ message: 'Membership plan template not found' });
      }

      // Check if user is admin of this cooperative
      const membership = await Membership.findOne({
        cooperativeId: membershipPlanTemplate.cooperativeId,
        userId: req.user._id,
        roleInCoop: 'admin',
        status: 'active',
      });

      if (!membership) {
        return res.status(403).json({ 
          message: 'You must be an admin of this cooperative to delete membership plan templates' 
        });
      }

      // Check if plan is being used by any active memberships
      const MembershipPlan = require('../models/MembershipPlan');
      const activeMemberships = await MembershipPlan.countDocuments({
        membershipPlanTemplateId: membershipPlanTemplate._id,
        status: 'active',
      });

      if (activeMemberships > 0) {
        return res.status(400).json({ 
          message: `Cannot delete membership plan template. ${activeMemberships} active memberships are using this plan` 
        });
      }

      await MembershipPlanTemplate.findByIdAndDelete(req.params.id);

      res.json({
        message: 'Membership plan template deleted successfully',
      });
    } catch (error) {
      console.error('Delete membership plan template error:', error);
      res.status(500).json({ 
        message: 'Failed to delete membership plan template',
        error: error.message 
      });
    }
  }
);

module.exports = router;