const mongoose = require('mongoose');

const cooperativeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    // Note: Removed unique constraint to allow multiple cooperatives with similar names
    // If you need uniqueness, consider making it unique within a region/city
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'pending', 'suspended', 'inactive'],
    default: 'pending',
  },
  verificationStatus: {
    type: String,
    enum: ['verified', 'unverified', 'pending', 'rejected'],
    default: 'unverified',
  },
  imageUrl: {
    type: String,
    trim: true,
    default: '',
  },
  images: {
    logo: {
      type: String,
      trim: true,
      default: '',
    },
    banner: {
      type: String,
      trim: true,
      default: '',
    },
    gallery: [{
      url: {
        type: String,
        required: true,
      },
      alt: {
        type: String,
        trim: true,
      },
      caption: {
        type: String,
        trim: true,
      },
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
    }],
  },
  contactInfo: {
    phone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    website: {
      type: String,
      trim: true,
    },
  },
  location: {
    address: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
    },
    postalCode: {
      type: String,
      trim: true,
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere',
    },
  },
  membership: {
    totalMembers: {
      type: Number,
      default: 0,
    },
    activeMembers: {
      type: Number,
      default: 0,
    },
    pendingMembers: {
      type: Number,
      default: 0,
    },
    membershipFee: {
      type: Number,
      default: 0,
    },
    maxMembers: {
      type: Number,
      default: null, // null means no limit
    },
  },
  financial: {
    totalLoans: {
      type: Number,
      default: 0,
    },
    totalContributions: {
      type: Number,
      default: 0,
    },
    totalRevenue: {
      type: Number,
      default: 0,
    },
    outstandingLoans: {
      type: Number,
      default: 0,
    },
  },
  verificationDocuments: [{
    type: {
      type: String,
      enum: ['registration', 'tax_id', 'bank_statement', 'identity', 'address_proof', 'other'],
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    verifiedAt: {
      type: Date,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
  }],
  settings: {
    allowPublicJoining: {
      type: Boolean,
      default: true,
    },
    requireApprovalForJoining: {
      type: Boolean,
      default: false, // Changed to false - no approval required by default
    },
    allowMemberInvitations: {
      type: Boolean,
      default: true,
    },
    defaultMemberRole: {
      type: String,
      enum: ['member', 'moderator'],
      default: 'member',
    },
    autoUpgradeTier: {
      type: Boolean,
      default: true, // Automatically upgrade members to cooperative tier
    },
  },
  stats: {
    totalProducts: {
      type: Number,
      default: 0,
    },
    totalStores: {
      type: Number,
      default: 0,
    },
    totalOrders: {
      type: Number,
      default: 0,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
  },
  foundedYear: {
    type: Number,
    min: 1900,
    max: new Date().getFullYear(),
  },
  registrationNumber: {
    type: String,
    trim: true,
    sparse: true, // Allow multiple null values but enforce uniqueness for non-null values
    unique: true,
  },
  bankDetails: {
    bankName: {
      type: String,
      trim: true,
    },
    accountNumber: {
      type: String,
      trim: true,
    },
    accountName: {
      type: String,
      trim: true,
    },
    routingNumber: {
      type: String,
      trim: true,
    },
  },
  approvedAt: {
    type: Date,
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  approvalReason: {
    type: String,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
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
cooperativeSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes for better query performance
cooperativeSchema.index({ name: 1 }); // Note: NOT unique to allow similar names
cooperativeSchema.index({ adminId: 1 });
cooperativeSchema.index({ status: 1 });
cooperativeSchema.index({ verificationStatus: 1 });
cooperativeSchema.index({ 'location.city': 1 });
cooperativeSchema.index({ 'location.state': 1 });
cooperativeSchema.index({ 'location.country': 1 });
cooperativeSchema.index({ createdAt: -1 });

// Text search index
cooperativeSchema.index({
  name: 'text',
  description: 'text',
  'location.city': 'text',
  'location.state': 'text'
});

// Instance methods
cooperativeSchema.methods.getSummary = function() {
  return {
    _id: this._id,
    name: this.name,
    description: this.description,
    adminId: this.adminId,
    status: this.status,
    verificationStatus: this.verificationStatus,
    location: this.location,
    contactInfo: this.contactInfo,
    membership: this.membership,
    stats: this.stats,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

cooperativeSchema.methods.getStats = function() {
  return {
    totalMembers: this.membership.totalMembers,
    activeMembers: this.membership.activeMembers,
    pendingMembers: this.membership.pendingMembers,
    totalProducts: this.stats.totalProducts,
    totalStores: this.stats.totalStores,
    totalOrders: this.stats.totalOrders,
    averageRating: this.stats.averageRating,
    totalReviews: this.stats.totalReviews,
    totalLoans: this.financial.totalLoans,
    totalContributions: this.financial.totalContributions,
    totalRevenue: this.financial.totalRevenue,
    outstandingLoans: this.financial.outstandingLoans,
  };
};

cooperativeSchema.methods.isVerified = function() {
  return this.verificationStatus === 'verified';
};

cooperativeSchema.methods.isActiveAndVerified = function() {
  return this.status === 'active' && this.verificationStatus === 'verified';
};

cooperativeSchema.methods.canAcceptMembers = function() {
  return this.isActive && 
         this.status === 'active' && 
         (this.membership.maxMembers === null || 
          this.membership.activeMembers < this.membership.maxMembers);
};

// Static methods
cooperativeSchema.statics.findByLocation = function(city, state, country) {
  const query = {};
  if (city) query['location.city'] = new RegExp(city, 'i');
  if (state) query['location.state'] = new RegExp(state, 'i');
  if (country) query['location.country'] = new RegExp(country, 'i');
  
  return this.find(query);
};

cooperativeSchema.statics.searchByName = function(searchTerm) {
  return this.find({
    $text: { $search: searchTerm }
  }).sort({ score: { $meta: 'textScore' } });
};

const Cooperative = mongoose.model('Cooperative', cooperativeSchema);

module.exports = Cooperative;
