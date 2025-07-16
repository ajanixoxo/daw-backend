const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { authorizePermissions, authorizeRoles } = require('../middleware/authorize');
const { ROLES, PERMISSIONS } = require('../config/roles');
const MembershipTier = require('../models/MembershipTier');
const User = require('../models/User');

const router = express.Router();

// Validation middleware
const validateMembership = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('features').isArray().withMessage('Features must be an array'),
  body('features.*').isString().withMessage('Features must be strings'),
];

// Create membership tier (Admin only)
router.post(
  '/',
  auth,
  authorizeRoles(ROLES.ADMIN),
  validateMembership,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const membership = new MembershipTier(req.body);
      await membership.save();

      res.status(201).json(membership);
    } catch (error) {
      res.status(500).json({ message: 'Error creating membership tier', error: error.message });
    }
  }
);

// Get all membership tiers
router.get('/', async (req, res) => {
  try {
    const memberships = await MembershipTier.find();
    res.json(memberships);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching membership tiers', error: error.message });
  }
});

// Get membership tier by ID
router.get('/:id', async (req, res) => {
  try {
    const membership = await MembershipTier.findById(req.params.id);
    if (!membership) {
      return res.status(404).json({ message: 'Membership tier not found' });
    }
    res.json(membership);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching membership tier', error: error.message });
  }
});

// Update membership tier (Admin only)
router.put(
  '/:id',
  auth,
  authorizeRoles(ROLES.ADMIN),
  validateMembership,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const membership = await MembershipTier.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );

      if (!membership) {
        return res.status(404).json({ message: 'Membership tier not found' });
      }

      res.json(membership);
    } catch (error) {
      res.status(500).json({ message: 'Error updating membership tier', error: error.message });
    }
  }
);

// Delete membership tier (Admin only)
router.delete(
  '/:id',
  auth,
  authorizeRoles(ROLES.ADMIN),
  async (req, res) => {
    try {
      const membership = await MembershipTier.findByIdAndDelete(req.params.id);
      if (!membership) {
        return res.status(404).json({ message: 'Membership tier not found' });
      }
      res.json({ message: 'Membership tier deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting membership tier', error: error.message });
    }
  }
);

// Subscribe to membership tier
router.post(
  '/subscribe',
  auth,
  [body('membershipId').notEmpty().withMessage('Membership tier ID is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { membershipId } = req.body;

      // Check if membership tier exists
      const membership = await MembershipTier.findById(membershipId);
      if (!membership) {
        return res.status(404).json({ message: 'Membership tier not found' });
      }

      // Update user's membership
      const user = await User.findByIdAndUpdate(
        req.user._id,
        { membershipTier: membershipId },
        { new: true }
      ).select('-password');

      res.json({
        message: 'Successfully subscribed to membership tier',
        user,
        membership,
      });
    } catch (error) {
      res.status(500).json({ message: 'Error subscribing to membership tier', error: error.message });
    }
  }
);

module.exports = router; 