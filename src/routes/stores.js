const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { authorizeRoles, authorizeOwnership } = require('../middleware/authorize');
const { imageUploadMiddleware, processUploadedFiles, handleMulterError } = require('../middleware/imageUpload');
const { ROLES } = require('../config/roles');
const Store = require('../models/Store');
const Cooperative = require('../models/Cooperative');
const User = require('../models/User');

const router = express.Router();

// Validation middleware
const validateStore = [
  body('name').trim().notEmpty().withMessage('Store name is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('cooperativeId').isMongoId().withMessage('Valid cooperative ID is required'),
  body('imageUrl').optional().trim().isURL().withMessage('Invalid image URL format'),
  body('contactInfo.phone').optional().trim(),
  body('contactInfo.email').optional().isEmail().withMessage('Invalid email format'),
  body('location.address').optional().trim(),
  body('location.city').optional().trim(),
  body('location.state').optional().trim(),
  body('location.country').optional().trim(),
  body('categories').optional().isArray().withMessage('Categories must be an array'),
  body('policies.returnPolicy').optional().trim(),
  body('policies.shippingPolicy').optional().trim(),
  body('policies.refundPolicy').optional().trim(),
];

const validateStoreUpdate = [
  body('name').optional().trim().notEmpty().withMessage('Store name cannot be empty'),
  body('description').optional().trim().notEmpty().withMessage('Description cannot be empty'),
  body('contactInfo.phone').optional().trim(),
  body('contactInfo.email').optional().isEmail().withMessage('Invalid email format'),
  body('location.address').optional().trim(),
  body('location.city').optional().trim(),
  body('location.state').optional().trim(),
  body('location.country').optional().trim(),
  body('categories').optional().isArray().withMessage('Categories must be an array'),
  body('policies.returnPolicy').optional().trim(),
  body('policies.shippingPolicy').optional().trim(),
  body('policies.refundPolicy').optional().trim(),
];

// Seller creates store
router.post('/', 
  auth, 
  authorizeRoles(ROLES.SELLER),
  imageUploadMiddleware.storeImages,
  handleMulterError,
  validateStore,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { cooperativeId } = req.body;

      // Check if cooperative exists and is active
      const cooperative = await Cooperative.findById(cooperativeId);
      if (!cooperative) {
        return res.status(404).json({ message: 'Cooperative not found' });
      }

      if (!cooperative.isActiveAndVerified()) {
        return res.status(400).json({ 
          message: 'Cooperative must be active and verified' 
        });
      }

      // Check if user is a member of the cooperative
      const Membership = require('../models/Membership');
      const membership = await Membership.findOne({
        cooperativeId,
        userId: req.user._id,
        status: 'active',
      });

      if (!membership) {
        return res.status(403).json({ 
          message: 'You must be a member of the cooperative to create a store' 
        });
      }

      // Check if user already has a store
      const existingStore = await Store.findOne({ sellerId: req.user._id });
      if (existingStore) {
        return res.status(400).json({ 
          message: 'You already have a store' 
        });
      }

      // Process uploaded images
      const uploadedFiles = processUploadedFiles(req);
      
      const storeData = {
        ...req.body,
        sellerId: req.user._id,
        status: 'pending_approval',
        verification: {
          isVerified: false,
        },
      };

      // Set imageUrl if provided
      if (req.body.imageUrl) {
        storeData.imageUrl = req.body.imageUrl;
      }

      // Add image URLs if uploaded
      if (uploadedFiles.logo && uploadedFiles.logo.length > 0) {
        storeData.branding = storeData.branding || {};
        storeData.branding.logo = uploadedFiles.logo[0].url;
      }
      
      if (uploadedFiles.banner && uploadedFiles.banner.length > 0) {
        storeData.branding = storeData.branding || {};
        storeData.branding.banner = uploadedFiles.banner[0].url;
      }
      
      if (uploadedFiles.gallery && uploadedFiles.gallery.length > 0) {
        storeData.branding = storeData.branding || {};
        storeData.branding.gallery = uploadedFiles.gallery.map(file => ({
          url: file.url,
          alt: req.body.galleryAlt || '',
          caption: req.body.galleryCaption || '',
          uploadedAt: file.uploadedAt
        }));
      }

      const store = new Store(storeData);
      await store.save();

      res.status(201).json({
        message: 'Store created successfully and pending approval',
        store: store.getSummary(),
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error creating store', 
        error: error.message 
      });
    }
  }
);

// View store details (All users)
router.get('/:id', async (req, res) => {
  try {
    const store = await Store.findById(req.params.id)
      .populate('sellerId', 'name email profilePicture')
      .populate('cooperativeId', 'name description');

    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    // Only show active and verified stores to non-authenticated users
    if (!req.user && !store.isActiveAndVerified()) {
      return res.status(404).json({ message: 'Store not found' });
    }

    // Check if user has access to view this store
    if (req.user) {
      if (req.user.role === ROLES.SELLER && store.sellerId.toString() !== req.user._id.toString()) {
        if (!store.isActiveAndVerified()) {
          return res.status(404).json({ message: 'Store not found' });
        }
      }
    }

    res.json({
      store: store.getSummary(),
      seller: store.sellerId,
      cooperative: store.cooperativeId,
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching store', 
      error: error.message 
    });
  }
});

