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

// Update timestamps on save
productSchema.pre('save', function(next) {
  this.updatedAt = new Date();
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
  }
};

const Product = mongoose.model('Product', productSchema);

module.exports = Product;