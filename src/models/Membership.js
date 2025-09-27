const mongoose = require('mongoose');

const membershipSchema = new mongoose.Schema({
  membershipPlanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MembershipPlan',
    required: true,
  },
  cooperativeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cooperative',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  roleInCoop: {
    type: String,
    enum: ['member', 'admin', 'moderator', 'treasurer', 'secretary'],
    default: 'member',
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'suspended', 'terminated'],
    default: 'pending',
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
  approvedAt: {
    type: Date,
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  terminatedAt: {
    type: Date,
  },
  terminatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  terminationReason: {
    type: String,
    trim: true,
  },
  membershipNumber: {
    type: String,
    unique: true,
    sparse: true,
  },
  fees: {
    membershipFee: {
      type: Number,
      default: 0,
    },
    annualFee: {
      type: Number,
      default: 0,
    },
    lastPaid: {
      type: Date,
    },
    nextDue: {
      type: Date,
    },
    isUpToDate: {
      type: Boolean,
      default: true,
    },
  },
  contributions: {
    totalContributed: {
      type: Number,
      default: 0,
    },
    lastContribution: {
      type: Date,
    },
    contributionFrequency: {
      type: String,
      enum: ['monthly', 'quarterly', 'annually', 'custom'],
      default: 'monthly',
    },
  },
  loans: {
    totalBorrowed: {
      type: Number,
      default: 0,
    },
    activeLoans: {
      type: Number,
      default: 0,
    },
    loanEligibility: {
      type: Boolean,
      default: true,
    },
    lastLoanDate: {
      type: Date,
    },
  },
  benefits: {
    discountPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    accessToTraining: {
      type: Boolean,
      default: true,
    },
    accessToMentorship: {
      type: Boolean,
      default: true,
    },
    prioritySupport: {
      type: Boolean,
      default: false,
    },
  },
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
membershipSchema.index({ cooperativeId: 1, userId: 1 }, { unique: true });
membershipSchema.index({ userId: 1, status: 1 });
membershipSchema.index({ cooperativeId: 1, status: 1 });
membershipSchema.index({ membershipNumber: 1 });

// Update timestamp on save
membershipSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Generate membership number before save
membershipSchema.pre('save', async function(next) {
  if (this.isNew && !this.membershipNumber) {
    const cooperative = await mongoose.model('Cooperative').findById(this.cooperativeId);
    if (cooperative) {
      const count = await this.constructor.countDocuments({ cooperativeId: this.cooperativeId });
      this.membershipNumber = `${cooperative.name.substring(0, 3).toUpperCase()}-${String(count + 1).padStart(4, '0')}`;
    }
  }
  next();
});

// Instance methods
membershipSchema.methods = {
  /**
   * Check if membership is active
   */
  isActive() {
    return this.status === 'active';
  },

  /**
   * Check if user can access cooperative benefits
   */
  canAccessBenefits() {
    return this.isActive() && this.fees.isUpToDate;
  },

  /**
   * Check if user is eligible for loans
   */
  isLoanEligible() {
    return this.isActive() && this.loans.loanEligibility && this.fees.isUpToDate;
  },

  /**
   * Get membership summary
   */
  getSummary() {
    return {
      role: this.roleInCoop,
      status: this.status,
      joinedAt: this.joinedAt,
      membershipNumber: this.membershipNumber,
      totalContributed: this.contributions.totalContributed,
      totalBorrowed: this.loans.totalBorrowed,
      discountPercentage: this.benefits.discountPercentage,
    };
  },
};

const Membership = mongoose.model('Membership', membershipSchema);

module.exports = Membership;

