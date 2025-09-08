const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: [
      'order_status', 'payment_status', 'stock_alert', 'price_change', 'new_product',
      'cooperative_update', 'loan_update', 'contribution_reminder', 'review_response',
      'system_announcement', 'security_alert', 'welcome', 'verification', 'other'
    ],
    required: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  status: {
    type: String,
    enum: ['unread', 'read', 'archived'],
    default: 'unread',
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
  },
  category: {
    type: String,
    enum: ['transaction', 'system', 'marketing', 'security', 'social'],
    default: 'system',
  },
  metadata: {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
    },
    cooperativeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cooperative',
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
    },
    loanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Loan',
    },
    contributionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contribution',
    },
    reviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Review',
    },
    externalUrl: {
      type: String,
      trim: true,
    },
    actionRequired: {
      type: Boolean,
      default: false,
    },
    actionText: {
      type: String,
      trim: true,
    },
    actionUrl: {
      type: String,
      trim: true,
    },
  },
  delivery: {
    channels: [{
      type: String,
      enum: ['in_app', 'email', 'sms', 'push', 'webhook'],
      default: 'in_app',
    }],
    sentAt: {
      in_app: Date,
      email: Date,
      sms: Date,
      push: Date,
      webhook: Date,
    },
    deliveredAt: {
      in_app: Date,
      email: Date,
      sms: Date,
      push: Date,
      webhook: Date,
    },
    failedAt: {
      in_app: Date,
      email: Date,
      sms: Date,
      push: Date,
      webhook: Date,
    },
    retryCount: {
      in_app: { type: Number, default: 0 },
      email: { type: Number, default: 0 },
      sms: { type: Number, default: 0 },
      push: { type: Number, default: 0 },
      webhook: { type: Number, default: 0 },
    },
  },
  scheduling: {
    sendAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
    },
    isScheduled: {
      type: Boolean,
      default: false,
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    recurrence: {
      pattern: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'custom'],
      },
      interval: {
        type: Number,
        default: 1,
      },
      endDate: Date,
      nextSendDate: Date,
    },
  },
  template: {
    name: {
      type: String,
      trim: true,
    },
    version: {
      type: String,
      trim: true,
    },
    variables: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
  },
  analytics: {
    openedAt: Date,
    clickedAt: Date,
    actionTakenAt: Date,
    timeToOpen: Number, // in milliseconds
    timeToAction: Number, // in milliseconds
    engagementScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes
notificationSchema.index({ userId: 1, status: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
notificationSchema.index({ type: 1, status: 1, createdAt: -1 });
notificationSchema.index({ priority: 1, createdAt: -1 });
notificationSchema.index({ 'scheduling.sendAt': 1 });
notificationSchema.index({ 'scheduling.expiresAt': 1 });
notificationSchema.index({ createdAt: -1 });

// Update timestamp on save
notificationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Set default delivery channels based on type
  if (this.delivery.channels.length === 0) {
    this.delivery.channels = ['in_app'];
  }
  
  // Set expiration date if not provided (default: 30 days)
  if (!this.scheduling.expiresAt) {
    this.scheduling.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  
  next();
});

// Instance methods
notificationSchema.methods = {
  /**
   * Check if notification is unread
   */
  isUnread() {
    return this.status === 'unread';
  },

  /**
   * Check if notification is expired
   */
  isExpired() {
    return this.scheduling.expiresAt && new Date() > this.scheduling.expiresAt;
  },

  /**
   * Check if notification is scheduled
   */
  isScheduled() {
    return this.scheduling.isScheduled && this.scheduling.sendAt > new Date();
  },

  /**
   * Mark notification as read
   */
  markAsRead() {
    this.status = 'read';
    this.analytics.openedAt = new Date();
    
    if (this.analytics.openedAt && this.createdAt) {
      this.analytics.timeToOpen = this.analytics.openedAt.getTime() - this.createdAt.getTime();
    }
    
    return this.save();
  },

  /**
   * Mark notification as archived
   */
  markAsArchived() {
    this.status = 'archived';
    return this.save();
  },

  /**
   * Record action taken
   */
  recordAction() {
    this.analytics.actionTakenAt = new Date();
    
    if (this.analytics.actionTakenAt && this.createdAt) {
      this.analytics.timeToAction = this.analytics.actionTakenAt.getTime() - this.createdAt.getTime();
    }
    
    return this.save();
  },

  /**
   * Get notification summary
   */
  getSummary() {
    return {
      id: this._id,
      type: this.type,
      title: this.title,
      message: this.message,
      status: this.status,
      priority: this.priority,
      category: this.category,
      isRead: this.status === 'read',
      isExpired: this.isExpired(),
      createdAt: this.createdAt,
      metadata: this.metadata,
    };
  },

  /**
   * Check if notification should be sent now
   */
  shouldSendNow() {
    if (this.isExpired()) return false;
    if (this.isScheduled()) return false;
    return true;
  },

  /**
   * Get next send date for recurring notifications
   */
  getNextSendDate() {
    if (!this.scheduling.isRecurring || !this.scheduling.recurrence) {
      return null;
    }
    
    const lastSendDate = this.scheduling.recurrence.nextSendDate || this.createdAt;
    const nextDate = new Date(lastSendDate);
    
    switch (this.scheduling.recurrence.pattern) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + this.scheduling.recurrence.interval);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + (7 * this.scheduling.recurrence.interval));
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + this.scheduling.recurrence.interval);
        break;
    }
    
    return nextDate;
  },
};

