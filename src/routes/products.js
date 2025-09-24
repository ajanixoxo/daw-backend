const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { authorizePermissions, authorizeRoles } = require('../middleware/authorize');
const { PERMISSIONS, ROLES } = require('../config/roles');
const Product = require('../models/Product');

const router = express.Router();

// Validation middleware
const validateProduct = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('imageUrl').trim().notEmpty().withMessage('Image URL is required'),
];

// Create product
router.post(
  '/',
  auth,
  authorizePermissions(PERMISSIONS.CREATE_PRODUCT),
  validateProduct,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const product = new Product({
        ...req.body,
        sellerId: req.user._id,
      });

      await product.save();
      res.status(201).json(product);
    } catch (error) {
      res.status(500).json({ message: 'Error creating product', error: error.message });
    }
  }
);

// GET /api/products/admin/all - Get all products with complete details (Admin only)
router.get('/admin/all', auth, authorizeRoles(ROLES.ADMIN), async (req, res) => {
  try {
    const { 
      category,
      subcategory,
      status,
      stockStatus,
      sellerId,
      storeId,
      cooperativeId,
      minPrice,
      maxPrice,
      minStock,
      maxStock,
      search,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      startDate,
      endDate,
      isActive
    } = req.query;

    const query = {};
    
    // Apply comprehensive filters
    if (category) query.category = category;
    if (subcategory) query.subcategory = subcategory;
    if (status) query.status = status;
    if (stockStatus) query.stockStatus = stockStatus;
    if (sellerId) query.sellerId = sellerId;
    if (storeId) query.storeId = storeId;
    if (cooperativeId) query.cooperativeId = cooperativeId;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    
    // Price range filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }
    
    // Stock/inventory range filter
    if (minStock || maxStock) {
      query.inventory = {};
      if (minStock) query.inventory.$gte = parseInt(minStock);
      if (maxStock) query.inventory.$lte = parseInt(maxStock);
    }
    
    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    // Text search
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
        { sku: { $regex: search, $options: 'i' } }
      ];
    }

    // Sorting options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Count total documents for pagination
    const total = await Product.countDocuments(query);

    // Get paginated results with full population
    const products = await Product.find(query)
      .sort(sortOptions)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .populate('sellerId', 'name email phone role status')
      .populate('storeId', 'name description status category')
      .populate('cooperativeId', 'name description status verificationStatus')
      .populate('reviewedBy', 'name email')
      .lean(); // Use lean for better performance

    // Calculate summary statistics
    const statusCounts = await Product.aggregate([
      { $match: query },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const stockStatusCounts = await Product.aggregate([
      { $match: query },
      { $group: { _id: '$stockStatus', count: { $sum: 1 } } }
    ]);

    const categoryCounts = await Product.aggregate([
      { $match: query },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const totalValue = await Product.aggregate([
      { $match: query },
      { $group: { _id: null, totalValue: { $sum: { $multiply: ['$price', '$inventory'] } } } }
    ]);

    const averagePrice = await Product.aggregate([
      { $match: query },
      { $group: { _id: null, avgPrice: { $avg: '$price' } } }
    ]);

    res.json({
      products,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalProducts: total,
        limit: parseInt(limit),
      },
      summary: {
        totalProducts: total,
        statusBreakdown: statusCounts,
        stockStatusBreakdown: stockStatusCounts,
        categoryBreakdown: categoryCounts,
        totalInventoryValue: totalValue.length > 0 ? totalValue[0].totalValue : 0,
        averagePrice: averagePrice.length > 0 ? averagePrice[0].avgPrice : 0,
      },
      filters: {
        availableCategories: Object.keys(Product.getMarketplaceCategories()),
        availableStatuses: ['pending', 'approved', 'rejected'],
        availableStockStatuses: ['In Stock', 'Out of Stock', 'Low Stock'],
      },
      message: 'All products retrieved successfully (Admin access)'
    });
  } catch (error) {
    console.error('Admin get all products error:', error);
    res.status(500).json({ 
      message: 'Error fetching all products', 
      error: error.message 
    });
  }
});

router.get('/categories', auth, async (req, res) => {
  try {
    const categories = Product.getMarketplaceCategories();
    
    // Get product counts per category
    const categoryCounts = await Product.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    
    // Get approved product counts per category
    const approvedCategoryCounts = await Product.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    // Combine data
    const categoryData = Object.keys(categories).map(categoryKey => {
      const categoryInfo = categories[categoryKey];
      const totalCount = categoryCounts.find(c => c._id === categoryKey)?.count || 0;
      const approvedCount = approvedCategoryCounts.find(c => c._id === categoryKey)?.count || 0;
      
      return {
        key: categoryKey,
        name: categoryInfo.name,
        description: categoryInfo.description,
        subcategories: categoryInfo.subcategories,
        totalProducts: totalCount,
        approvedProducts: approvedCount,
        pendingProducts: totalCount - approvedCount
      };
    });

    res.json({
      categories: categoryData,
      summary: {
        totalCategories: Object.keys(categories).length,
        totalProducts: categoryCounts.reduce((sum, cat) => sum + cat.count, 0),
        totalApprovedProducts: approvedCategoryCounts.reduce((sum, cat) => sum + cat.count, 0)
      },
      message: 'Product categories retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching product categories', 
      error: error.message 
    });
  }
});


// Get all products with filters and pagination
router.get('/', async (req, res) => {
  console.log('Products route hit');
  try {
    const { 
      category,
      minPrice,
      maxPrice,
      search,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    
    // Apply filters
    if (category) query.category = category;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }
    if (search) {
      query.$text = { $search: search };
    }

    // Count total documents for pagination
    const total = await Product.countDocuments(query);

    // Get paginated results
    const products = await Product.find(query)
      .sort({ [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('sellerId', 'name email');

    res.json({
      products,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalProducts: total,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products', error: error.message });
  }
});

// Get product by ID
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('sellerId', 'name email');
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching product', error: error.message });
  }
});

// Update product
router.put(
  '/:id',
  auth,
  authorizePermissions(PERMISSIONS.UPDATE_PRODUCT),
  // validateProduct,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const product = await Product.findOneAndUpdate(
        { _id: req.params.id, sellerId: req.user._id },
        req.body,
        { new: true, runValidators: true }
      );

      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      res.json(product);
    } catch (error) {
      res.status(500).json({ message: 'Error updating product', error: error.message });
    }
  }
);

