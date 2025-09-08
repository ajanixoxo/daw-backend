const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, ROLE_PERMISSIONS } = require('../config/roles');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  phone: {
    type: String,
    trim: true,
  },
  role: {
    type: String,
    enum: Object.values(ROLES),
    default: ROLES.BUYER,
  },
  permissions: [{
    type: String,
  }],
  cooperativeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cooperative',
  },
  dawId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
  },
  walletBalance: {
    type: Number,
    default: 0,
    min: 0,
  },
  profilePicture: {
    type: String,
    default: '',
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active',
  },
  userTier: {
    type: String,
    enum: ['freemium', 'premium', 'cooperative'],
    default: 'freemium',
  },
  tierFeatures: {
    maxProducts: {
      type: Number,
      default: function() {
        switch(this.userTier) {
          case 'freemium': return 5;
          case 'premium': return 100;
          case 'cooperative': return -1; // unlimited
          default: return 5;
        }
      }
    },
    hasLoanAccess: {
      type: Boolean,
      default: function() {
        return this.userTier === 'premium' || this.userTier === 'cooperative';
      }
    },
    hasAnalytics: {
      type: Boolean,
      default: function() {
        return this.userTier === 'premium' || this.userTier === 'cooperative';
      }
    },
    hasBranding: {
      type: Boolean,
      default: function() {
        return this.userTier === 'premium' || this.userTier === 'cooperative';
      }
    },
    priorityHandling: {
      type: Boolean,
      default: function() {
        return this.userTier === 'premium' || this.userTier === 'cooperative';
      }
    },
    marketplaceDiscount: {
      type: Number,
      default: function() {
        switch(this.userTier) {
          case 'cooperative': return 10; // 10% discount
          case 'premium': return 5; // 5% discount
          default: return 0;
        }
      }
    }
  },
  membershipUpgradeDate: {
    type: Date,
  },
  lastLogin: {
    type: Date,
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

// Update timestamp on save
userSchema.pre('save', async function(next) {
  this.updatedAt = Date.now();
  
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Set permissions based on role
userSchema.pre('save', function(next) {
  if (this.isModified('role')) {
    this.permissions = ROLE_PERMISSIONS[this.role] || [];
  }
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to check if user has permission
userSchema.methods.hasPermission = function(permission) {
  return this.permissions.includes(permission);
};

// Method to check if user has any of the given permissions
userSchema.methods.hasAnyPermission = function(permissions) {
  return permissions.some(permission => this.permissions.includes(permission));
};

// Method to check if user has all of the given permissions
userSchema.methods.hasAllPermissions = function(permissions) {
  return permissions.every(permission => this.permissions.includes(permission));
};

// Method to check if user is active
userSchema.methods.isActive = function() {
  return this.status === 'active';
};

// Method to upgrade user tier
userSchema.methods.upgradeTier = function(newTier) {
  if (['freemium', 'premium', 'cooperative'].includes(newTier)) {
    this.userTier = newTier;
    this.membershipUpgradeDate = new Date();
    this.updateTierFeatures();
  }
};

// Method to update tier features based on current tier
userSchema.methods.updateTierFeatures = function() {
  switch(this.userTier) {
    case 'freemium':
      this.tierFeatures = {
        maxProducts: 5,
        hasLoanAccess: false,
        hasAnalytics: false,
        hasBranding: false,
        priorityHandling: false,
        marketplaceDiscount: 0
      };
      break;
    case 'premium':
      this.tierFeatures = {
        maxProducts: 100,
        hasLoanAccess: true,
        hasAnalytics: true,
        hasBranding: true,
        priorityHandling: true,
        marketplaceDiscount: 5
      };
      break;
    case 'cooperative':
      this.tierFeatures = {
        maxProducts: -1, // unlimited
        hasLoanAccess: true,
        hasAnalytics: true,
        hasBranding: true,
        priorityHandling: true,
        marketplaceDiscount: 10
      };
      break;
  }
};

// Method to check if user can add more products
userSchema.methods.canAddProduct = function(currentProductCount) {
  return this.tierFeatures.maxProducts === -1 || currentProductCount < this.tierFeatures.maxProducts;
};

// Auto-update tier when joining cooperative
userSchema.pre('save', function(next) {
  if (this.isModified('cooperativeId') && this.cooperativeId) {
    this.userTier = 'cooperative';
    this.updateTierFeatures();
  }
  next();
});

const User = mongoose.model('User', userSchema);

module.exports = User; 