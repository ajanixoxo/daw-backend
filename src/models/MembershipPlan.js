const mongoose = require('mongoose');

const membershipPlanSchema = new mongoose.Schema({
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
  membershipPlanTemplateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MembershipPlanTemplate',
    required: true,
  },
  planDetails: {
    name: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    monthlyFee: {
      type: Number,
      required: true,
    },
    loanAccess: {
      enabled: {
        type: Boolean,
        default: false,
      },
      maxAmount: {
        type: Number,
        default: 0,
      },
      interestRate: {
        type: Number,
        default: 0,
      },
      repaymentTerms: {
        minMonths: Number,
        maxMonths: Number,
      },
    },
    benefits: {
      supportLevel: String,
      financialAdvisory: Boolean,
      personalFinancialAdvisor: Boolean,
      businessMentorship: Boolean,
      marketplaceBoost: Boolean,
      networkingEvents: Boolean,
      investmentOpportunities: Boolean,
      customFinancialSolutions: Boolean,
      exclusiveContent: Boolean,
      prioritySupport: Boolean,
    },
    features: [{
      name: String,
      description: String,
    }],
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'cancelled', 'expired'],
    default: 'active',
  },
  paymentStatus: {
    type: String,
    enum: ['current', 'overdue', 'failed'],
    default: 'current',
  },
  billing: {
    startDate: {
      type: Date,
      required: true,
    },
    nextBillingDate: {
      type: Date,
      required: true,
    },
    lastPaymentDate: {
      type: Date,
    },
    totalPaid: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: 'NGN',
    },
  },
  payments: [{
    amount: {
      type: Number,
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      enum: ['card', 'bank_transfer', 'mobile_money', 'wallet'],
    },
    transactionId: {
      type: String,
    },
    reference: {
      type: String,
    },
  }],
  loanUsage: {
    totalLoansApplied: {
      type: Number,
      default: 0,
    },
    totalLoansApproved: {
      type: Number,
      default: 0,
    },
    totalAmountBorrowed: {
      type: Number,
      default: 0,
    },
    currentActiveLoans: {
      type: Number,
      default: 0,
    },
    lastLoanDate: {
      type: Date,
    },
  },
  benefits: {
    financialAdvisoryUsed: {
      type: Number,
      default: 0,
    },
    mentorshipSessionsUsed: {
      type: Number,
      default: 0,
    },
    marketplaceBoostsUsed: {
      type: Number,
      default: 0,
    },
  },
  autoRenewal: {
    enabled: {
      type: Boolean,
      default: true,
    },
    paymentMethodId: {
      type: String,
    },
  },
  cancellation: {
    cancelledAt: {
      type: Date,
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reason: {
      type: String,
    },
    refundAmount: {
      type: Number,
      default: 0,
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
membershipPlanSchema.index({ userId: 1, cooperativeId: 1 }, { unique: true });
membershipPlanSchema.index({ status: 1, paymentStatus: 1 });
membershipPlanSchema.index({ 'billing.nextBillingDate': 1 });
membershipPlanSchema.index({ cooperativeId: 1, status: 1 });

// Update timestamp on save
membershipPlanSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Instance methods
membershipPlanSchema.methods = {
  /**
   * Check if plan is active and current
   */
  isActive() {
    return this.status === 'active' && this.paymentStatus === 'current';
  },

  /**
   * Check if plan is overdue
   */
  isOverdue() {
    return this.paymentStatus === 'overdue' || 
           (this.billing.nextBillingDate && new Date() > this.billing.nextBillingDate);
  },

  /**
   * Get plan summary
   */
  getSummary() {
    return {
      id: this._id,
      planName: this.planDetails.name,
      category: this.planDetails.category,
      monthlyFee: this.planDetails.monthlyFee,
      loanAccess: this.planDetails.loanAccess,
      benefits: this.planDetails.benefits,
      status: this.status,
      paymentStatus: this.paymentStatus,
      nextBillingDate: this.billing.nextBillingDate,
      totalPaid: this.billing.totalPaid,
      loanUsage: this.loanUsage,
    };
  },

  /**
   * Calculate next billing date
   */
  calculateNextBillingDate() {
    const nextDate = new Date(this.billing.nextBillingDate);
    nextDate.setMonth(nextDate.getMonth() + 1);
    return nextDate;
  },

  /**
   * Process payment
   */
  async processPayment(amount, paymentMethod, transactionId, reference) {
    const payment = {
      amount,
      date: new Date(),
      status: 'completed',
      paymentMethod,
      transactionId,
      reference,
    };

    this.payments.push(payment);
    this.billing.lastPaymentDate = new Date();
    this.billing.totalPaid += amount;
    this.billing.nextBillingDate = this.calculateNextBillingDate();
    this.paymentStatus = 'current';

    await this.save();
    return payment;
  },

  /**
   * Check loan eligibility
   */
  canApplyForLoan(amount) {
    if (!this.isActive()) {
      return {
        eligible: false,
        reason: 'Membership plan is not active',
      };
    }

    if (!this.planDetails.loanAccess.enabled) {
      return {
        eligible: false,
        reason: 'Loan access is not included in your membership plan',
      };
    }

    if (amount > this.planDetails.loanAccess.maxAmount) {
      return {
        eligible: false,
        reason: `Loan amount exceeds plan limit of ${this.billing.currency} ${this.planDetails.loanAccess.maxAmount.toLocaleString()}`,
      };
    }

    if (this.loanUsage.currentActiveLoans > 0) {
      return {
        eligible: false,
        reason: 'You already have an active loan',
      };
    }

    return { eligible: true };
  },

  /**
   * Update loan usage
   */
  async updateLoanUsage(loanAmount, approved = false) {
    this.loanUsage.totalLoansApplied += 1;
    this.loanUsage.lastLoanDate = new Date();

    if (approved) {
      this.loanUsage.totalLoansApproved += 1;
      this.loanUsage.totalAmountBorrowed += loanAmount;
      this.loanUsage.currentActiveLoans += 1;
    }

    await this.save();
  },
};

// Static methods
membershipPlanSchema.statics = {
  /**
   * Get active membership for user in cooperative
   */
  async getActiveMembership(userId, cooperativeId) {
    return this.findOne({
      userId,
      cooperativeId,
      status: 'active',
    }).populate('loanPlanId');
  },

  /**
   * Get overdue memberships
   */
  async getOverdueMemberships() {
    const now = new Date();
    return this.find({
      status: 'active',
      'billing.nextBillingDate': { $lt: now },
      paymentStatus: { $ne: 'overdue' },
    });
  },

  /**
   * Get memberships due for renewal
   */
  async getMembershipsDueForRenewal(daysAhead = 3) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    
    return this.find({
      status: 'active',
      'billing.nextBillingDate': { $lte: futureDate },
      'autoRenewal.enabled': true,
    });
  },
};

const MembershipPlan = mongoose.model('MembershipPlan', membershipPlanSchema);

module.exports = MembershipPlan;