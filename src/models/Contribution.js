const mongoose = require('mongoose');

const contributionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  cooperativeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cooperative',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  type: {
    type: String,
    enum: ['savings', 'loan_repayment', 'emergency_fund', 'investment', 'donation', 'fee', 'other'],
    required: true,
  },
  category: {
    type: String,
    enum: ['regular', 'special', 'matching', 'voluntary', 'mandatory'],
    default: 'regular',
  },
  contributionTier: {
    type: String,
    enum: ['basic', 'standard', 'premium'],
    required: true,
    default: 'basic',
  },
  tierBenefits: {
    discountPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    prioritySupport: {
      type: Boolean,
      default: false,
    },
    advancedAnalytics: {
      type: Boolean,
      default: false,
    },
    featuredListing: {
      type: Boolean,
      default: false,
    },
    bulkUploadTools: {
      type: Boolean,
      default: false,
    },
    marketingSupport: {
      type: Boolean,
      default: false,
    },
    monthlyBusinessReviews: {
      type: Boolean,
      default: false,
    },
    exclusiveEvents: {
      type: Boolean,
      default: false,
    },
    mentorshipPrograms: {
      type: Boolean,
      default: false,
    },
  },
  frequency: {
    type: String,
    enum: ['one_time', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually'],
    default: 'one_time',
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'failed', 'cancelled'],
    default: 'pending',
  },
  method: {
    type: String,
    enum: ['cash', 'bank_transfer', 'mobile_money', 'wallet', 'check', 'other'],
    required: true,
  },
  reference: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    trim: true,
  },
  metadata: {
    loanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Loan',
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    externalReference: {
      type: String,
      trim: true,
    },
    source: {
      type: String,
      trim: true,
    },
    destination: {
      type: String,
      trim: true,
    },
  },
  schedule: {
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    nextDueDate: {
      type: Date,
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    lastProcessed: {
      type: Date,
    },
    processedCount: {
      type: Number,
      default: 0,
    },
  },
  matching: {
    isEligible: {
      type: Boolean,
      default: false,
    },
    matchRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    matchAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    matchedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    matchedAt: Date,
  },
  verification: {
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    verifiedAt: Date,
    verificationNotes: {
      type: String,
      trim: true,
    },
    documents: [{
      type: {
        type: String,
        required: true,
      },
      url: {
        type: String,
        required: true,
      },
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
    }],
  },
  timeline: {
    initiatedAt: {
      type: Date,
      default: Date.now,
    },
    processedAt: Date,
    confirmedAt: Date,
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
contributionSchema.index({ userId: 1, cooperativeId: 1, createdAt: -1 });
contributionSchema.index({ cooperativeId: 1, status: 1 });
contributionSchema.index({ type: 1, status: 1 });
contributionSchema.index({ reference: 1 }, { unique: true });
contributionSchema.index({ 'schedule.nextDueDate': 1 });
contributionSchema.index({ createdAt: -1 });

// Update timestamp on save
contributionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Calculate match amount if eligible
  if (this.matching.isEligible && this.matching.matchRate > 0) {
    this.matching.matchAmount = (this.amount * this.matching.matchRate) / 100;
  }
  
  next();
});

// Instance methods
contributionSchema.methods = {
  /**
   * Check if contribution is confirmed
   */
  isConfirmed() {
    return this.status === 'confirmed';
  },

  /**
   * Check if contribution is pending
   */
  isPending() {
    return this.status === 'pending';
  },

  /**
   * Check if contribution is recurring
   */
  isRecurring() {
    return this.schedule.isRecurring;
  },

  /**
   * Get total amount including matching
   */
  getTotalAmount() {
    return this.amount + this.matching.matchAmount;
  },

  /**
   * Get contribution summary
   */
  getSummary() {
    return {
      id: this._id,
      type: this.type,
      amount: this.amount,
      status: this.status,
      method: this.method,
      reference: this.reference,
      totalAmount: this.getTotalAmount(),
      isRecurring: this.isRecurring(),
      createdAt: this.createdAt,
      confirmedAt: this.timeline.confirmedAt,
    };
  },

  /**
   * Check if contribution is due
   */
  isDue() {
    if (!this.isRecurring() || !this.schedule.nextDueDate) return false;
    return new Date() >= this.schedule.nextDueDate;
  },

  /**
   * Calculate next due date
   */
  calculateNextDueDate() {
    if (!this.isRecurring() || !this.schedule.lastProcessed) return null;
    
    const nextDate = new Date(this.schedule.lastProcessed);
    
    switch (this.frequency) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'biweekly':
        nextDate.setDate(nextDate.getDate() + 14);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'quarterly':
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case 'annually':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
    }
    
    return nextDate;
  },
};

