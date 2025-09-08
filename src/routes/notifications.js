const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { authorizeRoles, authorizeOwnership } = require('../middleware/authorize');
const { ROLES } = require('../config/roles');
const Notification = require('../models/Notification');
const User = require('../models/User');

const router = express.Router();

// Validation middleware
const validateNotification = [
  body('type').isIn([
    'order_status', 'payment_status', 'stock_alert', 'price_change', 'new_product',
    'cooperative_update', 'loan_update', 'contribution_reminder', 'review_response',
    'system_announcement', 'security_alert', 'welcome', 'verification', 'other'
  ]).withMessage('Valid notification type is required'),
  body('message').trim().notEmpty().withMessage('Notification message is required'),
  body('title').trim().notEmpty().withMessage('Notification title is required'),
  body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']).withMessage('Valid priority is required'),
  body('category').optional().isIn(['transaction', 'system', 'marketing', 'security', 'social']).withMessage('Valid category is required'),
  body('userId').isMongoId().withMessage('Valid user ID is required'),
];

// Get user notifications (User(Self))
router.get('/:userId', 
  auth, 
  authorizeRoles(ROLES.BUYER, ROLES.SELLER, ROLES.COOPERATIVE_ADMIN, ROLES.ADMIN),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { 
        page = 1, 
        limit = 50, 
        status, 
        type, 
        category,
        priority 
      } = req.query;

      // Check if user has access to these notifications
      if (req.user.role === ROLES.ADMIN) {
        // Admin can view any user's notifications
      } else {
        // Regular users can only view their own notifications
        if (userId !== req.user._id.toString()) {
          return res.status(403).json({ 
            message: 'You can only view your own notifications' 
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
      if (status) query.status = status;
      if (type) query.type = type;
      if (category) query.category = category;
      if (priority) query.priority = priority;

      const notifications = await Notification.find(query)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ priority: -1, createdAt: -1 });

      const total = await Notification.countDocuments(query);

      // Get notification statistics
      const stats = await Notification.getUserStats(userId);

      res.json({
        userId,
        notifications: notifications.map(n => n.getSummary()),
        statistics: stats,
        pagination: {
          totalPages: Math.ceil(total / limit),
          currentPage: parseInt(page),
          total,
        },
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error fetching notifications', 
        error: error.message 
      });
    }
  }
);

// Mark notification as read (User(Self))
router.patch('/:id/read', 
  auth, 
  async (req, res) => {
    try {
      const notificationId = req.params.id;
      const notification = await Notification.findById(notificationId);

      if (!notification) {
        return res.status(404).json({ message: 'Notification not found' });
      }

      // Check if user has access to this notification
      if (notification.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ 
          message: 'You can only mark your own notifications as read' 
        });
      }

      await notification.markAsRead();

      res.json({
        message: 'Notification marked as read',
        notification: notification.getSummary(),
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error marking notification as read', 
        error: error.message 
      });
    }
  }
);

// Mark all notifications as read (User(Self))
router.patch('/:userId/read-all', 
  auth, 
  authorizeRoles(ROLES.BUYER, ROLES.SELLER, ROLES.COOPERATIVE_ADMIN, ROLES.ADMIN),
  async (req, res) => {
    try {
      const { userId } = req.params;

      // Check if user has access
      if (req.user.role !== ROLES.ADMIN && userId !== req.user._id.toString()) {
        return res.status(403).json({ 
          message: 'You can only mark your own notifications as read' 
        });
      }

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Mark all unread notifications as read
      const result = await Notification.updateMany(
        { userId, status: 'unread' },
        { 
          $set: { 
            status: 'read',
            'analytics.openedAt': new Date(),
            updatedAt: new Date()
          }
        }
      );

      res.json({
        message: 'All notifications marked as read',
        updatedCount: result.modifiedCount,
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error marking notifications as read', 
        error: error.message 
      });
    }
  }
);

// Archive notification (User(Self))
router.patch('/:id/archive', 
  auth, 
  async (req, res) => {
    try {
      const notificationId = req.params.id;
      const notification = await Notification.findById(notificationId);

      if (!notification) {
        return res.status(404).json({ message: 'Notification not found' });
      }

      // Check if user has access to this notification
      if (notification.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ 
          message: 'You can only archive your own notifications' 
        });
      }

      await notification.markAsArchived();

      res.json({
        message: 'Notification archived successfully',
        notification: notification.getSummary(),
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error archiving notification', 
        error: error.message 
      });
    }
  }
);

// Record notification action (User(Self))
router.patch('/:id/action', 
  auth, 
  async (req, res) => {
    try {
      const notificationId = req.params.id;
      const notification = await Notification.findById(notificationId);

      if (!notification) {
        return res.status(404).json({ message: 'Notification not found' });
      }

      // Check if user has access to this notification
      if (notification.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ 
          message: 'You can only interact with your own notifications' 
        });
      }

      await notification.recordAction();

      res.json({
        message: 'Notification action recorded',
        notification: notification.getSummary(),
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error recording notification action', 
        error: error.message 
      });
    }
  }
);

