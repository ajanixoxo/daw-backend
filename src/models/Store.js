const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  cooperativeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cooperative',
    required: false,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  imageUrl: {
    type: String,
    trim: true,
    default: '',
  },
  branding: {
    logo: {
      type: String,
      default: '',
    },
    banner: {
      type: String,
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
    primaryColor: {
      type: String,
      default: '#007bff',
    },
    secondaryColor: {
      type: String,
      default: '#6c757d',
    },
    tagline: {
      type: String,
      trim: true,
    },
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'pending_approval'],
    default: 'pending_approval',
  },
  contactInfo: {
    phone: String,
    email: String,
    address: String,
    website: String,
  },
  location: {
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere',
    },
    address: String,
    city: String,
    state: String,
    country: String,
    postalCode: String,
  },
  businessHours: {
    monday: { open: String, close: String, closed: { type: Boolean, default: false } },
    tuesday: { open: String, close: String, closed: { type: Boolean, default: false } },
    wednesday: { open: String, close: String, closed: { type: Boolean, default: false } },
    thursday: { open: String, close: String, closed: { type: Boolean, default: false } },
    friday: { open: String, close: String, closed: { type: Boolean, default: false } },
    saturday: { open: String, close: String, closed: { type: Boolean, default: false } },
    sunday: { open: String, close: String, closed: { type: Boolean, default: false } },
  },
  categories: [{
    type: String,
    trim: true,
  }],
  policies: {
    returnPolicy: {
      type: String,
      trim: true,
    },
    shippingPolicy: {
      type: String,
      trim: true,
    },
    refundPolicy: {
      type: String,
      trim: true,
    },
    warrantyPolicy: {
      type: String,
      trim: true,
    },
  },
  ratings: {
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
    ratingDistribution: {
      fiveStar: { type: Number, default: 0 },
      fourStar: { type: Number, default: 0 },
      threeStar: { type: Number, default: 0 },
      twoStar: { type: Number, default: 0 },
      oneStar: { type: Number, default: 0 },
    },
  },
  statistics: {
    totalProducts: {
      type: Number,
      default: 0,
    },
    totalSales: {
      type: Number,
      default: 0,
    },
    totalOrders: {
      type: Number,
      default: 0,
    },
    monthlyRevenue: {
      type: Number,
      default: 0,
    },
    customerCount: {
      type: Number,
      default: 0,
    },
  },
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
    documents: [{
      type: {
        type: String,
        enum: ['business_license', 'tax_certificate', 'identity_document', 'other'],
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
    }],
  },
  settings: {
    allowReviews: {
      type: Boolean,
      default: true,
    },
    autoApproveProducts: {
      type: Boolean,
      default: false,
    },
    requireCoopApproval: {
      type: Boolean,
      default: true,
    },
    enableNotifications: {
      type: Boolean,
      default: true,
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
storeSchema.index({ name: 'text', description: 'text' });
storeSchema.index({ sellerId: 1 });
storeSchema.index({ cooperativeId: 1 });
storeSchema.index({ status: 1 });
storeSchema.index({ 'location.coordinates': '2dsphere' });

// Update timestamp on save
storeSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Instance methods
storeSchema.methods = {
  /**
   * Check if store is active and verified
   */
  isActiveAndVerified() {
    return this.status === 'active' && this.verification.isVerified;
  },

  /**
   * Check if store is open at given time
   */
  isOpen(dayOfWeek, time) {
    const day = dayOfWeek.toLowerCase();
    const hours = this.businessHours[day];
    
    if (!hours || hours.closed) return false;
    
    if (!time) return true; // If no time specified, just check if day is not closed
    
    const currentTime = new Date(`2000-01-01 ${time}`);
    const openTime = new Date(`2000-01-01 ${hours.open}`);
    const closeTime = new Date(`2000-01-01 ${hours.close}`);
    
    return currentTime >= openTime && currentTime <= closeTime;
  },

  /**
   * Update store statistics
   */
  async updateStatistics() {
    const Product = mongoose.model('Product');
    const Order = mongoose.model('Order');
    
    // Count products
    this.statistics.totalProducts = await Product.countDocuments({ 
      storeId: this._id, 
      status: 'approved' 
    });
    
    // Count orders and calculate sales
    const orders = await Order.find({ 
      'items.storeId': this._id,
      status: { $in: ['completed', 'delivered'] }
    });
    
    this.statistics.totalOrders = orders.length;
    this.statistics.totalSales = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    
    // Calculate monthly revenue
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    
    const monthlyOrders = orders.filter(order => order.createdAt >= currentMonth);
    this.statistics.monthlyRevenue = monthlyOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    
    return this.save();
  },

  /**
   * Get store summary
   */
  getSummary() {
    return {
      id: this._id,
      name: this.name,
      status: this.status,
      isVerified: this.verification.isVerified,
      averageRating: this.ratings.averageRating,
      totalReviews: this.ratings.totalReviews,
      totalProducts: this.statistics.totalProducts,
      totalSales: this.statistics.totalSales,
      location: this.location,
    };
  },
};

const Store = mongoose.model('Store', storeSchema);

module.exports = Store;

