const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
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
  type: {
    type: String,
    enum: ['business', 'agricultural', 'emergency', 'education', 'housing', 'equipment', 'other'],
    required: true,
  },
  loanCategory: {
    type: String,
    enum: ['emergency', 'growth', 'large-scale'],
    required: true,
  },
  loanTier: {
    name: {
      type: String,
      required: true,
    },
    maxAmount: {
      type: Number,
      required: true,
    },
    minAmount: {
      type: Number,
      required: true,
    },
    interestRateRange: {
      min: { type: Number, required: true },
      max: { type: Number, required: true },
    },
    repaymentPeriod: {
      min: { type: Number, required: true }, // in months
      max: { type: Number, required: true }, // in months
    },
    eligibilityMonths: {
      type: Number,
      required: true,
    },
    monthlyContributionOptions: [{
      type: Number,
    }],
    features: [{
      type: String,
    }],
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  imageUrl: {
    type: String,
    trim: true,
    default: '',
  },
  interestRate: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'active', 'completed', 'defaulted', 'cancelled'],
    default: 'pending',
  },
  repaymentPlan: {
    type: String,
    enum: ['weekly', 'biweekly', 'monthly', 'quarterly', 'annually', 'custom'],
    required: true,
  },
  term: {
    type: Number,
    required: true,
    min: 1,
  },
  termUnit: {
    type: String,
    enum: ['days', 'weeks', 'months', 'years'],
    required: true,
  },
  disbursementDate: {
    type: Date,
  },
  dueDate: {
    type: Date,
  },
  nextPaymentDate: {
    type: Date,
  },
  totalInterest: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  amountPaid: {
    type: Number,
    default: 0,
    min: 0,
  },
  remainingBalance: {
    type: Number,
    default: 0,
    min: 0,
  },
  payments: [{
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    type: {
      type: String,
      enum: ['principal', 'interest', 'penalty', 'other'],
      default: 'principal',
    },
    reference: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  }],
  collateral: {
    type: {
      type: String,
      enum: ['property', 'vehicle', 'equipment', 'savings', 'guarantor', 'other'],
    },
    description: {
      type: String,
      trim: true,
    },
    value: {
      type: Number,
      min: 0,
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
  guarantors: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    name: {
      type: String,
      required: true,
    },
    relationship: {
      type: String,
      trim: true,
    },
    contact: {
      phone: String,
      email: String,
    },
    income: {
      type: Number,
      min: 0,
    },
    approved: {
      type: Boolean,
      default: false,
    },
    approvedAt: Date,
  }],
  approval: {
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: Date,
    approvedAmount: {
      type: Number,
      min: 0,
    },
    approvedTerm: {
      type: Number,
      min: 1,
    },
    approvedInterestRate: {
      type: Number,
      min: 0,
      max: 100,
    },
    conditions: [{
      type: String,
      trim: true,
    }],
    notes: {
      type: String,
      trim: true,
    },
  },
  documents: [{
    type: {
      type: String,
      enum: ['application', 'income_proof', 'bank_statement', 'collateral_document', 'other'],
      required: true,
    },
    name: {
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
    verifiedAt: Date,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  }],
  notes: {
    type: String,
    trim: true,
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
loanSchema.index({ userId: 1, status: 1 });
loanSchema.index({ cooperativeId: 1, status: 1 });
loanSchema.index({ status: 1, dueDate: 1 });
loanSchema.index({ nextPaymentDate: 1 });
loanSchema.index({ createdAt: -1 });

// Update timestamp on save
loanSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Calculate total amount (principal + interest)
  if (this.amount && this.interestRate && this.term) {
    const totalInterest = (this.amount * this.interestRate * this.term) / 100;
    this.totalInterest = totalInterest;
    this.totalAmount = this.amount + totalInterest;
  }
  
  // Calculate remaining balance
  if (this.totalAmount && this.amountPaid) {
    this.remainingBalance = Math.max(0, this.totalAmount - this.amountPaid);
  }
  
  next();
});

// Instance methods
loanSchema.methods = {
  /**
   * Check if loan is active
   */
  isActive() {
    return this.status === 'active';
  },

  /**
   * Check if loan is overdue
   */
  isOverdue() {
    if (!this.dueDate || !this.isActive()) return false;
    return new Date() > this.dueDate;
  },

  /**
   * Check if loan can be disbursed
   */
  canBeDisbursed() {
    return this.status === 'approved' && !this.disbursementDate;
  },

  /**
   * Get loan summary
   */
  getSummary() {
    return {
      id: this._id,
      type: this.type,
      amount: this.amount,
      status: this.status,
      interestRate: this.interestRate,
      term: this.term,
      termUnit: this.termUnit,
      totalAmount: this.totalAmount,
      remainingBalance: this.remainingBalance,
      dueDate: this.dueDate,
      nextPaymentDate: this.nextPaymentDate,
    };
  },

  /**
   * Calculate next payment amount
   */
  calculateNextPayment() {
    if (!this.isActive()) return 0;
    
    const remainingPayments = Math.ceil(this.remainingBalance / this.amount);
    if (remainingPayments <= 0) return 0;
    
    return Math.ceil(this.remainingBalance / remainingPayments);
  },

  /**
   * Get payment schedule
   */
  getPaymentSchedule() {
    if (!this.totalAmount || !this.term) return [];
    
    const schedule = [];
    const paymentAmount = this.totalAmount / this.term;
    let remainingBalance = this.totalAmount;
    
    for (let i = 1; i <= this.term; i++) {
      const payment = {
        installment: i,
        amount: paymentAmount,
        dueDate: this.calculateDueDate(i),
        remainingBalance: remainingBalance - paymentAmount,
      };
      
      schedule.push(payment);
      remainingBalance -= paymentAmount;
    }
    
    return schedule;
  },

  /**
   * Calculate due date for installment
   */
  calculateDueDate(installment) {
    if (!this.disbursementDate) return null;
    
    const dueDate = new Date(this.disbursementDate);
    
    switch (this.repaymentPlan) {
      case 'weekly':
        dueDate.setDate(dueDate.getDate() + (installment * 7));
        break;
      case 'biweekly':
        dueDate.setDate(dueDate.getDate() + (installment * 14));
        break;
      case 'monthly':
        dueDate.setMonth(dueDate.getMonth() + installment);
        break;
      case 'quarterly':
        dueDate.setMonth(dueDate.getMonth() + (installment * 3));
        break;
      case 'annually':
        dueDate.setFullYear(dueDate.getFullYear() + installment);
        break;
    }
    
    return dueDate;
  },
};