// Static methods
contributionSchema.statics = {
  /**
   * Generate unique contribution reference
   */
  async generateReference() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    const reference = `CON-${timestamp}-${random}`.toUpperCase();
    
    // Check if reference already exists
    const existing = await this.findOne({ reference });
    if (existing) {
      return this.generateReference(); // Recursively generate new reference
    }
    
    return reference;
  },

  /**
   * Get due contributions for a user
   */
  async getDueContributions(userId) {
    const now = new Date();
    return this.find({
      userId,
      'schedule.isRecurring': true,
      'schedule.nextDueDate': { $lte: now },
      status: { $in: ['confirmed', 'pending'] },
    });
  },

  /**
   * Get predefined contribution tiers
   */
  getContributionTiers() {
    return {
      basic: {
        name: 'Basic Tier',
        minAmount: 1000,
        benefits: {
          discountPercentage: 0,
          prioritySupport: false,
          advancedAnalytics: false,
          featuredListing: false,
          bulkUploadTools: false,
          marketingSupport: false,
          monthlyBusinessReviews: false,
          exclusiveEvents: false,
          mentorshipPrograms: false,
        },
        description: 'Entry-level membership with basic benefits'
      },
      standard: {
        name: 'Standard Tier',
        minAmount: 5000,
        benefits: {
          discountPercentage: 5,
          prioritySupport: true,
          advancedAnalytics: true,
          featuredListing: true,
          bulkUploadTools: true,
          marketingSupport: false,
          monthlyBusinessReviews: false,
          exclusiveEvents: true,
          mentorshipPrograms: true,
        },
        description: 'Enhanced membership with priority support and analytics'
      },
      premium: {
        name: 'Premium Tier',
        minAmount: 15000,
        benefits: {
          discountPercentage: 10,
          prioritySupport: true,
          advancedAnalytics: true,
          featuredListing: true,
          bulkUploadTools: true,
          marketingSupport: true,
          monthlyBusinessReviews: true,
          exclusiveEvents: true,
          mentorshipPrograms: true,
        },
        description: 'Full-featured membership with complete benefits package'
      }
    };
  },

  /**
   * Get tier by amount contributed
   */
  getTierByAmount(amount) {
    const tiers = this.getContributionTiers();
    
    if (amount >= tiers.premium.minAmount) {
      return 'premium';
    } else if (amount >= tiers.standard.minAmount) {
      return 'standard';
    } else {
      return 'basic';
    }
  },

  /**
   * Get user's effective tier based on total contributions
   */
  async getUserEffectiveTier(userId, cooperativeId) {
    const totalContributions = await this.aggregate([
      {
        $match: {
          userId: mongoose.Types.ObjectId(userId),
          cooperativeId: mongoose.Types.ObjectId(cooperativeId),
          status: 'confirmed'
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    const total = totalContributions.length > 0 ? totalContributions[0].totalAmount : 0;
    return this.getTierByAmount(total);
  },

  /**
   * Get contribution statistics for a cooperative
   */
  async getCooperativeStats(cooperativeId, startDate, endDate) {
    const query = { cooperativeId };
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = startDate;
      if (endDate) query.createdAt.$lte = endDate;
    }
    
    const contributions = await this.find(query);
    
    const stats = {
      totalContributions: contributions.length,
      totalAmount: 0,
      totalMatching: 0,
      confirmedContributions: 0,
      pendingContributions: 0,
      typeBreakdown: {},
      statusBreakdown: {},
      frequencyBreakdown: {},
    };
    
    contributions.forEach(contribution => {
      stats.totalAmount += contribution.amount;
      stats.totalMatching += contribution.matching.matchAmount;
      
      // Count by status
      stats.statusBreakdown[contribution.status] = (stats.statusBreakdown[contribution.status] || 0) + 1;
      
      // Count by type
      stats.typeBreakdown[contribution.type] = (stats.typeBreakdown[contribution.type] || 0) + 1;
      
      // Count by frequency
      stats.frequencyBreakdown[contribution.frequency] = (stats.frequencyBreakdown[contribution.frequency] || 0) + 1;
      
      // Count confirmed and pending
      if (contribution.status === 'confirmed') {
        stats.confirmedContributions++;
      } else if (contribution.status === 'pending') {
        stats.pendingContributions++;
      }
    });
    
    return stats;
  },

  /**
   * Get user contribution summary
   */
  async getUserSummary(userId, cooperativeId) {
    const contributions = await this.find({ userId, cooperativeId });
    
    const summary = {
      totalContributions: contributions.length,
      totalAmount: 0,
      totalMatching: 0,
      confirmedAmount: 0,
      pendingAmount: 0,
      typeBreakdown: {},
      frequencyBreakdown: {},
    };
    
    contributions.forEach(contribution => {
      summary.totalAmount += contribution.amount;
      summary.totalMatching += contribution.matching.matchAmount;
      
      // Count by type
      summary.typeBreakdown[contribution.type] = (summary.typeBreakdown[contribution.type] || 0) + 1;
      
      // Count by frequency
      summary.frequencyBreakdown[contribution.frequency] = (summary.frequencyBreakdown[contribution.frequency] || 0) + 1;
      
      // Sum by status
      if (contribution.status === 'confirmed') {
        summary.confirmedAmount += contribution.amount;
      } else if (contribution.status === 'pending') {
        summary.pendingAmount += contribution.amount;
      }
    });
    
    return summary;
  },
};

const Contribution = mongoose.model('Contribution', contributionSchema);

module.exports = Contribution;
