const express = require('express');
const router = express.Router();
const { getUserById, updateUser, deleteUser } = require('@controllers/admin/user.controller.js');
const { protect, restrictTo } = require('@middlewares/authMiddleware.js');

// All routes are admin-protected
router.use(protect);
router.use(restrictTo('admin'));

// User management routes
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router;
