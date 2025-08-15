const express = require('express');
const { body, validationResult, query } = require('express-validator');
const auth = require('../middleware/auth');
const { authorizePermissions, authorizeRoles } = require('../middleware/authorize');
const { PERMISSIONS, ROLES } = require('../config/roles');
const Product = require('../models/Product');

const router = express.Router();

// Validation middleware for stock operations
const validateStockUpdate = [
  body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
  body('reason').optional().trim().escape(),
];

const validateStockAdjustment = [
  body('adjustment').isInt().withMessage('Adjustment must be an integer'),
  body('reason').trim().notEmpty().withMessage('Reason is required for stock adjustments'),
];

// GET /api/stock - Get all products with stock information (Admin only)
router.get(
  '/',
  auth,
  authorizePermissions({ any: [PERMISSIONS.VIEW_STOCK] }),
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'title',
        sortOrder = 'asc',
        status,
        category,
        lowStock = false,
        outOfStock = false,
        search
      } = req.query;

      const query = {};
      
      // Apply filters
      if (status) query.stockStatus = status;
      if (category) query.category = category;
      if (lowStock === 'true') query.stockStatus = 'Low Stock';
      if (outOfStock === 'true') query.stockStatus = 'Out of Stock';
      if (search) {
        query.$text = { $search: search };
      }

      // For sellers, only show their own products
      if (req.user.role === ROLES.SELLER) {
        query.sellerId = req.user._id;
      }

      const total = await Product.countDocuments(query);
      
      const products = await Product.find(query)
        .select('title category price inventory stockStatus lowStockThreshold sku sellerId createdAt updatedAt')
        .populate('sellerId', 'name email')
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

      // Get stock statistics
      const stockStats = await Product.aggregate([
        ...(req.user.role === ROLES.SELLER ? [{ $match: { sellerId: req.user._id } }] : []),
        {
          $group: {
            _id: '$stockStatus',
            count: { $sum: 1 },
            totalValue: { $sum: { $multiply: ['$inventory', '$price'] } }
          }
        }
      ]);

      const stats = {
        totalProducts: total,
        inStock: stockStats.find(s => s._id === 'In Stock')?.count || 0,
        lowStock: stockStats.find(s => s._id === 'Low Stock')?.count || 0,
        outOfStock: stockStats.find(s => s._id === 'Out of Stock')?.count || 0,
        totalInventoryValue: stockStats.reduce((sum, s) => sum + (s.totalValue || 0), 0)
      };

      res.json({
        products,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalProducts: total,
          limit: parseInt(limit)
        },
        stats
      });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching stock data', error: error.message });
    }
  }
);

// GET /api/stock/:id - Get detailed stock information for a specific product
router.get(
  '/:id',
  auth,
  authorizePermissions({ any: [PERMISSIONS.VIEW_STOCK] }),
  async (req, res) => {
    try {
      const query = { _id: req.params.id };
      
      // For sellers, only show their own products
      if (req.user.role === ROLES.SELLER) {
        query.sellerId = req.user._id;
      }

      const product = await Product.findOne(query)
        .populate('sellerId', 'name email')
        .populate('stockHistory.performedBy', 'name email');

      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      res.json({
        product: {
          ...product.toObject(),
          formattedStockStatus: product.getFormattedStockStatus()
        }
      });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching product stock data', error: error.message });
    }
  }
);

// PUT /api/stock/:id/update - Update stock quantity (Admin only)
router.put(
  '/:id/update',
  auth,
  authorizeRoles(ROLES.ADMIN),
  authorizePermissions({ any: [PERMISSIONS.MANAGE_STOCK] }),
  validateStockUpdate,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { quantity, reason = 'Stock update by admin' } = req.body;
      
      const product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      const previousStock = product.inventory;
      product.inventory = quantity;
      
      // Add to stock history
      product.stockHistory.push({
        action: 'adjustment',
        quantity: Math.abs(quantity - previousStock),
        previousStock,
        newStock: quantity,
        reason,
        performedBy: req.user._id,
      });

      await product.save();

      res.json({
        message: 'Stock updated successfully',
        product: {
          _id: product._id,
          title: product.title,
          previousStock,
          newStock: product.inventory,
          stockStatus: product.stockStatus
        }
      });
    } catch (error) {
      res.status(500).json({ message: 'Error updating stock', error: error.message });
    }
  }
);

// POST /api/stock/:id/adjust - Adjust stock by a specific amount (Admin only)
router.post(
  '/:id/adjust',
  auth,
  authorizeRoles(ROLES.ADMIN),
  authorizePermissions({ any: [PERMISSIONS.ADJUST_STOCK] }),
  validateStockAdjustment,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { adjustment, reason } = req.body;
      
      const product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      const action = adjustment > 0 ? 'added' : 'removed';
      await product.updateStock(adjustment, action, req.user, reason);

      res.json({
        message: `Stock ${action} successfully`,
        product: {
          _id: product._id,
          title: product.title,
          adjustment,
          newStock: product.inventory,
          stockStatus: product.stockStatus
        }
      });
    } catch (error) {
      res.status(500).json({ message: 'Error adjusting stock', error: error.message });
    }
  }
);