// Get unread notifications count (User(Self))
router.get('/:userId/unread-count', 
  auth, 
  authorizeRoles(ROLES.BUYER, ROLES.SELLER, ROLES.COOPERATIVE_ADMIN, ROLES.ADMIN),
  async (req, res) => {
    try {
      const { userId } = req.params;

      // Check if user has access
      if (req.user.role !== ROLES.ADMIN && userId !== req.user._id.toString()) {
        return res.status(403).json({ 
          message: 'You can only view your own notification count' 
        });
      }

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const unreadCount = await Notification.countDocuments({
        userId,
        status: 'unread',
      });

      res.json({
        userId,
        unreadCount,
        lastUpdated: new Date(),
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error fetching unread count', 
        error: error.message 
      });
    }
  }
);

// Get notifications by type (User(Self))
router.get('/:userId/type/:type', 
  auth, 
  authorizeRoles(ROLES.BUYER, ROLES.SELLER, ROLES.COOPERATIVE_ADMIN, ROLES.ADMIN),
  async (req, res) => {
    try {
      const { userId, type } = req.params;
      const { page = 1, limit = 20, status } = req.query;

      // Check if user has access
      if (req.user.role !== ROLES.ADMIN && userId !== req.user._id.toString()) {
        return res.status(403).json({ 
          message: 'You can only view your own notifications' 
        });
      }

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const notifications = await Notification.getNotificationsByType(userId, type, {
        page: parseInt(page),
        limit: parseInt(limit),
        status,
      });

      const total = await Notification.countDocuments({ userId, type });

      res.json({
        userId,
        type,
        notifications: notifications.map(n => n.getSummary()),
        pagination: {
          totalPages: Math.ceil(total / limit),
          currentPage: parseInt(page),
          total,
        },
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error fetching notifications by type', 
        error: error.message 
      });
    }
  }
);

// Create notification (Admin + System)
router.post('/', 
  auth, 
  authorizeRoles(ROLES.ADMIN),
  validateNotification,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { 
        type, 
        message, 
        title, 
        userId, 
        priority = 'normal', 
        category = 'system',
        metadata,
        delivery,
        scheduling 
      } = req.body;

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Create notification
      const notification = new Notification({
        userId,
        type,
        message,
        title,
        priority,
        category,
        metadata: metadata || {},
        delivery: delivery || { channels: ['in_app'] },
        scheduling: scheduling || { sendAt: new Date() },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await notification.save();

      res.status(201).json({
        message: 'Notification created successfully',
        notification: notification.getSummary(),
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error creating notification', 
        error: error.message 
      });
    }
  }
);

// Bulk create notifications (Admin + System)
router.post('/bulk', 
  auth, 
  authorizeRoles(ROLES.ADMIN),
  [
    body('notifications').isArray().withMessage('Notifications must be an array'),
    body('notifications.*.type').isIn([
      'order_status', 'payment_status', 'stock_alert', 'price_change', 'new_product',
      'cooperative_update', 'loan_update', 'contribution_reminder', 'review_response',
      'system_announcement', 'security_alert', 'welcome', 'verification', 'other'
    ]).withMessage('Valid notification type is required'),
    body('notifications.*.message').trim().notEmpty().withMessage('Notification message is required'),
    body('notifications.*.title').trim().notEmpty().withMessage('Notification title is required'),
    body('notifications.*.userIds').isArray().withMessage('User IDs must be an array'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { notifications } = req.body;
      const createdNotifications = [];

      for (const notificationData of notifications) {
        const { userIds, ...notificationFields } = notificationData;

        // Validate that all users exist
        const users = await User.find({ _id: { $in: userIds } });
        if (users.length !== userIds.length) {
          return res.status(400).json({ 
            message: 'Some users not found' 
          });
        }

        // Create notification for each user
        for (const userId of userIds) {
          const notification = new Notification({
            userId,
            ...notificationFields,
            delivery: notificationFields.delivery || { channels: ['in_app'] },
            scheduling: notificationFields.scheduling || { sendAt: new Date() },
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          await notification.save();
          createdNotifications.push(notification.getSummary());
        }
      }

      res.status(201).json({
        message: 'Bulk notifications created successfully',
        count: createdNotifications.length,
        notifications: createdNotifications,
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error creating bulk notifications', 
        error: error.message 
      });
    }
  }
);

// Get scheduled notifications (Admin + System)
router.get('/scheduled/list', 
  auth, 
  authorizeRoles(ROLES.ADMIN),
  async (req, res) => {
    try {
      const scheduledNotifications = await Notification.getScheduledNotifications();

      res.json({
        scheduledNotifications: scheduledNotifications.map(n => n.getSummary()),
        count: scheduledNotifications.length,
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error fetching scheduled notifications', 
        error: error.message 
      });
    }
  }
);

// Clean up expired notifications (Admin + System)
router.delete('/cleanup/expired', 
  auth, 
  authorizeRoles(ROLES.ADMIN),
  async (req, res) => {
    try {
      const cleanedCount = await Notification.cleanupExpiredNotifications();

      res.json({
        message: 'Expired notifications cleaned up successfully',
        cleanedCount,
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error cleaning up expired notifications', 
        error: error.message 
      });
    }
  }
);

module.exports = router;

