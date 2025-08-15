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
    required: true,
    trim: true,
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

const Product = mongoose.model('Product', productSchema);

module.exports = Product;