// GET /api/stock/alerts/low-stock - Get low stock alerts (Admin only)
router.get(
  '/alerts/low-stock',
  auth,
  authorizePermissions({ any: [PERMISSIONS.VIEW_LOW_STOCK_ALERTS] }),
  async (req, res) => {
    try {
      const query = {
        $or: [
          { stockStatus: 'Low Stock' },
          { stockStatus: 'Out of Stock' }
        ]
      };

      // For sellers, only show their own products
      if (req.user.role === ROLES.SELLER) {
        query.sellerId = req.user._id;
      }

      const lowStockProducts = await Product.find(query)
        .select('title category inventory stockStatus lowStockThreshold price sellerId')
        .populate('sellerId', 'name email')
        .sort({ inventory: 1 });

      const alertStats = {
        totalAlerts: lowStockProducts.length,
        outOfStock: lowStockProducts.filter(p => p.stockStatus === 'Out of Stock').length,
        lowStock: lowStockProducts.filter(p => p.stockStatus === 'Low Stock').length,
        potentialLostRevenue: lowStockProducts
          .filter(p => p.stockStatus === 'Out of Stock')
          .reduce((sum, p) => sum + (p.price * p.lowStockThreshold), 0)
      };

      res.json({
        alerts: lowStockProducts,
        stats: alertStats
      });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching low stock alerts', error: error.message });
    }
  }
);

// GET /api/stock/:id/history - Get stock history for a product
router.get(
  '/:id/history',
  auth,
  authorizePermissions({ any: [PERMISSIONS.VIEW_STOCK_HISTORY] }),
  async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      
      const query = { _id: req.params.id };
      
      // For sellers, only show their own products
      if (req.user.role === ROLES.SELLER) {
        query.sellerId = req.user._id;
      }

      const product = await Product.findOne(query)
        .select('title stockHistory')
        .populate('stockHistory.performedBy', 'name email role');

      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      // Sort stock history by timestamp (newest first) and paginate
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      
      const sortedHistory = product.stockHistory
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(startIndex, endIndex);

      res.json({
        productTitle: product.title,
        history: sortedHistory,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(product.stockHistory.length / limit),
          totalEntries: product.stockHistory.length,
          limit: parseInt(limit)
        }
      });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching stock history', error: error.message });
    }
  }
);

// GET /api/stock/reports/export - Export stock report (Admin only)
router.get(
  '/reports/export',
  auth,
  authorizeRoles(ROLES.ADMIN),
  authorizePermissions({ any: [PERMISSIONS.EXPORT_STOCK_REPORT] }),
  async (req, res) => {
    try {
      const { format = 'json' } = req.query;

      const products = await Product.find({})
        .select('title category price inventory stockStatus lowStockThreshold sku sellerId createdAt')
        .populate('sellerId', 'name email')
        .sort({ title: 1 });

      const reportData = products.map(product => ({
        id: product._id,
        title: product.title,
        category: product.category,
        price: product.price,
        inventory: product.inventory,
        stockStatus: product.stockStatus,
        lowStockThreshold: product.lowStockThreshold,
        sku: product.sku || 'N/A',
        seller: product.sellerId?.name || 'Unknown',
        totalValue: product.inventory * product.price,
        createdAt: product.createdAt
      }));

      if (format === 'csv') {
        const csvHeader = 'ID,Title,Category,Price,Inventory,Stock Status,Low Stock Threshold,SKU,Seller,Total Value,Created At\n';
        const csvData = reportData.map(row => 
          `${row.id},"${row.title}","${row.category}",${row.price},${row.inventory},"${row.stockStatus}",${row.lowStockThreshold},"${row.sku}","${row.seller}",${row.totalValue},"${row.createdAt}"`
        ).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="stock-report.csv"');
        res.send(csvHeader + csvData);
      } else {
        res.json({
          reportGenerated: new Date(),
          totalProducts: reportData.length,
          data: reportData
        });
      }
    } catch (error) {
      res.status(500).json({ message: 'Error generating stock report', error: error.message });
    }
  }
);

// POST /api/stock/bulk-update - Bulk update stock for multiple products (Admin only)
router.post(
  '/bulk-update',
  auth,
  authorizeRoles(ROLES.ADMIN),
  authorizePermissions({ any: [PERMISSIONS.MANAGE_STOCK] }),
  async (req, res) => {
    try {
      const { updates, reason = 'Bulk stock update' } = req.body;

      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ message: 'Updates array is required' });
      }

      const results = [];
      const errors = [];

      for (const update of updates) {
        try {
          const { productId, quantity } = update;
          
          if (!productId || quantity === undefined) {
            errors.push({ productId, error: 'Product ID and quantity are required' });
            continue;
          }

          const product = await Product.findById(productId);
          if (!product) {
            errors.push({ productId, error: 'Product not found' });
            continue;
          }

          const previousStock = product.inventory;
          product.inventory = Math.max(0, quantity);
          
          product.stockHistory.push({
            action: 'adjustment',
            quantity: Math.abs(quantity - previousStock),
            previousStock,
            newStock: product.inventory,
            reason,
            performedBy: req.user._id,
          });

          await product.save();
          
          results.push({
            productId: product._id,
            title: product.title,
            previousStock,
            newStock: product.inventory,
            stockStatus: product.stockStatus
          });
        } catch (error) {
          errors.push({ productId: update.productId, error: error.message });
        }
      }

      res.json({
        message: 'Bulk stock update completed',
        successCount: results.length,
        errorCount: errors.length,
        results,
        errors
      });
    } catch (error) {
      res.status(500).json({ message: 'Error performing bulk stock update', error: error.message });
    }
  }
);

module.exports = router; 