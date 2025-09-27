const mongoose = require('mongoose');

const membershipPlanTemplateSchema = new mongoose.Schema({
  cooperativeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cooperative',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    enum: ['basic', 'premium', 'enterprise'],
    required: true,
  },
  pricing: {
    monthlyFee: {
      type: Number,
      required: true,
      min: 0,
    },
    setupFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: 'NGN',
    },
  },
  loanAccess: {
    enabled: {
      type: Boolean,
      default: true,
    },
    maxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    minAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    interestRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    repaymentTerms: {
      minMonths: {
        type: Number,
        default: 1,
        min: 1,
      },
      maxMonths: {
        type: Number,
        default: 12,
        min: 1,
      },
    },
  },
  features: [{
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    included: {
      type: Boolean,
      default: true,
    },
  }],
  eligibility: {
    minimumMembershipMonths: {
      type: Number,
      default: 0,
    },
    minimumContribution: {
      type: Number,
      default: 0,
    },
    creditScoreRequired: {
      type: Number,
      min: 0,
      max: 850,
      default: 0,
    },
    requiresGuarantor: {
      type: Boolean,
      default: false,
    },
    requiresCollateral: {
      type: Boolean,
      default: false,
    },
  },
  benefits: {
    supportLevel: {
      type: String,
      enum: ['basic', 'priority', 'premium', 'white-glove'],
      default: 'basic',
    },
    financialAdvisory: {
      type: Boolean,
      default: false,
    },
    personalFinancialAdvisor: {
      type: Boolean,
      default: false,
    },
    businessMentorship: {
      type: Boolean,
      default: false,
    },
    marketplaceBoost: {
      type: Boolean,
      default: false,
    },
    networkingEvents: {
      type: Boolean,
      default: false,
    },
    investmentOpportunities: {
      type: Boolean,
      default: false,
    },
    customFinancialSolutions: {
      type: Boolean,
      default: false,
    },
    exclusiveContent: {
      type: Boolean,
      default: false,
    },
    prioritySupport: {
      type: Boolean,
      default: false,
    },
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isPopular: {
    type: Boolean,
    default: false,
  },
  displayOrder: {
    type: Number,
    default: 0,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
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
membershipPlanTemplateSchema.index({ cooperativeId: 1, isActive: 1 });
membershipPlanTemplateSchema.index({ category: 1, isActive: 1 });
membershipPlanTemplateSchema.index({ displayOrder: 1 });

// Update timestamp on save
membershipPlanTemplateSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Instance methods
membershipPlanTemplateSchema.methods = {
  /**
   * Get plan summary
   */
  getSummary() {
    return {
      id: this._id,
      name: this.name,
      description: this.description,
      category: this.category,
      monthlyFee: this.pricing.monthlyFee,
      currency: this.pricing.currency,
      loanAccess: this.loanAccess.enabled,
      maxLoanAmount: this.loanAccess.maxAmount,
      interestRate: this.loanAccess.interestRate,
      repaymentTerms: this.loanAccess.enabled ? `${this.loanAccess.repaymentTerms.minMonths}-${this.loanAccess.repaymentTerms.maxMonths} months` : 'N/A',
      isPopular: this.isPopular,
      features: this.features.filter(f => f.included).map(f => f.name),
    };
  },

  /**
   * Check if user is eligible for this plan
   */
  async checkEligibility(userId, membershipMonths = 0, totalContributions = 0) {
    // Check minimum membership months
    if (membershipMonths < this.eligibility.minimumMembershipMonths) {
      return {
        eligible: false,
        reason: `Requires ${this.eligibility.minimumMembershipMonths} months of membership`,
      };
    }

    // Check minimum contribution
    if (totalContributions < this.eligibility.minimumContribution) {
      return {
        eligible: false,
        reason: `Requires minimum contribution of ${this.pricing.currency} ${this.eligibility.minimumContribution.toLocaleString()}`,
      };
    }

    return { eligible: true };
  },

  /**
   * Calculate loan terms for amount (if loan access is enabled)
   */
  calculateLoanTerms(amount) {
    if (!this.loanAccess.enabled) {
      throw new Error('Loan access is not included in this membership plan');
    }

    if (amount < this.loanAccess.minAmount || amount > this.loanAccess.maxAmount) {
      throw new Error(`Loan amount must be between ${this.pricing.currency} ${this.loanAccess.minAmount.toLocaleString()} and ${this.pricing.currency} ${this.loanAccess.maxAmount.toLocaleString()}`);
    }

    const monthlyInterestRate = this.loanAccess.interestRate / 100 / 12;
    const terms = [];

    for (let months = this.loanAccess.repaymentTerms.minMonths; months <= this.loanAccess.repaymentTerms.maxMonths; months += 6) {
      const monthlyPayment = amount * (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, months)) / (Math.pow(1 + monthlyInterestRate, months) - 1);
      const totalPayment = monthlyPayment * months;
      const totalInterest = totalPayment - amount;

      terms.push({
        months,
        monthlyPayment: Math.round(monthlyPayment),
        totalPayment: Math.round(totalPayment),
        totalInterest: Math.round(totalInterest),
      });
    }

    return terms;
  },
};

// Static methods
membershipPlanTemplateSchema.statics = {
  /**
   * Get active plans for cooperative
   */
  async getActivePlans(cooperativeId) {
    return this.find({
      cooperativeId,
      isActive: true,
    }).sort({ displayOrder: 1, createdAt: 1 });
  },

  /**
   * Get plan by category
   */
  async getPlanByCategory(cooperativeId, category) {
    return this.findOne({
      cooperativeId,
      category,
      isActive: true,
    });
  },
};

const MembershipPlanTemplate = mongoose.model('MembershipPlanTemplate', membershipPlanTemplateSchema);

module.exports = MembershipPlanTemplate;