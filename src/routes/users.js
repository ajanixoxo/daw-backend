const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { authorizePermissions, authorizeRoles, authorizeOwnership } = require('../middleware/authorize');
const { ROLES, PERMISSIONS } = require('../config/roles');
const User = require('../models/User');

const router = express.Router();

// Validation middleware
const validateUserUpdate = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('email').optional().trim().isEmail().withMessage('Please enter a valid email'),
  body('role')
    .optional()
    .isIn(Object.values(ROLES))
    .withMessage('Invalid role specified'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'suspended'])
    .withMessage('Invalid status specified'),
];

// Get all users (Admin only)
router.get(
  '/',
  auth,
  authorizeRoles(ROLES.ADMIN),
  async (req, res) => {
    try {
      const users = await User.find().select('-password');
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching users', error: error.message });
    }
  }
);

// Get user by ID
router.get(
  '/:id',
  auth,
  authorizePermissions(PERMISSIONS.READ_PROFILE),
  authorizeOwnership('id'),
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id).select('-password');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching user', error: error.message });
    }
  }
);

// Update user
router.put(
  '/:id',
  auth,
  authorizePermissions(PERMISSIONS.UPDATE_PROFILE),
  authorizeOwnership('id'),
  validateUserUpdate,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, email, role, status } = req.body;
      const updateData = {};

      if (name) updateData.name = name;
      if (email) updateData.email = email;

      // Only admin can update role and status
      if (req.user.role === ROLES.ADMIN) {
        if (role) updateData.role = role;
        if (status) updateData.status = status;
      }

      const user = await User.findByIdAndUpdate(
        req.params.id,
        { $set: updateData },
        { new: true, runValidators: true }
      ).select('-password');

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      res.status(500).json({ message: 'Error updating user', error: error.message });
    }
  }
);

// Delete user
router.delete(
  '/:id',
  auth,
  authorizePermissions(PERMISSIONS.DELETE_PROFILE),
  authorizeOwnership('id'),
  async (req, res) => {
    try {
      const user = await User.findByIdAndDelete(req.params.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting user', error: error.message });
    }
  }
);

// Admin: Update user role
router.patch(
  '/:id/role',
  auth,
  authorizeRoles(ROLES.ADMIN),
  [body('role').isIn(Object.values(ROLES)).withMessage('Invalid role specified')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = await User.findByIdAndUpdate(
        req.params.id,
        { $set: { role: req.body.role } },
        { new: true, runValidators: true }
      ).select('-password');

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      res.status(500).json({ message: 'Error updating user role', error: error.message });
    }
  }
);

// Admin: Update user status
router.patch(
  '/:id/status',
  auth,
  authorizeRoles(ROLES.ADMIN),
  [body('status').isIn(['active', 'inactive', 'suspended']).withMessage('Invalid status specified')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = await User.findByIdAndUpdate(
        req.params.id,
        { $set: { status: req.body.status } },
        { new: true, runValidators: true }
      ).select('-password');

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      res.status(500).json({ message: 'Error updating user status', error: error.message });
    }
  }
);

module.exports = router; 