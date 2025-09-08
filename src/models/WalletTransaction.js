const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['top_up', 'payout', 'refund', 'purchase', 'transfer_in', 'transfer_out', 'fee', 'bonus', 'adjustment'],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  reference: {
    type: String,
    required: true,
    unique: true,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending',
  },
  previousBalance: {
    type: Number,
    required: true,
  },
  newBalance: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: 'USD',
    trim: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  metadata: {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
    },
    cooperativeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cooperative',
    },
    source: {
      type: String,
      trim: true,
    },
    destination: {
      type: String,
      trim: true,
    },
    externalReference: {
      type: String,
      trim: true,
    },
  },
  fees: {
    transactionFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    processingFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalFees: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  timeline: {
    initiatedAt: {
      type: Date,
      default: Date.now,
    },
    processedAt: Date,
    completedAt: Date,
    failedAt: Date,
    cancelledAt: Date,
  },
  notes: {
    type: String,
    trim: true,
  },
  tags: [{
    type: String,
    trim: true,
  }],
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
walletTransactionSchema.index({ userId: 1, createdAt: -1 });
walletTransactionSchema.index({ type: 1, createdAt: -1 });
walletTransactionSchema.index({ status: 1, createdAt: -1 });
walletTransactionSchema.index({ reference: 1 }, { unique: true });
walletTransactionSchema.index({ 'metadata.orderId': 1 });
walletTransactionSchema.index({ 'metadata.paymentId': 1 });
walletTransactionSchema.index({ createdAt: -1 });

// Update timestamp on save
walletTransactionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Calculate total fees
  this.fees.totalFees = this.fees.transactionFee + this.fees.processingFee;
  
  next();
});

// Instance methods
walletTransactionSchema.methods = {
  /**
   * Check if transaction is successful
   */
  isSuccessful() {
    return this.status === 'completed';
  },

  /**
   * Check if transaction is pending
   */
  isPending() {
    return ['pending', 'processing'].includes(this.status);
  },

  /**
   * Check if transaction increases wallet balance
   */
  isCredit() {
    return ['top_up', 'refund', 'transfer_in', 'bonus'].includes(this.type);
  },

  /**
   * Check if transaction decreases wallet balance
   */
  isDebit() {
    return ['payout', 'purchase', 'transfer_out', 'fee'].includes(this.type);
  },

  /**
   * Get transaction summary
   */
  getSummary() {
    return {
      id: this._id,
      type: this.type,
      amount: this.amount,
      status: this.status,
      reference: this.reference,
      previousBalance: this.previousBalance,
      newBalance: this.newBalance,
      description: this.description,
      createdAt: this.createdAt,
    };
  },

  /**
   * Get formatted amount with sign
   */
  getFormattedAmount() {
    const sign = this.isCredit() ? '+' : this.isDebit() ? '-' : '';
    return `${sign}${this.currency} ${Math.abs(this.amount).toFixed(2)}`;
  },

  /**
   * Get transaction timeline
   */
  getTimeline() {
    return {
      initiated: this.timeline.initiatedAt,
      processed: this.timeline.processedAt,
      completed: this.timeline.completedAt,
      failed: this.timeline.failedAt,
      cancelled: this.timeline.cancelledAt,
    };
  },
};

// Static methods
walletTransactionSchema.statics = {
  /**
   * Generate unique transaction reference
   */
  async generateReference() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    const reference = `WAL-${timestamp}-${random}`.toUpperCase();
    
    // Check if reference already exists
    const existing = await this.findOne({ reference });
    if (existing) {
      return this.generateReference(); // Recursively generate new reference
    }
    
    return reference;
  },

  /**
   * Get wallet transaction statistics for a user
   */
  async getUserStats(userId, startDate, endDate) {
    const query = { userId };
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = startDate;
      if (endDate) query.createdAt.$lte = endDate;
    }
    
    const transactions = await this.find(query);
    
    const stats = {
      totalTransactions: transactions.length,
      totalCredits: 0,
      totalDebits: 0,
      netChange: 0,
      totalFees: 0,
      typeBreakdown: {},
      statusBreakdown: {},
    };
    
    transactions.forEach(transaction => {
      // Count by type
      stats.typeBreakdown[transaction.type] = (stats.typeBreakdown[transaction.type] || 0) + 1;
      
      // Count by status
      stats.statusBreakdown[transaction.status] = (stats.statusBreakdown[transaction.status] || 0) + 1;
      
      // Calculate totals
      if (transaction.isCredit()) {
        stats.totalCredits += transaction.amount;
        stats.netChange += transaction.amount;
      } else if (transaction.isDebit()) {
        stats.totalDebits += transaction.amount;
        stats.netChange -= transaction.amount;
      }
      
      stats.totalFees += transaction.fees.totalFees;
    });
    
    return stats;
  },

  /**
   * Get wallet balance for a user
   */
  async getUserBalance(userId) {
    const lastTransaction = await this.findOne(
      { userId, status: 'completed' },
      {},
      { sort: { createdAt: -1 } }
    );
    
    return lastTransaction ? lastTransaction.newBalance : 0;
  },
};

const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema);

module.exports = WalletTransaction;

