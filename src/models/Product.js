const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    enum: [
      'handcrafted-goods',
      'agricultural-products', 
      'fashion-beauty',
      'digital-services',
      'health-wellness',
      'education-training'
    ],
    required: true,
    trim: true,
  },
  subcategory: {
    type: String,
    trim: true,
  },
  marketplaceCategory: {
    handcraftedGoods: {
      subcategories: [
        'jewelry',
        'textiles',
        'pottery',
        'woodwork',
        'leatherwork',
        'beadwork',
        'metalwork',
        'basketry',
        'other-crafts'
      ]
    },
    agriculturalProducts: {
      subcategories: [
        'grains-cereals',
        'fruits',
        'vegetables',
        'spices-herbs',
        'dairy-products',
        'poultry',
        'processed-foods',
        'organic-products',
        'seeds-seedlings'
      ]
    },
    fashionBeauty: {
      subcategories: [
        'traditional-wear',
        'modern-fashion',
        'accessories',
        'skincare',
        'cosmetics',
        'hair-products',
        'perfumes',
        'nail-care',
        'wellness-products'
      ]
    },
    digitalServices: {
      subcategories: [
        'graphic-design',
        'web-development',
        'content-writing',
        'digital-marketing',
        'virtual-assistance',
        'online-tutoring',
        'consulting',
        'photography',
        'video-editing'
      ]
    },
    healthWellness: {
      subcategories: [
        'herbal-medicine',
        'fitness-products',
        'nutritional-supplements',
        'medical-devices',
        'therapy-services',
        'wellness-coaching',
        'mental-health',
        'traditional-healing',
        'health-education'
      ]
    },
    educationTraining: {
      subcategories: [
        'skill-development',
        'business-training',
        'technical-courses',
        'language-learning',
        'creative-arts',
        'professional-development',
        'entrepreneurship',
        'financial-literacy',
        'digital-literacy'
      ]
    }
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  imageUrl: {
    type: String,
    required: true,
  },
  images: [{
    url: {
      type: String,
      required: true,
    },
    alt: {
      type: String,
      trim: true,
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true,
  },
  cooperativeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cooperative',
    required: true,
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  statusMessage: {
    type: String,
    trim: true,
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  reviewedAt: {
    type: Date,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  tags: [{
    type: String,
    trim: true,
  }],
  // Stock/Inventory fields
  stock: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
  },
  inventory: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
  },
  stockStatus: {
    type: String,
    enum: ['In Stock', 'Out of Stock', 'Low Stock'],
    default: function() {
      if (this.inventory === 0) return 'Out of Stock';
      if (this.inventory <= this.lowStockThreshold) return 'Low Stock';
      return 'In Stock';
    }
  },
  lowStockThreshold: {
    type: Number,
    default: 10,
    min: 0,
  },
  sku: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
  },
  weight: {
    type: Number,
    min: 0,
  },
  dimensions: {
    length: { type: Number, min: 0 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
  },
  stockHistory: [{
    action: {
      type: String,
      enum: ['added', 'removed', 'adjustment', 'sold'],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    previousStock: {
      type: Number,
      required: true,
    },
    newStock: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      trim: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
});

// Add text index for search functionality
productSchema.index({ 
  title: 'text', 
  description: 'text', 
  category: 'text',
  tags: 'text'
});

// Index for stock queries
productSchema.index({ stockStatus: 1, inventory: 1 });
productSchema.index({ sku: 1 });

// Update timestamps and stock status on save
productSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Auto-update stock status based on inventory
  if (this.inventory === 0) {
    this.stockStatus = 'Out of Stock';
  } else if (this.inventory <= this.lowStockThreshold) {
    this.stockStatus = 'Low Stock';
  } else {
    this.stockStatus = 'In Stock';
  }
  
  next();
});

// Instance methods
productSchema.methods = {
  /**
   * Check if product is visible to buyers
   */
  isVisibleToBuyers() {
    return this.status === 'approved' && this.isActive;
  },

  /**
   * Check if user can edit product
   * @param {Object} user - User object
   */
  canBeEditedBy(user) {
    if (!user) return false;
    
    // Admin can edit any product
    if (user.role === 'admin') return true;
    
    // Seller can only edit their own products
    if (user.role === 'seller') {
      return this.sellerId.toString() === user._id.toString();
    }
    
    return false;
  },

  /**
   * Update stock with history tracking
   * @param {Number} quantity - Quantity to add/remove (positive for add, negative for remove)
   * @param {String} action - Type of action ('added', 'removed', 'adjustment', 'sold')
   * @param {Object} user - User performing the action
   * @param {String} reason - Reason for stock change
   */
  async updateStock(quantity, action, user, reason = '') {
    const previousStock = this.inventory;
    this.inventory = Math.max(0, this.inventory + quantity);
    
    // Add to stock history
    this.stockHistory.push({
      action,
      quantity: Math.abs(quantity),
      previousStock,
      newStock: this.inventory,
      reason,
      performedBy: user._id,
    });

    return this.save();
  },

  /**
   * Check if product has sufficient stock
   * @param {Number} requestedQuantity - Requested quantity
   */
  hasStock(requestedQuantity = 1) {
    return this.inventory >= requestedQuantity;
  },

  /**
   * Get formatted stock status for display
   */
  getFormattedStockStatus() {
    return {
      status: this.stockStatus,
      count: this.inventory,
      isLowStock: this.stockStatus === 'Low Stock',
      isOutOfStock: this.stockStatus === 'Out of Stock',
    };
  }
};

// Static methods for category management
productSchema.statics.getMarketplaceCategories = function() {
  return {
    'handcrafted-goods': {
      name: 'Handcrafted Goods',
      description: 'Unique handmade items created by skilled artisans',
      subcategories: [
        'jewelry',
        'textiles',
        'pottery',
        'woodwork',
        'leatherwork',
        'beadwork',
        'metalwork',
        'basketry',
        'other-crafts'
      ]
    },
    'agricultural-products': {
      name: 'Agricultural Products',
      description: 'Fresh produce and processed agricultural goods',
      subcategories: [
        'grains-cereals',
        'fruits',
        'vegetables',
        'spices-herbs',
        'dairy-products',
        'poultry',
        'processed-foods',
        'organic-products',
        'seeds-seedlings'
      ]
    },
    'fashion-beauty': {
      name: 'Fashion & Beauty',
      description: 'Clothing, accessories, and beauty products',
      subcategories: [
        'traditional-wear',
        'modern-fashion',
        'accessories',
        'skincare',
        'cosmetics',
        'hair-products',
        'perfumes',
        'nail-care',
        'wellness-products'
      ]
    },
    'digital-services': {
      name: 'Digital Services',
      description: 'Online services and digital products',
      subcategories: [
        'graphic-design',
        'web-development',
        'content-writing',
        'digital-marketing',
        'virtual-assistance',
        'online-tutoring',
        'consulting',
        'photography',
        'video-editing'
      ]
    },
    'health-wellness': {
      name: 'Health & Wellness',
      description: 'Products and services for health and wellbeing',
      subcategories: [
        'herbal-medicine',
        'fitness-products',
        'nutritional-supplements',
        'medical-devices',
        'therapy-services',
        'wellness-coaching',
        'mental-health',
        'traditional-healing',
        'health-education'
      ]
    },
    'education-training': {
      name: 'Education & Training',
      description: 'Educational content and training programs',
      subcategories: [
        'skill-development',
        'business-training',
        'technical-courses',
        'language-learning',
        'creative-arts',
        'professional-development',
        'entrepreneurship',
        'financial-literacy',
        'digital-literacy'
      ]
    }
  };
};

productSchema.statics.getCategorySubcategories = function(category) {
  const categories = this.getMarketplaceCategories();
  return categories[category]?.subcategories || [];
};

productSchema.statics.validateCategoryAndSubcategory = function(category, subcategory) {
  const categories = this.getMarketplaceCategories();
  const categoryData = categories[category];
  
  if (!categoryData) {
    return { valid: false, error: 'Invalid category' };
  }
  
  if (subcategory && !categoryData.subcategories.includes(subcategory)) {
    return { valid: false, error: 'Invalid subcategory for the selected category' };
  }
  
  return { valid: true };
};

const Product = mongoose.model('Product', productSchema);

module.exports = Product;