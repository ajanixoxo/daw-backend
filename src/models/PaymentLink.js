const mongoose = require('mongoose');
const crypto = require('crypto');

const paymentLinkSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  stripePaymentLinkId: {
    type: String,
    required: true,
    unique: true,
  },
  stripePriceId: {
    type: String,
    required: true,
  },
  stripeProductId: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  currency: {
    type: String,
    required: true,
    default: 'usd',
    uppercase: true,
  },
  secureCode: {
    type: String,
    required: true,
    unique: true,
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'expired', 'failed'],
    default: 'pending',
  },
  paymentType: {
    type: String,
    enum: ['subscription', 'one_time', 'donation', 'membership', 'product', 'cart'],
    required: true,
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false, // Can reference Product, Subscription, etc.
  },
  relatedModel: {
    type: String,
    enum: ['Product', 'Subscription', 'Masterclass', 'Membership', 'Order'],
    required: false,
  },
  metadata: {
    type: Map,
    of: String,
    default: {},
  },
  expiresAt: {
    type: Date,
    required: true,
    default: function() {
      // Payment link expires in 24 hours
      return new Date(Date.now() + 24 * 60 * 60 * 1000);
    },
  },
  completedAt: {
    type: Date,
  },
  stripeSessionId: {
    type: String, // Will be populated when payment is completed
  },
  customerEmail: String,
  customerName: String,
  failureReason: String,
}, {
  timestamps: true,
});

// Index for better query performance
paymentLinkSchema.index({ userId: 1, status: 1 });
paymentLinkSchema.index({ secureCode: 1 });
paymentLinkSchema.index({ stripePaymentLinkId: 1 });
paymentLinkSchema.index({ expiresAt: 1 });
paymentLinkSchema.index({ createdAt: -1 });

// Generate secure code before saving
paymentLinkSchema.pre('save', function(next) {
  if (!this.secureCode) {
    this.secureCode = crypto.randomBytes(16).toString('hex');
  }
  next();
});

// Check if payment link is expired
paymentLinkSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt;
};

// Check if payment link is valid for completion
paymentLinkSchema.methods.canComplete = function() {
  return this.status === 'pending' && !this.isExpired();
};

// Mark as completed
paymentLinkSchema.methods.markCompleted = function(sessionId, customerInfo = {}) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.stripeSessionId = sessionId;
  
  if (customerInfo.email) this.customerEmail = customerInfo.email;
  if (customerInfo.name) this.customerName = customerInfo.name;
};

// Mark as expired
paymentLinkSchema.methods.markExpired = function() {
  if (this.status === 'pending') {
    this.status = 'expired';
  }
};

// Static method to find by secure code
paymentLinkSchema.statics.findBySecureCode = function(secureCode) {
  return this.findOne({ secureCode, status: 'pending' })
    .populate('userId', 'name email')
    .populate('relatedId');
};

// Static method to cleanup expired links
paymentLinkSchema.statics.cleanupExpired = async function() {
  const expiredLinks = await this.updateMany(
    { 
      status: 'pending',
      expiresAt: { $lt: new Date() }
    },
    { 
      status: 'expired' 
    }
  );
  
  return expiredLinks.modifiedCount;
};

const PaymentLink = mongoose.model('PaymentLink', paymentLinkSchema);

module.exports = PaymentLink;