// Browse all stores (All users)
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      cooperativeId, 
      category,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Filter by status (only show active stores to non-authenticated users)
    if (req.user && req.user.role === ROLES.ADMIN) {
      if (status) query.status = status;
    } else {
      query.status = 'active';
      query['verification.isVerified'] = true;
    }

    if (cooperativeId) query.cooperativeId = cooperativeId;
    if (category) query.categories = { $in: [category] };
    if (search) {
      query.$text = { $search: search };
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const stores = await Store.find(query)
      .populate('sellerId', 'name email profilePicture')
      .populate('cooperativeId', 'name')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort(sortOptions);

    const total = await Store.countDocuments(query);

    res.json({
      stores: stores.map(store => store.getSummary()),
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching stores', 
      error: error.message 
    });
  }
});

// Update store info (Seller + Coop Admin + Admin)
router.patch('/:id', 
  auth, 
  authorizeRoles(ROLES.SELLER, ROLES.COOPERATIVE_ADMIN, ROLES.ADMIN),
  validateStoreUpdate,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const storeId = req.params.id;
      const store = await Store.findById(storeId);

      if (!store) {
        return res.status(404).json({ message: 'Store not found' });
      }

      // Check if user has permission to update this store
      if (req.user.role === ROLES.SELLER) {
        if (store.sellerId.toString() !== req.user._id.toString()) {
          return res.status(403).json({ 
            message: 'You can only update your own store' 
          });
        }
      } else if (req.user.role === ROLES.COOPERATIVE_ADMIN) {
        // Check if user is admin of the cooperative that owns this store
        const Membership = require('../models/Membership');
        const membership = await Membership.findOne({
          cooperativeId: store.cooperativeId,
          userId: req.user._id,
          roleInCoop: 'admin',
          status: 'active',
        });

        if (!membership) {
          return res.status(403).json({ 
            message: 'You can only update stores in your cooperative' 
          });
        }
      }

      // Update store
      const updatedStore = await Store.findByIdAndUpdate(
        storeId,
        { ...req.body, updatedAt: new Date() },
        { new: true, runValidators: true }
      );

      res.json({
        message: 'Store updated successfully',
        store: updatedStore.getSummary(),
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error updating store', 
        error: error.message 
      });
    }
  }
);

// Suspend store (Admin + Coop Admin)
router.delete('/:id', 
  auth, 
  authorizeRoles(ROLES.ADMIN, ROLES.COOPERATIVE_ADMIN),
  async (req, res) => {
    try {
      const storeId = req.params.id;
      const store = await Store.findById(storeId);

      if (!store) {
        return res.status(404).json({ message: 'Store not found' });
      }

      // Check if user has permission to suspend this store
      if (req.user.role === ROLES.COOPERATIVE_ADMIN) {
        // Check if user is admin of the cooperative that owns this store
        const Membership = require('../models/Membership');
        const membership = await Membership.findOne({
          cooperativeId: store.cooperativeId,
          userId: req.user._id,
          roleInCoop: 'admin',
          status: 'active',
        });

        if (!membership) {
          return res.status(403).json({ 
            message: 'You can only suspend stores in your cooperative' 
          });
        }
      }

      // Suspend store instead of deleting
      store.status = 'suspended';
      store.updatedAt = new Date();
      await store.save();

      res.json({ message: 'Store suspended successfully' });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error suspending store', 
        error: error.message 
      });
    }
  }
);

// Get store statistics (Store owner + Coop Admin + Admin)
router.get('/:id/stats', 
  auth, 
  authorizeRoles(ROLES.SELLER, ROLES.COOPERATIVE_ADMIN, ROLES.ADMIN),
  async (req, res) => {
    try {
      const storeId = req.params.id;
      const store = await Store.findById(storeId);

      if (!store) {
        return res.status(404).json({ message: 'Store not found' });
      }

      // Check if user has permission to view stats
      if (req.user.role === ROLES.SELLER) {
        if (store.sellerId.toString() !== req.user._id.toString()) {
          return res.status(403).json({ 
            message: 'You can only view stats for your own store' 
          });
        }
      } else if (req.user.role === ROLES.COOPERATIVE_ADMIN) {
        // Check if user is admin of the cooperative that owns this store
        const Membership = require('../models/Membership');
        const membership = await Membership.findOne({
          cooperativeId: store.cooperativeId,
          userId: req.user._id,
          roleInCoop: 'admin',
          status: 'active',
        });

        if (!membership) {
          return res.status(403).json({ 
            message: 'You can only view stats for stores in your cooperative' 
          });
        }
      }

      // Update store statistics
      await store.updateStatistics();

      res.json({
        store: store.getSummary(),
        stats: store.statistics,
        ratings: store.ratings,
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error fetching store statistics', 
        error: error.message 
      });
    }
  }
);

module.exports = router;

