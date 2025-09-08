const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
  },
  cooperativeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cooperative',
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  comment: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000,
  },
  title: {
    type: String,
    trim: true,
    maxlength: 100,
  },
  type: {
    type: String,
    enum: ['product', 'store', 'cooperative'],
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'hidden'],
    default: 'pending',
  },
  helpful: {
    count: {
      type: Number,
      default: 0,
      min: 0,
    },
    users: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
  },
  images: [{
    url: {
      type: String,
      required: true,
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
  tags: [{
    type: String,
    trim: true,
  }],
  verification: {
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedAt: Date,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    purchaseVerified: {
      type: Boolean,
      default: false,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
  },
  moderation: {
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    moderatedAt: Date,
    moderationNotes: {
      type: String,
      trim: true,
    },
    flags: [{
      reason: {
        type: String,
        enum: ['inappropriate', 'spam', 'fake', 'offensive', 'other'],
        required: true,
      },
      reportedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      reportedAt: {
        type: Date,
        default: Date.now,
      },
      status: {
        type: String,
        enum: ['pending', 'reviewed', 'resolved'],
        default: 'pending',
      },
    }],
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    deviceType: String,
    browser: String,
    os: String,
    location: {
      city: String,
      country: String,
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
reviewSchema.index({ buyerId: 1, createdAt: -1 });
reviewSchema.index({ productId: 1, createdAt: -1 });
reviewSchema.index({ storeId: 1, createdAt: -1 });
reviewSchema.index({ cooperativeId: 1, createdAt: -1 });
reviewSchema.index({ type: 1, status: 1 });
reviewSchema.index({ rating: 1, createdAt: -1 });
reviewSchema.index({ status: 1, createdAt: -1 });
reviewSchema.index({ 'helpful.count': -1, createdAt: -1 });

// Compound indexes for unique constraints
reviewSchema.index({ buyerId: 1, productId: 1 }, { unique: true, sparse: true });
reviewSchema.index({ buyerId: 1, storeId: 1 }, { unique: true, sparse: true });
reviewSchema.index({ buyerId: 1, cooperativeId: 1 }, { unique: true, sparse: true });

// Update timestamp on save
reviewSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Determine review type based on what's being reviewed
  if (this.productId) {
    this.type = 'product';
  } else if (this.storeId) {
    this.type = 'store';
  } else if (this.cooperativeId) {
    this.type = 'cooperative';
  }
  
  next();
});

// Instance methods
reviewSchema.methods = {
  /**
   * Check if review is approved and visible
   */
  isVisible() {
    return this.status === 'approved';
  },

  /**
   * Check if review is pending moderation
   */
  isPendingModeration() {
    return this.status === 'pending';
  },

  /**
   * Check if review has been flagged
   */
  hasFlags() {
    return this.moderation.flags.length > 0;
  },

  /**
   * Get review summary
   */
  getSummary() {
    return {
      id: this._id,
      type: this.type,
      rating: this.rating,
      title: this.title,
      comment: this.comment,
      status: this.status,
      helpfulCount: this.helpful.count,
      isVerified: this.verification.isVerified,
      createdAt: this.createdAt,
    };
  },

  /**
   * Mark review as helpful by user
   */
  markHelpful(userId) {
    if (!this.helpful.users.includes(userId)) {
      this.helpful.users.push(userId);
      this.helpful.count = this.helpful.users.length;
    }
    return this.save();
  },

  /**
   * Remove helpful mark by user
   */
  removeHelpful(userId) {
    const index = this.helpful.users.indexOf(userId);
    if (index > -1) {
      this.helpful.users.splice(index, 1);
      this.helpful.count = this.helpful.users.length;
    }
    return this.save();
  },

  /**
   * Flag review
   */
  flagReview(reason, reportedBy) {
    this.moderation.flags.push({
      reason,
      reportedBy,
      reportedAt: new Date(),
      status: 'pending',
    });
    return this.save();
  },

  /**
   * Get average rating for the reviewed entity
   */
  async getAverageRating() {
    const Review = mongoose.model('Review');
    let query = {};
    
    if (this.productId) {
      query = { productId: this.productId, status: 'approved' };
    } else if (this.storeId) {
      query = { storeId: this.storeId, status: 'approved' };
    } else if (this.cooperativeId) {
      query = { cooperativeId: this.cooperativeId, status: 'approved' };
    }
    
    const reviews = await Review.find(query);
    if (reviews.length === 0) return 0;
    
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    return totalRating / reviews.length;
  },
};

// Static methods
reviewSchema.statics = {
  /**
   * Get reviews for a specific entity
   */
  async getEntityReviews(entityType, entityId, options = {}) {
    const query = { status: 'approved' };
    const sort = { createdAt: -1 };
    
    switch (entityType) {
      case 'product':
        query.productId = entityId;
        break;
      case 'store':
        query.storeId = entityId;
        break;
      case 'cooperative':
        query.cooperativeId = entityId;
        break;
      default:
        throw new Error('Invalid entity type');
    }
    
    // Apply filters
    if (options.rating) {
      query.rating = options.rating;
    }
    
    if (options.verified) {
      query['verification.isVerified'] = options.verified;
    }
    
    // Apply sorting
    if (options.sortBy === 'helpful') {
      sort['helpful.count'] = -1;
      sort.createdAt = -1;
    } else if (options.sortBy === 'rating') {
      sort.rating = -1;
      sort.createdAt = -1;
    }
    
    const limit = options.limit || 20;
    const skip = options.skip || 0;
    
    return this.find(query)
      .sort(sort)
      .limit(limit)
      .skip(skip)
      .populate('buyerId', 'name profilePicture');
  },

  /**
   * Get review statistics for an entity
   */
  async getEntityStats(entityType, entityId) {
    const query = { status: 'approved' };
    
    switch (entityType) {
      case 'product':
        query.productId = entityId;
        break;
      case 'store':
        query.storeId = entityId;
        break;
      case 'cooperative':
        query.cooperativeId = entityId;
        break;
      default:
        throw new Error('Invalid entity type');
    }
    
    const reviews = await this.find(query);
    
    const stats = {
      totalReviews: reviews.length,
      averageRating: 0,
      ratingDistribution: {
        5: 0, 4: 0, 3: 0, 2: 0, 1: 0
      },
      verifiedReviews: 0,
      totalHelpful: 0,
    };
    
    if (reviews.length > 0) {
      reviews.forEach(review => {
        stats.averageRating += review.rating;
        stats.ratingDistribution[review.rating]++;
        stats.totalHelpful += review.helpful.count;
        
        if (review.verification.isVerified) {
          stats.verifiedReviews++;
        }
      });
      
      stats.averageRating = stats.averageRating / reviews.length;
    }
    
    return stats;
  },

  /**
   * Get pending reviews for moderation
   */
  async getPendingReviews(options = {}) {
    const query = { status: 'pending' };
    
    if (options.type) {
      query.type = options.type;
    }
    
    const sort = { createdAt: 1 };
    const limit = options.limit || 50;
    const skip = options.skip || 0;
    
    return this.find(query)
      .sort(sort)
      .limit(limit)
      .skip(skip)
      .populate('buyerId', 'name email')
      .populate('productId', 'title')
      .populate('storeId', 'name')
      .populate('cooperativeId', 'name');
  },
};

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;

