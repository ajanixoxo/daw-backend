const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  type: {
    type: String,
    enum: ['in', 'out', 'adjustment', 'return', 'damaged', 'expired', 'transfer'],
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  reason: {
    type: String,
    required: true,
    trim: true,
  },
  previousStock: {
    type: Number,
    required: true,
  },
  newStock: {
    type: Number,
    required: true,
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  reference: {
    type: String,
    trim: true,
  },
  referenceType: {
    type: String,
    enum: ['order', 'purchase', 'return', 'adjustment', 'transfer', 'other'],
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  location: {
    from: {
      type: String,
      trim: true,
    },
    to: {
      type: String,
      trim: true,
    },
  },
  cost: {
    unitCost: {
      type: Number,
      min: 0,
    },
    totalCost: {
      type: Number,
      min: 0,
    },
  },
  notes: {
    type: String,
    trim: true,
  },
  tags: [{
    type: String,
    trim: true,
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes
stockMovementSchema.index({ productId: 1, createdAt: -1 });
stockMovementSchema.index({ type: 1, createdAt: -1 });
stockMovementSchema.index({ performedBy: 1, createdAt: -1 });
stockMovementSchema.index({ referenceType: 1, referenceId: 1 });
stockMovementSchema.index({ createdAt: -1 });

// Instance methods
stockMovementSchema.methods = {
  /**
   * Get movement summary
   */
  getSummary() {
    return {
      id: this._id,
      type: this.type,
      quantity: this.quantity,
      reason: this.reason,
      previousStock: this.previousStock,
      newStock: this.newStock,
      performedBy: this.performedBy,
      reference: this.reference,
      createdAt: this.createdAt,
    };
  },

  /**
   * Check if movement is an increase in stock
   */
  isStockIncrease() {
    return ['in', 'return', 'transfer'].includes(this.type);
  },

  /**
   * Check if movement is a decrease in stock
   */
  isStockDecrease() {
    return ['out', 'damaged', 'expired'].includes(this.type);
  },

  /**
   * Get formatted quantity with sign
   */
  getFormattedQuantity() {
    const sign = this.isStockIncrease() ? '+' : this.isStockDecrease() ? '-' : '';
    return `${sign}${this.quantity}`;
  },
};

// Static methods
stockMovementSchema.statics = {
  /**
   * Get stock movements for a product within date range
   */
  async getProductMovements(productId, startDate, endDate) {
    const query = { productId };
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = startDate;
      if (endDate) query.createdAt.$lte = endDate;
    }
    
    return this.find(query).sort({ createdAt: -1 });
  },

  /**
   * Get stock movements by type within date range
   */
  async getMovementsByType(type, startDate, endDate) {
    const query = { type };
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = startDate;
      if (endDate) query.createdAt.$lte = endDate;
    }
    
    return this.find(query).sort({ createdAt: -1 });
  },

  /**
   * Get stock movement summary for a product
   */
  async getProductSummary(productId, startDate, endDate) {
    const query = { productId };
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = startDate;
      if (endDate) query.createdAt.$lte = endDate;
    }
    
    const movements = await this.find(query);
    
    const summary = {
      totalIn: 0,
      totalOut: 0,
      totalAdjustments: 0,
      totalReturns: 0,
      totalDamaged: 0,
      totalExpired: 0,
      totalTransfers: 0,
      netChange: 0,
      movementCount: movements.length,
    };
    
    movements.forEach(movement => {
      switch (movement.type) {
        case 'in':
          summary.totalIn += movement.quantity;
          summary.netChange += movement.quantity;
          break;
        case 'out':
          summary.totalOut += movement.quantity;
          summary.netChange -= movement.quantity;
          break;
        case 'adjustment':
          summary.totalAdjustments += movement.quantity;
          summary.netChange += movement.quantity;
          break;
        case 'return':
          summary.totalReturns += movement.quantity;
          summary.netChange += movement.quantity;
          break;
        case 'damaged':
          summary.totalDamaged += movement.quantity;
          summary.netChange -= movement.quantity;
          break;
        case 'expired':
          summary.totalExpired += movement.quantity;
          summary.netChange -= movement.quantity;
          break;
        case 'transfer':
          summary.totalTransfers += movement.quantity;
          break;
      }
    });
    
    return summary;
  },
};

const StockMovement = mongoose.model('StockMovement', stockMovementSchema);

module.exports = StockMovement;