// Static methods
notificationSchema.statics = {
  /**
   * Get unread notifications for a user
   */
  async getUnreadNotifications(userId, options = {}) {
    const query = { userId, status: 'unread' };
    
    if (options.type) {
      query.type = options.type;
    }
    
    if (options.category) {
      query.category = options.category;
    }
    
    const sort = { priority: -1, createdAt: -1 };
    const limit = options.limit || 50;
    const skip = options.skip || 0;
    
    return this.find(query)
      .sort(sort)
      .limit(limit)
      .skip(skip);
  },

  /**
   * Get notifications by type for a user
   */
  async getNotificationsByType(userId, type, options = {}) {
    const query = { userId, type };
    
    if (options.status) {
      query.status = options.status;
    }
    
    const sort = { createdAt: -1 };
    const limit = options.limit || 20;
    const skip = options.skip || 0;
    
    return this.find(query)
      .sort(sort)
      .limit(limit)
      .skip(skip);
  },

  /**
   * Get scheduled notifications ready to send
   */
  async getScheduledNotifications() {
    const now = new Date();
    return this.find({
      'scheduling.isScheduled': true,
      'scheduling.sendAt': { $lte: now },
      status: { $ne: 'archived' },
    });
  },

  /**
   * Get expired notifications
   */
  async getExpiredNotifications() {
    const now = new Date();
    return this.find({
      'scheduling.expiresAt': { $lt: now },
      status: { $ne: 'archived' },
    });
  },

  /**
   * Get notification statistics for a user
   */
  async getUserStats(userId) {
    const notifications = await this.find({ userId });
    
    const stats = {
      total: notifications.length,
      unread: 0,
      read: 0,
      archived: 0,
      typeBreakdown: {},
      categoryBreakdown: {},
      priorityBreakdown: {},
    };
    
    notifications.forEach(notification => {
      // Count by status
      stats[notification.status]++;
      
      // Count by type
      stats.typeBreakdown[notification.type] = (stats.typeBreakdown[notification.type] || 0) + 1;
      
      // Count by category
      stats.categoryBreakdown[notification.category] = (stats.categoryBreakdown[notification.category] || 0) + 1;
      
      // Count by priority
      stats.priorityBreakdown[notification.priority] = (stats.priorityBreakdown[notification.priority] || 0) + 1;
    });
    
    return stats;
  },

  /**
   * Clean up expired notifications
   */
  async cleanupExpiredNotifications() {
    const now = new Date();
    const result = await this.updateMany(
      {
        'scheduling.expiresAt': { $lt: now },
        status: { $ne: 'archived' },
      },
      {
        $set: { status: 'archived' },
      }
    );
    
    return result.modifiedCount;
  },
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;