// Static methods
loanSchema.statics = {
  /**
   * Get overdue loans
   */
  async getOverdueLoans() {
    const now = new Date();
    return this.find({
      status: 'active',
      dueDate: { $lt: now },
    });
  },

  /**
   * Get loans due soon (within next 7 days)
   */
  async getLoansDueSoon() {
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    return this.find({
      status: 'active',
      dueDate: { $gte: now, $lte: weekFromNow },
    });
  },

  /**
   * Get predefined loan tiers based on category
   */
  getLoanTiers() {
    return {
      emergency: {
        name: 'Emergency Support Loans',
        maxAmount: 500000, // N500,000
        minAmount: 10000,  // N10,000
        interestRateRange: { min: 0, max: 2 },
        repaymentPeriod: { min: 3, max: 6 }, // 3-6 months
        eligibilityMonths: 0, // Open to all registered members
        monthlyContributionOptions: [3000, 5000, 10000],
        features: [
          'Quick approval within 48 hours',
          'No Collateral required',
          'Immediate financial aid for urgent business needs'
        ]
      },
      growth: {
        name: 'Growth Loans',
        maxAmount: 5000000, // N5M
        minAmount: 1000000, // N1M
        interestRateRange: { min: 2, max: 4 },
        repaymentPeriod: { min: 6, max: 24 }, // 6 months - 2 years
        eligibilityMonths: 6, // 6+ months membership
        monthlyContributionOptions: [20000, 30000, 50000],
        features: [
          'Business mentorship included',
          'Access to training workshops',
          'Quarterly business reviews',
          'Marketplace priority listing'
        ]
      },
      'large-scale': {
        name: 'Large-Scale Investment Loans',
        maxAmount: 15000000, // N15M
        minAmount: 5000000,  // N5M
        interestRateRange: { min: 3, max: 5 },
        repaymentPeriod: { min: 36, max: 60 }, // 3-5 years
        eligibilityMonths: 24, // 2+ years membership
        monthlyContributionOptions: [100000, 150000, 250000],
        features: [
          'Dedicated business adviser',
          'Investment planning support',
          'Market expansion guidance and support',
          'Premium Marketplace support'
        ]
      }
    };
  },

  /**
   * Get loan tier by category
   */
  getLoanTierByCategory(category) {
    const tiers = this.getLoanTiers();
    return tiers[category] || null;
  },

  /**
   * Validate loan application against tier requirements
   */
  async validateLoanApplication(userId, loanCategory, amount, membershipMonths) {
    const tier = this.getLoanTierByCategory(loanCategory);
    if (!tier) {
      throw new Error('Invalid loan category');
    }

    // Check amount limits
    if (amount < tier.minAmount || amount > tier.maxAmount) {
      throw new Error(`Loan amount must be between N${tier.minAmount.toLocaleString()} and N${tier.maxAmount.toLocaleString()}`);
    }

    // Check membership eligibility
    if (membershipMonths < tier.eligibilityMonths) {
      throw new Error(`Requires ${tier.eligibilityMonths} months of cooperative membership`);
    }

    return true;
  },

  /**
   * Get loan statistics for a cooperative
   */
  async getCooperativeStats(cooperativeId) {
    const loans = await this.find({ cooperativeId });
    
    const stats = {
      totalLoans: loans.length,
      totalAmount: 0,
      totalOutstanding: 0,
      activeLoans: 0,
      overdueLoans: 0,
      statusBreakdown: {},
      typeBreakdown: {},
    };
    
    loans.forEach(loan => {
      stats.totalAmount += loan.amount;
      stats.totalOutstanding += loan.remainingBalance;
      
      // Count by status
      stats.statusBreakdown[loan.status] = (stats.statusBreakdown[loan.status] || 0) + 1;
      
      // Count by type
      stats.typeBreakdown[loan.type] = (stats.typeBreakdown[loan.type] || 0) + 1;
      
      // Count active and overdue loans
      if (loan.isActive()) {
        stats.activeLoans++;
        if (loan.isOverdue()) {
          stats.overdueLoans++;
        }
      }
    });
    
    return stats;
  },
};

const Loan = mongoose.model('Loan', loanSchema);

module.exports = Loan;
