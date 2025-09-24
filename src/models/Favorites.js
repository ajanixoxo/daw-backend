const mongoose = require('mongoose');

const favoritesSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index to ensure a user can only favorite a product once
favoritesSchema.index({ userId: 1, productId: 1 }, { unique: true });

// Index for efficient queries
favoritesSchema.index({ userId: 1, addedAt: -1 });
favoritesSchema.index({ productId: 1 });

// Instance methods
favoritesSchema.methods = {
  /**
   * Get favorite summary
   */
  getSummary() {
    return {
      id: this._id,
      userId: this.userId,
      productId: this.productId,
      addedAt: this.addedAt,
    };
  },
};

// Static methods
favoritesSchema.statics = {
  /**
   * Get user's favorites with product details
   */
  async getUserFavorites(userId, options = {}) {
    const { page = 1, limit = 20, sortBy = 'addedAt', sortOrder = 'desc' } = options;
    
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const skip = (page - 1) * limit;
    
    return this.find({ userId })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'productId',
        select: 'title description price imageUrl category status isActive stockStatus inventory',
        populate: [
          {
            path: 'sellerId',
            select: 'name'
          },
          {
            path: 'storeId',
            select: 'name'
          }
        ]
      });
  },

  /**
   * Check if product is favorited by user
   */
  async isFavorited(userId, productId) {
    const favorite = await this.findOne({ userId, productId });
    return !!favorite;
  },

  /**
   * Get favorites count for a user
   */
  async getUserFavoritesCount(userId) {
    return this.countDocuments({ userId });
  },

  /**
   * Get favorites count for a product
   */
  async getProductFavoritesCount(productId) {
    return this.countDocuments({ productId });
  },

  /**
   * Get most favorited products
   */
  async getMostFavorited(options = {}) {
    const { limit = 10 } = options;
    
    return this.aggregate([
      {
        $group: {
          _id: '$productId',
          favoritesCount: { $sum: 1 },
          latestFavorite: { $max: '$addedAt' }
        }
      },
      {
        $sort: { favoritesCount: -1, latestFavorite: -1 }
      },
      {
        $limit: limit
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      {
        $unwind: '$product'
      },
      {
        $match: {
          'product.status': 'approved',
          'product.isActive': true
        }
      },
      {
        $project: {
          productId: '$_id',
          favoritesCount: 1,
          product: {
            title: 1,
            description: 1,
            price: 1,
            imageUrl: 1,
            category: 1
          }
        }
      }
    ]);
  }
};

const Favorites = mongoose.model('Favorites', favoritesSchema);

module.exports = Favorites;
