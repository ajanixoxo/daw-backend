const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  stripePaymentIntentId: {
    type: String,
    required: true,
  },
  stripeCustomerId: {
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
  status: {
    type: String,
    enum: [
      'pending',
      'processing',
      'succeeded',
      'failed',
      'canceled',
      'refunded',
      'partially_refunded'
    ],
    default: 'pending',
  },
  paymentType: {
    type: String,
    enum: ['order', 'subscription', 'wallet_topup', 'masterclass', 'cart', 'other'],
    required: true,
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false, // Can reference Order, Subscription, etc.
  },
  relatedModel: {
    type: String,
    enum: ['Order', 'Subscription', 'Masterclass', 'User'],
    required: false,
  },
  paymentMethod: {
    type: {
      type: String,
      enum: ['card', 'bank_transfer', 'wallet'],
    },
    last4: String,
    brand: String,
    country: String,
  },
  metadata: {
    type: Map,
    of: String,
    default: {},
  },
  refunds: [{
    stripeRefundId: String,
    amount: Number,
    reason: String,
    status: String,
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  failureReason: {
    code: String,
    message: String,
  },
  receiptUrl: String,
  description: String,
  processingFee: {
    type: Number,
    default: 0,
  },
  netAmount: {
    type: Number,
    default: function() {
      return this.amount - (this.processingFee || 0);
    },
  },
}, {
  timestamps: true,
});

// No additional indexes - only using default _id index

// Virtual for total refunded amount
paymentSchema.virtual('totalRefunded').get(function() {
  return this.refunds.reduce((total, refund) => {
    return refund.status === 'succeeded' ? total + refund.amount : total;
  }, 0);
});

// Method to check if payment is successful
paymentSchema.methods.isSuccessful = function() {
  return this.status === 'succeeded';
};

// Method to check if payment can be refunded
paymentSchema.methods.canBeRefunded = function() {
  return this.status === 'succeeded' && this.totalRefunded < this.amount;
};

// Method to add refund
paymentSchema.methods.addRefund = function(refundData) {
  this.refunds.push(refundData);
  
  // Update payment status based on refund amount
  const totalRefunded = this.totalRefunded + refundData.amount;
  if (totalRefunded >= this.amount) {
    this.status = 'refunded';
  } else if (totalRefunded > 0) {
    this.status = 'partially_refunded';
  }
};

// Static method to find payments by user
paymentSchema.statics.findByUser = function(userId, options = {}) {
  const query = { userId };
  
  if (options.status) {
    query.status = options.status;
  }
  
  if (options.paymentType) {
    query.paymentType = options.paymentType;
  }
  
  return this.find(query)
    .populate('userId', 'name email')
    .sort({ createdAt: -1 })
    .limit(options.limit || 50);
};

// Static method to get payment statistics
paymentSchema.statics.getStats = async function(dateRange = {}) {
  const matchStage = {};
  
  if (dateRange.start || dateRange.end) {
    matchStage.createdAt = {};
    if (dateRange.start) matchStage.createdAt.$gte = new Date(dateRange.start);
    if (dateRange.end) matchStage.createdAt.$lte = new Date(dateRange.end);
  }
  
  return await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        avgAmount: { $avg: '$amount' },
      },
    },
  ]);
};

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;