// Delete product
router.delete(
  '/:id',
  auth,
  authorizePermissions(PERMISSIONS.DELETE_PRODUCT),
  async (req, res) => {
    try {
      const product = await Product.findOneAndDelete({
        _id: req.params.id,
        sellerId: req.user._id,
      });

      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      res.json({ message: 'Product deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting product', error: error.message });
    }
  }
);

// GET /api/products/admin/pending - Get all pending products for approval (Admin only)
router.get('/admin/pending', auth, authorizeRoles(ROLES.ADMIN), async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const query = { status: 'pending' };
    const total = await Product.countDocuments(query);
    
    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .populate('sellerId', 'name email phone')
      .populate('storeId', 'name')
      .populate('cooperativeId', 'name');

    res.json({
      products,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalProducts: total,
        limit: parseInt(limit),
      },
      message: 'Pending products retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching pending products', 
      error: error.message 
    });
  }
});

// GET /api/products/admin/categories - Get product categories and statistics (Admin only)

// GET /api/products/admin/stats - Get comprehensive product statistics (Admin only)
router.get('/admin/stats', auth, authorizeRoles(ROLES.ADMIN), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Basic counts
    const totalProducts = await Product.countDocuments(dateFilter);
    const approvedProducts = await Product.countDocuments({ ...dateFilter, status: 'approved' });
    const pendingProducts = await Product.countDocuments({ ...dateFilter, status: 'pending' });
    const rejectedProducts = await Product.countDocuments({ ...dateFilter, status: 'rejected' });
    
    // Stock statistics
    const outOfStockProducts = await Product.countDocuments({ ...dateFilter, stockStatus: 'Out of Stock' });
    const lowStockProducts = await Product.countDocuments({ ...dateFilter, stockStatus: 'Low Stock' });
    const inStockProducts = await Product.countDocuments({ ...dateFilter, stockStatus: 'In Stock' });
    
    // Value statistics
    const totalInventoryValue = await Product.aggregate([
      { $match: dateFilter },
      { $group: { _id: null, total: { $sum: { $multiply: ['$price', '$inventory'] } } } }
    ]);
    
    const averagePrice = await Product.aggregate([
      { $match: dateFilter },
      { $group: { _id: null, avg: { $avg: '$price' } } }
    ]);
    
    const totalInventoryCount = await Product.aggregate([
      { $match: dateFilter },
      { $group: { _id: null, total: { $sum: '$inventory' } } }
    ]);

    // Top categories
    const topCategories = await Product.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Top sellers
    const topSellers = await Product.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$sellerId', productCount: { $sum: 1 } } },
      { $sort: { productCount: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'seller' } },
      { $unwind: '$seller' },
      { $project: { sellerId: '$_id', productCount: 1, sellerName: '$seller.name', sellerEmail: '$seller.email' } }
    ]);

    res.json({
      summary: {
        totalProducts,
        approvedProducts,
        pendingProducts,
        rejectedProducts,
        approvalRate: totalProducts > 0 ? ((approvedProducts / totalProducts) * 100).toFixed(2) : 0
      },
      inventory: {
        inStockProducts,
        lowStockProducts,
        outOfStockProducts,
        totalInventoryCount: totalInventoryCount.length > 0 ? totalInventoryCount[0].total : 0,
        totalInventoryValue: totalInventoryValue.length > 0 ? totalInventoryValue[0].total : 0,
        averagePrice: averagePrice.length > 0 ? averagePrice[0].avg : 0
      },
      insights: {
        topCategories,
        topSellers
      },
      dateRange: {
        startDate: startDate || null,
        endDate: endDate || null
      },
      message: 'Product statistics retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching product statistics', 
      error: error.message 
    });
  }
});

// GET /api/products/seller/my-products - Get seller's products
router.get(
  '/seller/my-products',
  auth,
  authorizePermissions(PERMISSIONS.READ_PRODUCT),
  async (req, res) => {
    try {
      const products = await Product.find({ sellerId: req.user._id });
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching seller products', error: error.message });
    }
  }
);

module.exports = router; 