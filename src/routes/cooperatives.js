const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { authorizeRoles, authorizeOwnership } = require('../middleware/authorize');
const { imageUploadMiddleware, processUploadedFiles, handleMulterError } = require('../middleware/imageUpload');
const { ROLES } = require('../config/roles');
const Cooperative = require('../models/Cooperative');
const Membership = require('../models/Membership');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const MembershipPlanTemplate = require('../models/MembershipPlanTemplate');

const router = express.Router();

// Validation middleware
const validateCooperative = [
  body('name').trim().notEmpty().withMessage('Cooperative name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Cooperative name must be between 2 and 100 characters'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('imageUrl').optional().trim(),
  body('contactInfo.phone').optional().trim(),
  body('contactInfo.email').trim().notEmpty().withMessage('Cooperative email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('location.address').optional().trim(),
  body('location.city').optional().trim(),
  body('location.state').optional().trim(),
  body('location.country').optional().trim(),
];

const validateMemberInvite = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('roleInCoop').isIn(['member', 'admin', 'moderator', 'treasurer', 'secretary'])
    .withMessage('Invalid role specified'),
];

// Get current user's ID
router.get('/me/id', 
  auth, 
  async (req, res) => {
    try {
      const cooperative = await Cooperative.findOne({
        adminId: req.user._id
      });
      // console.log("DHHANA",cooperative);
      res.json({
        message: 'Cooperative ID retrieved successfully',
        cooperativeId: cooperative._id,
      });
      // res.json({
      //   message: 'User ID retrieved successfully',
      //   userId: req.user._id,
      //   user: {
      //     id: req.user._id,
      //     name: req.user.name,
      //     email: req.user.email,
      //     role: req.user.role,
      //     userTier: req.user.userTier
      //   }
      // });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error retrieving user ID', 
        error: error.message 
      });
    }
  }
);

router.get('/my-invitations', 
  auth, 
  async (req, res) => {
    try {
      const userId = req.user._id;
      // Get the Coorporatibe ID from the User
      const cooprtaiove  = await Cooperative.find({
        adminId: userId
      });
      const cooperativeIds = cooprtaiove.map(c => c._id);
      const { status = 'pending' } = req.query;
      const invitations = await Membership.find({
        cooperativeId: { $in: cooperativeIds },
        status: status
      })
      .populate('cooperativeId', 'name description logo contactInfo')
      .sort({ joinedAt: -1 });

      res.json({
        message: 'User invitations retrieved successfully',
        invitations: invitations.map(membership => ({
          id: membership._id,
          cooperative: membership.cooperativeId,
          roleInCoop: membership.roleInCoop,
          status: membership.status,
          invitedAt: membership.joinedAt
        }))
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error retrieving invitations', 
        error: error.message 
      });
    }
  }
);

// Create a new cooperative (Only ADMIN can create cooperatives)
router.post('/', 
  auth, 
  authorizeRoles(ROLES.ADMIN),
  imageUploadMiddleware.cooperativeImages,
  handleMulterError,
  validateCooperative,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Process uploaded images
      const uploadedFiles = processUploadedFiles(req);
      
      const cooperativeData = {
        ...req.body,
        adminId: req.user._id,
        status: 'pending',
        verificationStatus: 'unverified',
      };

      // Set imageUrl if provided, otherwise use logo from images if available
      if (req.body.imageUrl) {
        cooperativeData.imageUrl = req.body.imageUrl;
      }

      // Add image URLs if uploaded
      if (uploadedFiles.logo && uploadedFiles.logo.length > 0) {
        cooperativeData.images = cooperativeData.images || {};
        cooperativeData.images.logo = uploadedFiles.logo[0].url;
      }
      
      if (uploadedFiles.banner && uploadedFiles.banner.length > 0) {
        cooperativeData.images = cooperativeData.images || {};
        cooperativeData.images.banner = uploadedFiles.banner[0].url;
      }
      
      if (uploadedFiles.gallery && uploadedFiles.gallery.length > 0) {
        cooperativeData.images = cooperativeData.images || {};
        cooperativeData.images.gallery = uploadedFiles.gallery.map(file => ({
          url: file.url,
          alt: req.body.galleryAlt || '',
          caption: req.body.galleryCaption || '',
          uploadedAt: file.uploadedAt
        }));
      }

      cooperativeData.cooperative_id = uuidv4();

      const cooperative = new Cooperative(cooperativeData);
      await cooperative.save();

      // Create membership for the admin
      

      res.status(201).json({
        message: 'Cooperative created successfully',
        cooperative: cooperative.getSummary(),
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error creating cooperative', 
        error: error.message 
      });
    }
  }
);

// Get cooperative by cooperative_id (foreign key lookup)
router.get('/by-id/:cooperative_id', 
  auth, 
  async (req, res) => {
    try {
      const cooperative = await Cooperative.findOne({ cooperative_id: req.params.cooperative_id })
        .populate('adminId', 'name email')
        .populate('verificationDocuments.verifiedBy', 'name');

      if (!cooperative) {
        return res.status(404).json({ message: 'Cooperative not found' });
      }

      // Hierarchy-based access control
      if (req.user.role === ROLES.ADMIN) {
        // Platform admin can view all cooperatives
      } else if (req.user.role === ROLES.COOPERATIVE_ADMIN) {
        // Cooperative admin can only view their own cooperative
        const membership = await Membership.findOne({
          cooperativeId: cooperative._id,
          userId: req.user._id,
          roleInCoop: 'admin',
          status: 'active'
        });
        
        if (!membership) {
          return res.status(403).json({ 
            message: 'Access denied. You can only view cooperatives you manage.' 
          });
        }
      }

      res.json({
        cooperative: cooperative.getSummary(),
        stats: cooperative.getStats(),
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error fetching cooperative', 
        error: error.message 
      });
    }
  }
);

// List all cooperatives (All authenticated users)
router.get('/', 
  auth, 
  async (req, res) => {
    try {
      const { page = 1, limit = 10, status, verificationStatus, cooperative_id } = req.query;
      
      const query = {};
      
      // Filter by cooperative_id if provided
      if (cooperative_id) {
        query.cooperative_id = cooperative_id;
      }
      
      // If user is not admin, only show active and verified cooperatives by default
      if (req.user.role !== ROLES.ADMIN) {
        query.status = status || 'active';
        query.verificationStatus = verificationStatus || 'verified';
      } else {
        // Admins can see all cooperatives by default, or apply custom filters
        if (status) query.status = status;
        if (verificationStatus) query.verificationStatus = verificationStatus;
        // If no filters specified, admin sees ALL cooperatives (no query restrictions)
      }

      const cooperatives = await Cooperative.find(query)
        .populate('adminId', 'name email')
        .populate('memberships')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });

      const total = await Cooperative.countDocuments(query);

      res.json({
        cooperatives,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total,
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error fetching cooperatives', 
        error: error.message 
      });
    }
  }
);

// View cooperative details
router.get('/:id', 
  auth, 
  async (req, res) => {
    try {
      const cooperative = await Cooperative.findById(req.params.id)
        .populate('adminId', 'name email')
        .populate('verificationDocuments.verifiedBy', 'name');

      if (!cooperative) {
        return res.status(404).json({ message: 'Cooperative not found' });
      }

      // Hierarchy-based access control
      if (req.user.role === ROLES.ADMIN) {
        // Platform admin can view all cooperatives
      } else if (req.user.role === ROLES.COOPERATIVE_ADMIN) {
        // Cooperative admin can only view their own cooperative
        const membership = await Membership.findOne({
          cooperativeId: req.params.id,
          userId: req.user._id,
          roleInCoop: 'admin',
          status: 'active'
        });
        
        if (!membership) {
          return res.status(403).json({ 
            message: 'Access denied. You can only view cooperatives you manage.' 
          });
        }
      } else {
        // Regular users (SELLER/BUYER) can view basic cooperative info
        // Only show public information
      }

      res.json({
        cooperative: cooperative.getSummary(),
        stats: await cooperative.getStats(),
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error fetching cooperative', 
        error: error.message 
      });
    }
  }
);

// Invite member to cooperative
router.post('/:id/invite', 
  auth, 
  validateMemberInvite,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const cooperativeId = req.params.id;

      // Hierarchy-based access control
      if (req.user.role === ROLES.ADMIN) {
        // Platform admin can invite to any cooperative
      } else if (req.user.role === ROLES.COOPERATIVE_ADMIN) {
        // Cooperative admin can only invite to their own cooperative
        const membership = await Membership.findOne({
          cooperativeId,
          userId: req.user._id,
          roleInCoop: 'admin',
          status: 'active'
        });
        
        if (!membership) {
          return res.status(403).json({ 
            message: 'Access denied. You can only invite members to cooperatives you manage.' 
          });
        }
      } else {
        return res.status(403).json({ 
          message: 'Access denied. Only administrators can invite members.' 
        });
      }

      const { email, roleInCoop } = req.body;

      // Check if cooperative exists
      const cooperative = await Cooperative.findById(cooperativeId);
      if (!cooperative) {
        return res.status(404).json({ message: 'Cooperative not found' });
      }

      // Check if user has access to this cooperative
      if (req.user.role === ROLES.COOPERATIVE_ADMIN) {
        const membership = await Membership.findOne({
          cooperativeId,
          userId: req.user._id,
        });
        
        if (!membership || !membership.isActive()) {
          return res.status(403).json({ 
            message: 'Access denied to this cooperative' 
          });
        }
      }

      // Find user by email
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check if user is already a member
      const existingMembership = await Membership.findOne({
        cooperativeId,
        userId: user._id,
      });

      if (existingMembership) {
        return res.status(400).json({ 
          message: 'User is already a member of this cooperative' 
        });
      }

      // Create membership invitation
      const membership = new Membership({
        cooperativeId,
        userId: user._id,
        roleInCoop,
        status: 'pending',
        joinedAt: new Date(),
      });

      await membership.save();

      res.status(201).json({
        message: 'Member invited successfully',
        membership: membership.getSummary(),
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error inviting member', 
        error: error.message 
      });
    }
  }
);

// Approve/Activate Cooperative (ADMIN only)
router.patch('/:id/approve', 
  auth, 
  authorizeRoles(ROLES.ADMIN),
  body('status').isIn(['active', 'suspended', 'inactive']).withMessage('Valid status is required'),
  body('verificationStatus').optional().isIn(['verified', 'rejected']).withMessage('Valid verification status is required'),
  body('reason').optional().trim(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const cooperativeId = req.params.id;
      const { status, verificationStatus, reason } = req.body;

      const cooperative = await Cooperative.findById(cooperativeId);
      if (!cooperative) {
        return res.status(404).json({ message: 'Cooperative not found' });
      }

      // Update status and verification
      cooperative.status = status;
      if (verificationStatus) {
        cooperative.verificationStatus = verificationStatus;
      }
      
      // Add approval metadata
      cooperative.approvedAt = new Date();
      cooperative.approvedBy = req.user._id;
      if (reason) {
        cooperative.approvalReason = reason;
      }

      await cooperative.save();

      res.json({
        message: `Cooperative ${status} successfully`,
        cooperative: cooperative.getSummary(),
        approvedBy: req.user._id,
        approvedAt: cooperative.approvedAt
      });
    } catch (error) {
      console.error('Approve cooperative error:', error);
      res.status(500).json({ 
        message: 'Error updating cooperative status', 
        error: error.message 
      });
    }
  }
);

// Assign Cooperative Administrator (ADMIN only)
router.post('/:id/assign-admin', 
  auth, 
  authorizeRoles(ROLES.ADMIN),
  body('userId').isMongoId().withMessage('Valid user ID is required'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const cooperativeId = req.params.id;
      const { userId } = req.body;

      // Check if cooperative exists
      const cooperative = await Cooperative.findById(cooperativeId);
      if (!cooperative) {
        return res.status(404).json({ message: 'Cooperative not found' });
      }

      // Check if user exists and has COOPERATIVE_ADMIN role
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (user.role !== ROLES.COOPERATIVE_ADMIN) {
        return res.status(400).json({ 
          message: 'User must have COOPERATIVE_ADMIN role to be assigned as cooperative administrator' 
        });
      }

      // Check if user is already an admin of this cooperative
      const existingMembership = await Membership.findOne({
        cooperativeId,
        userId,
        roleInCoop: 'admin'
      });

      if (existingMembership && existingMembership.status === 'active') {
        return res.status(400).json({ 
          message: 'User is already an administrator of this cooperative' 
        });
      }

      // Create or update membership
      let membership;
      if (existingMembership) {
        // Reactivate existing membership
        existingMembership.status = 'active';
        existingMembership.approvedAt = new Date();
        existingMembership.approvedBy = req.user._id;
        existingMembership.terminatedAt = null;
        existingMembership.terminatedBy = null;
        existingMembership.terminationReason = null;
        membership = existingMembership;
      } else {
        // Create new admin membership
        membership = new Membership({
          cooperativeId,
          userId,
          roleInCoop: 'admin',
          status: 'active',
          joinedAt: new Date(),
          approvedAt: new Date(),
          approvedBy: req.user._id,
        });
      }

      // Generate membership number if not exists
      if (!membership.membershipNumber) {
        const memberCount = await Membership.countDocuments({
          cooperativeId,
          status: 'active'
        });
        membership.membershipNumber = `${cooperative.name.substring(0, 3).toUpperCase()}${String(memberCount + 1).padStart(4, '0')}`;
      }

      await membership.save();

      // Update cooperative admin if this is the first admin
      if (!cooperative.adminId) {
        cooperative.adminId = userId;
        await cooperative.save();
      }

      // Update member count
      cooperative.membership.totalMembers = await Membership.countDocuments({
        cooperativeId,
        status: 'active'
      });
      await cooperative.save();

      res.json({
        message: 'Cooperative administrator assigned successfully',
        membership: {
          id: membership._id,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
          },
          cooperative: {
            id: cooperative._id,
            name: cooperative.name,
          },
          roleInCoop: membership.roleInCoop,
          status: membership.status,
          membershipNumber: membership.membershipNumber,
          joinedAt: membership.joinedAt,
          approvedBy: req.user._id
        }
      });
    } catch (error) {
      console.error('Assign admin error:', error);
      res.status(500).json({ 
        message: 'Error assigning cooperative administrator', 
        error: error.message 
      });
    }
  }
);

// View cooperative members (All authenticated users)
router.get('/:id/members', 
  auth, 
  async (req, res) => {
    try {
      const cooperativeId = req.params.id;
      const { page = 1, limit = 20, status, roleInCoop } = req.query;

      // Check if cooperative exists
      const cooperative = await Cooperative.findById(cooperativeId);
      if (!cooperative) {
        return res.status(404).json({ message: 'Cooperative not found' });
      }

      // Allow access to all authenticated users - no role restriction
      const query = { cooperativeId };
      
      // Non-admin users can only see active members by default
      if (req.user.role !== ROLES.ADMIN && req.user.role !== ROLES.COOPERATIVE_ADMIN) {
        query.status = status || 'active';
      } else {
        // Admins and cooperative admins can see all members with custom filters
        if (status) query.status = status;
      }
      
      if (roleInCoop) query.roleInCoop = roleInCoop;
      // console.log("Query",query);
      const memberships = await Membership.find(query)
        .populate('userId', 'name email profilePicture')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ joinedAt: -1 });

        console.log("Memberships",memberships);

      const total = await Membership.countDocuments(query);

      res.json({
        members: memberships.map(m => ({
          ...m.getSummary(),
          user: m.userId,
          verificationFields: m.verificationFields || null, // Include verification fields for review
        })),
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total,
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error fetching members', 
        error: error.message 
      });
    }
  }
);

// Get members by cooperative ID (query parameter)
router.get('/members/by-coop', 
  auth, 
  async (req, res) => {
    try {
      const { cooperativeId, page = 1, limit = 20, status, roleInCoop } = req.query;

      if (!cooperativeId) {
        return res.status(400).json({ message: 'Cooperative ID is required' });
      }

      // Check if cooperative exists
      const cooperative = await Cooperative.findById(cooperativeId);
      if (!cooperative) {
        return res.status(404).json({ message: 'Cooperative not found' });
      }

      // Build query
      const query = { cooperativeId };
      
      // Non-admin users can only see active members by default
      if (req.user.role !== ROLES.ADMIN && req.user.role !== ROLES.COOPERATIVE_ADMIN) {
        query.status = status || 'active';
      } else {
        // Admins and cooperative admins can see all members with custom filters
        if (status) query.status = status;
      }
      
      if (roleInCoop) query.roleInCoop = roleInCoop;

      const memberships = await Membership.find(query)
        .populate('userId', 'name email profilePicture')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ joinedAt: -1 });

      const total = await Membership.countDocuments(query);

      res.json({
        message: 'Cooperative members retrieved successfully',
        cooperative: {
          id: cooperative._id,
          name: cooperative.name,
          description: cooperative.description
        },
        members: memberships.map(m => ({
          ...m.getSummary(),

          user: m.userId,
          verificationFields: m.verificationFields || null, 
          _id: m._id,
          // Include verification fields for review
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalMembers: total,
          hasNext: page * limit < total,
          hasPrev: page > 1,
          limit: parseInt(limit)
        },
        filters: {
          status,
          roleInCoop
        }
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error fetching cooperative members', 
        error: error.message 
      });
    }
  }
);

// Update cooperative info by cooperative_id
router.patch('/by-id/:cooperative_id', 
  auth, 
  validateCooperative,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const cooperativeId = req.params.cooperative_id;

      // Check if cooperative exists
      const cooperative = await Cooperative.findOne({ cooperative_id: cooperativeId });
      if (!cooperative) {
        return res.status(404).json({ message: 'Cooperative not found' });
      }

      // Hierarchy-based access control
      if (req.user.role === ROLES.ADMIN) {
        // Platform admin can update any cooperative
      } else if (req.user.role === ROLES.COOPERATIVE_ADMIN) {
        // Cooperative admin can only update their own cooperative
        const membership = await Membership.findOne({
          cooperativeId: cooperative._id,
          userId: req.user._id,
          roleInCoop: 'admin',
          status: 'active'
        });
        
        if (!membership) {
          return res.status(403).json({ 
            message: 'Access denied. You can only update cooperatives you manage.' 
          });
        }
      } else {
        return res.status(403).json({ 
          message: 'Access denied. Only administrators can update cooperative information.' 
        });
      }

      // Update cooperative
      const updatedCooperative = await Cooperative.findOneAndUpdate(
        { cooperative_id: cooperativeId },
        { ...req.body, updatedAt: new Date() },
        { new: true, runValidators: true }
      );

      res.json({
        message: 'Cooperative updated successfully',
        cooperative: updatedCooperative.getSummary(),
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error updating cooperative', 
        error: error.message 
      });
    }
  }
);

// Update cooperative info by MongoDB _id
router.patch('/:id', 
  auth, 
  // validateCooperative,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const cooperativeId = req.params.id;

      // Check if cooperative exists
      const cooperative = await Cooperative.findById(cooperativeId);
      if (!cooperative) {
        return res.status(404).json({ message: 'Cooperative not found' });
      }

      // Hierarchy-based access control
      if (req.user.role === ROLES.ADMIN) {
        // Platform admin can update any cooperative
      } else if (req.user.role === ROLES.COOPERATIVE_ADMIN) {
        // Cooperative admin can only update their own cooperative
        const membership = await Membership.findOne({
          cooperativeId,
          userId: req.user._id,
          roleInCoop: 'admin',
          status: 'active'
        });
        
        if (!membership) {
          return res.status(403).json({ 
            message: 'Access denied. You can only update cooperatives you manage.' 
          });
        }
      } else {
        return res.status(403).json({ 
          message: 'Access denied. Only administrators can update cooperative information.' 
        });
      }

      // Update cooperative
      const updatedCooperative = await Cooperative.findByIdAndUpdate(
        cooperativeId,
        { ...req.body, updatedAt: new Date() },
        { new: true, runValidators: true }
      );

      console.log("Updated Cooperative",updatedCooperative);

      res.json({
        message: 'Cooperative updated successfully',
        cooperative: updatedCooperative.getSummary(),
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error updating cooperative', 
        error: error.message 
      });
    }
  }
);

// Remove cooperative by cooperative_id (Admin only)
router.delete('/by-id/:cooperative_id', 
  auth, 
  authorizeRoles(ROLES.ADMIN),
  async (req, res) => {
    try {
      const cooperativeId = req.params.cooperative_id;

      // Check if cooperative exists
      const cooperative = await Cooperative.findOne({ cooperative_id: cooperativeId });
      if (!cooperative) {
        return res.status(404).json({ message: 'Cooperative not found' });
      }

      // Check if cooperative has active members
      const activeMembers = await Membership.countDocuments({
        cooperativeId: cooperative._id,
        status: 'active',
      });

      if (activeMembers > 0) {
        return res.status(400).json({ 
          message: 'Cannot delete cooperative with active members' 
        });
      }

      // Delete cooperative and related data
      await Cooperative.findOneAndDelete({ cooperative_id: cooperativeId });
      await Membership.deleteMany({ cooperativeId: cooperative._id });

      res.json({ 
        message: 'Cooperative removed successfully',
        cooperative_id: cooperativeId 
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error removing cooperative', 
        error: error.message 
      });
    }
  }
);

// Remove cooperative by MongoDB _id (Admin only)
router.delete('/:id', 
  auth, 
  authorizeRoles(ROLES.ADMIN),
  async (req, res) => {
    try {
      const cooperativeId = req.params.id;

      // Check if cooperative exists
      const cooperative = await Cooperative.findById(cooperativeId);
      if (!cooperative) {
        return res.status(404).json({ message: 'Cooperative not found' });
      }

      // Check if cooperative has active members
      const activeMembers = await Membership.countDocuments({
        cooperativeId,
        status: 'active',
      });

      if (activeMembers > 0) {
        return res.status(400).json({ 
          message: 'Cannot delete cooperative with active members' 
        });
      }

      // Delete cooperative and related data
      await Cooperative.findByIdAndDelete(cooperativeId);
      await Membership.deleteMany({ cooperativeId });

      res.json({ message: 'Cooperative removed successfully' });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error removing cooperative', 
        error: error.message 
      });
    }
  }
);

// Get all products under a cooperative (Cooperative Admin only)
router.get('/:id/products', 
  auth, 
  async (req, res) => {
    try {
      const cooperativeId = req.params.id;
      const { 
        page = 1, 
        limit = 20, 
        status, 
        category, 
        subcategory,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        stockStatus,
        minPrice,
        maxPrice
      } = req.query;

      // Check if cooperative exists
      const cooperative = await Cooperative.findById(cooperativeId);
      if (!cooperative) {
        return res.status(404).json({ message: 'Cooperative not found' });
      }

      // Authorization: Only cooperative admins can access this endpoint
      // if (req.user.role === ROLES.ADMIN) {
      //   // Platform admin can view all cooperative products
      // } else if (req.user.role === ROLES.COOPERATIVE_ADMIN) {
      //   // Cooperative admin can only view products from their own cooperative
      //   const membership = await Membership.findOne({
      //     cooperativeId,
      //     userId: req.user._id,
      //     roleInCoop: { $in: ['admin', 'moderator'] },
      //     status: 'active'
      //   });
        
      //   if (!membership) {
      //     return res.status(403).json({ 
      //       message: 'Access denied. You can only view products from cooperatives you manage.' 
      //     });
      //   }
      // } else {
      //   return res.status(403).json({ 
      //     message: 'Access denied. Only cooperative administrators can view cooperative products.' 
      //   });
      // }

      // Build query
      const query = { cooperativeId };

      // Apply filters
      if (status) query.status = status;
      if (category) query.category = category;
      if (subcategory) query.subcategory = subcategory;
      if (stockStatus) query.stockStatus = stockStatus;
      
      // Price range filter
      if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = parseFloat(minPrice);
        if (maxPrice) query.price.$lte = parseFloat(maxPrice);
      }

      // Search functionality
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { tags: { $in: [new RegExp(search, 'i')] } }
        ];
      }

      // Sort configuration
      const sortConfig = {};
      sortConfig[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Execute query with pagination
      const products = await Product.find(query)
        .populate('sellerId', 'name email profilePicture')
        .populate('storeId', 'name description')
        .populate('reviewedBy', 'name')
        .sort(sortConfig)
        .limit(limit * 1)
        .skip((page - 1) * limit);

      // Get total count for pagination
      const total = await Product.countDocuments(query);

      // Get statistics
      const stats = await Product.aggregate([
        { $match: { cooperativeId: (cooperativeId) } },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            totalValue: { $sum: '$price' },
            totalStock: { $sum: '$inventory' },
            approvedProducts: {
              $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
            },
            pendingProducts: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
            },
            rejectedProducts: {
              $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
            },
            inStockProducts: {
              $sum: { $cond: [{ $eq: ['$stockStatus', 'In Stock'] }, 1, 0] }
            },
            outOfStockProducts: {
              $sum: { $cond: [{ $eq: ['$stockStatus', 'Out of Stock'] }, 1, 0] }
            },
            lowStockProducts: {
              $sum: { $cond: [{ $eq: ['$stockStatus', 'Low Stock'] }, 1, 0] }
            }
          }
        }
      ]);

      const cooperativeStats = stats.length > 0 ? stats[0] : {
        totalProducts: 0,
        totalValue: 0,
        totalStock: 0,
        approvedProducts: 0,
        pendingProducts: 0,
        rejectedProducts: 0,
        inStockProducts: 0,
        outOfStockProducts: 0,
        lowStockProducts: 0
      };

      res.json({
        message: 'Cooperative products retrieved successfully',
        cooperative: {
          id: cooperative._id,
          cooperative_id: cooperative.cooperative_id,
          name: cooperative.name,
          description: cooperative.description
        },
        products,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalProducts: total,
          hasNext: page * limit < total,
          hasPrev: page > 1,
          limit: parseInt(limit)
        },
        statistics: cooperativeStats,
        filters: {
          status,
          category,
          subcategory,
          stockStatus,
          minPrice,
          maxPrice,
          search
        }
      });
    } catch (error) {
      console.error('Error fetching cooperative products:', error);
      res.status(500).json({ 
        message: 'Error fetching cooperative products', 
        error: error.message 
      });
    }
  }
);

router.get('/:id/plans', 
  auth, 
  async (req, res) => {
    try {
      const cooperativeId = req.params.id;
      const membershipPlanTemplates = await MembershipPlanTemplate.find({ cooperativeId: cooperativeId });
      return res.json(membershipPlanTemplates);
    } catch (error) {
      res.status(500).json({ 
        message: 'Error fetching cooperative membership plan templates', 
        error: error.message 
      });
    }
  }
);

router.patch('/:id/plans/:planId', 
  auth, 
  async (req, res) => {
    try {
      const cooperativeId = req.params.id;
      console.log("Cooperative ID",cooperativeId);
      console.log("User ID",req.user._id);
      const isUserAdminOfCooperative = await Cooperative.findOne({ _id: cooperativeId, adminId: req.user._id });
      if (!isUserAdminOfCooperative) {
        return res.status(403).json({ 
          message: 'You are not authorized to update cooperative membership plan templates' 
        });
      }
      const membershipPlanTemplates = await MembershipPlanTemplate.findByIdAndUpdate(req.params.planId, {
        $set: req.body
      }, { new: true });
      return res.json(membershipPlanTemplates);
    }
    catch (error) {
      res.status(500).json({ 
        message: 'Error updating cooperative membership plan template', 
        error: error.message 
      });
    }
  }
);


router.delete('/:id/plans/:planId', 
  auth, 
  async (req, res) => {
    try {
      const cooperativeId = req.params.id;
      const isUserAdminOfCooperative = await Cooperative.findOne({ _id: cooperativeId, adminId: req.user._id });
      if (!isUserAdminOfCooperative) {
        return res.status(403).json({ 
          message: 'You are not authorized to delete cooperative membership plan templates' 
        });
      }
      const membershipPlanTemplates = await MembershipPlanTemplate.findByIdAndDelete(req.params.planId);
      return res.json(membershipPlanTemplates);
    }
    catch (error) {
      res.status(500).json({ 
        message: 'Error deleting cooperative membership plan template', 
        error: error.message 
      });
    }
  }
);


router.get('/:id/orders', 
  auth, 
  async (req, res) => {
    try {
      const cooperativeId = req.params.id;
      const AllUsersOfCooporative = await Membership.find({ cooperativeId: cooperativeId, roleInCoop: 'member' });
      const AllMembersIds = AllUsersOfCooporative.map(member => member.userId);
      const AllOrders = await Order.find({ userId: { $in: AllMembersIds } });
      res.json(AllOrders);
    } catch (error) {
      res.status(500).json({ 
        message: 'Error fetching cooperative orders', 
        error: error.message 
      });
    }
  }
);


// Get products by cooperative_id (foreign key lookup)
router.get('/by-id/:cooperative_id/products', 
  auth, 
  async (req, res) => {
    try {
      const cooperativeId = req.params.cooperative_id;
      const { 
        page = 1, 
        limit = 20, 
        status, 
        category, 
        subcategory,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        stockStatus,
        minPrice,
        maxPrice
      } = req.query;

      // Find cooperative by cooperative_id
      const cooperative = await Cooperative.findOne({ cooperative_id: cooperativeId });
      if (!cooperative) {
        return res.status(404).json({ message: 'Cooperative not found' });
      }

      // Authorization: Only cooperative admins can access this endpoint
      if (req.user.role === ROLES.ADMIN) {
        // Platform admin can view all cooperative products
      } else if (req.user.role === ROLES.COOPERATIVE_ADMIN) {
        // Cooperative admin can only view products from their own cooperative
        const membership = await Membership.findOne({
          cooperativeId: cooperative._id,
          userId: req.user._id,
          roleInCoop: { $in: ['admin', 'moderator'] },
          status: 'active'
        });
        
        if (!membership) {
          return res.status(403).json({ 
            message: 'Access denied. You can only view products from cooperatives you manage.' 
          });
        }
      } else {
        return res.status(403).json({ 
          message: 'Access denied. Only cooperative administrators can view cooperative products.' 
        });
      }

      // Build query using the MongoDB _id
      const query = { cooperativeId: cooperative._id };

      // Apply filters
      if (status) query.status = status;
      if (category) query.category = category;
      if (subcategory) query.subcategory = subcategory;
      if (stockStatus) query.stockStatus = stockStatus;
      
      // Price range filter
      if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = parseFloat(minPrice);
        if (maxPrice) query.price.$lte = parseFloat(maxPrice);
      }

      // Search functionality
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { tags: { $in: [new RegExp(search, 'i')] } }
        ];
      }

      // Sort configuration
      const sortConfig = {};
      sortConfig[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Execute query with pagination
      const products = await Product.find(query)
        .populate('sellerId', 'name email profilePicture')
        .populate('storeId', 'name description')
        .populate('reviewedBy', 'name')
        .sort(sortConfig)
        .limit(limit * 1)
        .skip((page - 1) * limit);

      // Get total count for pagination
      const total = await Product.countDocuments(query);

      // Get statistics
      const stats = await Product.aggregate([
        { $match: { cooperativeId: mongoose.Types.ObjectId(cooperative._id) } },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            totalValue: { $sum: '$price' },
            totalStock: { $sum: '$inventory' },
            approvedProducts: {
              $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
            },
            pendingProducts: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
            },
            rejectedProducts: {
              $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
            },
            inStockProducts: {
              $sum: { $cond: [{ $eq: ['$stockStatus', 'In Stock'] }, 1, 0] }
            },
            outOfStockProducts: {
              $sum: { $cond: [{ $eq: ['$stockStatus', 'Out of Stock'] }, 1, 0] }
            },
            lowStockProducts: {
              $sum: { $cond: [{ $eq: ['$stockStatus', 'Low Stock'] }, 1, 0] }
            }
          }
        }
      ]);

      const cooperativeStats = stats.length > 0 ? stats[0] : {
        totalProducts: 0,
        totalValue: 0,
        totalStock: 0,
        approvedProducts: 0,
        pendingProducts: 0,
        rejectedProducts: 0,
        inStockProducts: 0,
        outOfStockProducts: 0,
        lowStockProducts: 0
      };

      res.json({
        message: 'Cooperative products retrieved successfully',
        cooperative: {
          id: cooperative._id,
          cooperative_id: cooperative.cooperative_id,
          name: cooperative.name,
          description: cooperative.description
        },
        products,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalProducts: total,
          hasNext: page * limit < total,
          hasPrev: page > 1,
          limit: parseInt(limit)
        },
        statistics: cooperativeStats,
        filters: {
          status,
          category,
          subcategory,
          stockStatus,
          minPrice,
          maxPrice,
          search
        }
      });
    } catch (error) {
      console.error('Error fetching cooperative products:', error);
      res.status(500).json({ 
        message: 'Error fetching cooperative products', 
        error: error.message 
      });
    }
  }
);


// ========================
// CASE 1: Member Request to Join Cooperative
// ========================

// Request to join a cooperative with loan plan (for buyers/sellers)
router.post('/:id/join', 
  auth, 
  body('loanPlanId').isMongoId().withMessage('Valid loan plan ID is required'),
  body('paymentMethod').isIn(['card', 'bank_transfer', 'mobile_money', 'wallet']).withMessage('Valid payment method is required'),
  body('autoRenewal').optional().isBoolean().withMessage('Auto renewal must be boolean'),
  body('verificationFields.nextOfKin.fullName').trim().notEmpty().withMessage('Next of kin full name is required'),
  body('verificationFields.nextOfKin.relationship').trim().notEmpty().withMessage('Next of kin relationship is required'),
  body('verificationFields.nextOfKin.phoneNumber').trim().notEmpty().withMessage('Next of kin phone number is required'),
  body('verificationFields.bankDetails.accountName').trim().notEmpty().withMessage('Bank account name is required'),
  body('verificationFields.bankDetails.accountNumber').trim().notEmpty().withMessage('Bank account number is required'),
  body('verificationFields.bankDetails.bankName').trim().notEmpty().withMessage('Bank name is required'),
  body('verificationFields.bvn').trim().notEmpty().withMessage('BVN is required'),
  body('verificationFields.documents').optional().isArray().withMessage('Documents must be an array'),
  body('verificationFields.documents.*.type').optional().isIn(['registration', 'tax_id', 'bank_statement', 'identity', 'address_proof', 'other']).withMessage('Invalid document type'),
  body('verificationFields.documents.*.url').optional().isURL().withMessage('Document URL must be valid'),
  body('verificationFields.documents.*.fileName').optional().trim().notEmpty().withMessage('Document file name is required'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const cooperativeId = req.params.id;
      const userId = req.user._id;
      const { loanPlanId, paymentMethod, autoRenewal = true, verificationFields } = req.body;

      // Check if cooperative exists and is active
      const cooperative = await Cooperative.findById(cooperativeId);
      if (!cooperative) {
        return res.status(404).json({ message: 'Cooperative not found' });
      }

      if (cooperative.status !== 'active') {
        return res.status(400).json({ 
          message: 'Cannot join inactive cooperative' 
        });
      }

      // Check if membership plan template exists and belongs to this cooperative
      const MembershipPlanTemplate = require('../models/MembershipPlanTemplate');
      const membershipPlanTemplate = await MembershipPlanTemplate.findById(loanPlanId);
      if (!membershipPlanTemplate) {
        return res.status(404).json({ message: 'Membership plan template not found' });
      }

      if (!membershipPlanTemplate.isActive) {
        return res.status(400).json({ message: 'Membership plan template is not active' });
      }

      if (membershipPlanTemplate.cooperativeId.toString() !== cooperativeId) {
        return res.status(400).json({ 
          message: 'Membership plan template does not belong to this cooperative' 
        });
      }

      // Check if user is already a member or has pending request
      const existingMembership = await Membership.findOne({
        cooperativeId,
        userId,
      });

      if (existingMembership) {
        const statusMessage = {
          'active': 'You are already a member of this cooperative',
          'pending': 'You already have a pending request to join this cooperative',
          'suspended': 'Your membership is suspended',
          'terminated': 'Your membership was terminated'
        };
        
        return res.status(400).json({ 
          message: statusMessage[existingMembership.status] || 'You are already associated with this cooperative'
        });
      }

      // Check if user already has an active membership plan with this cooperative
      const MembershipPlan = require('../models/MembershipPlan');
      const existingMembershipPlan = await MembershipPlan.findOne({
        userId,
        cooperativeId,
        status: 'active',
      });

      if (existingMembershipPlan) {
        return res.status(400).json({ 
          message: 'You already have an active membership plan with this cooperative' 
        });
      }

      // Create membership
      const memberCount = await Membership.countDocuments({
        cooperativeId,
        status: 'active'
      });
      // console.log({
      //   nextOfKin: verificationFields.nextOfKin,
      //   bankDetails: verificationFields.bankDetails,
      //   bvn: verificationFields.bvn,
      //   status: 'pending', // Set to pending for verification
      //   documents: verificationFields.documents || [] // Include documents array
      // })
      const membership = new Membership({
        verificationFields: {
          nextOfKin: verificationFields.nextOfKin,
          bankDetails: verificationFields.bankDetails,
          bvn: verificationFields.bvn,
          status: 'pending', // Set to pending for verification
          documents: verificationFields.documents || [] // Include documents array
        },
        cooperativeId,
        userId,
        roleInCoop: 'member',
        status: 'pending', // Set to pending for verification
        joinedAt: new Date(),
        membershipNumber: `${cooperative.name.substring(0, 3).toUpperCase()}${String(memberCount + 1).padStart(4, '0')}`,
      });


      // Calculate billing dates
      const startDate = new Date();
      const nextBillingDate = new Date();
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

      // Create membership plan
      const membershipPlan = new MembershipPlan({
        userId,
        cooperativeId,
        membershipPlanTemplateId: loanPlanId,
        planDetails: {
          name: membershipPlanTemplate.name,
          category: membershipPlanTemplate.category,
          monthlyFee: membershipPlanTemplate.pricing.monthlyFee,
          loanAccess: membershipPlanTemplate.loanAccess,
          benefits: membershipPlanTemplate.benefits,
          features: membershipPlanTemplate.features.filter(f => f.included),
        },
        billing: {
          startDate,
          nextBillingDate,
          currency: membershipPlanTemplate.pricing.currency,
        },
        autoRenewal: {
          enabled: autoRenewal,
        },
      });

      membership.membershipPlanId = membershipPlan._id;
      await membership.save();

      console.log(membership);


      // Process initial payment (simulate payment processing)
      const totalAmount = membershipPlanTemplate.pricing.monthlyFee + (membershipPlanTemplate.pricing.setupFee || 0);
      const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await membershipPlan.processPayment(
        totalAmount,
        paymentMethod,
        transactionId,
        `Initial payment for ${membershipPlanTemplate.name} plan`
      );

      // Auto-upgrade user to cooperative tier if they're freemium
      if (req.user.userTier === 'freemium') {
        req.user.upgradeTier('cooperative');
        await req.user.save();
      }

      // Auto-upgrade user to SELLER role when joining cooperative (if they're currently BUYER)
      if (req.user.role === ROLES.BUYER) {
        req.user.role = ROLES.SELLER;
        await req.user.save();
      }

      // Update cooperative member count
      cooperative.membership.totalMembers = await Membership.countDocuments({
        cooperativeId,
        status: 'active'
      });
      cooperative.membership.activeMembers = cooperative.membership.totalMembers;
      await cooperative.save();

      res.status(201).json({
        message: 'Cooperative membership request submitted successfully! Your application is pending verification.',
        membership: {
          id: membership._id,
          cooperativeId: membership.cooperativeId,
          status: membership.status,
          roleInCoop: membership.roleInCoop,
          membershipNumber: membership.membershipNumber,
          joinedAt: membership.joinedAt,
          verificationFields: membership.verificationFields, // Include complete verification fields
          verificationStatus: membership.verificationFields.status
        },
        membershipPlan: membershipPlan.getSummary(),
        membershipPlanTemplate: membershipPlanTemplate.getSummary(),
        payment: {
          amount: totalAmount,
          transactionId,
          nextBillingDate,
        },
        verification: {
          status: 'pending',
          message: 'Your membership application is pending verification. You will be notified once approved.'
        }
      });
    } catch (error) {
      console.error('Join cooperative error:', error);
      res.status(500).json({ 
        message: 'Error joining cooperative', 
        error: error.message 
      });
    }
  }
);

// Get user's membership plan for a cooperative
router.get('/:id/my-membership-plan', 
  auth, 
  async (req, res) => {
    try {
      const cooperativeId = req.params.id;
      const userId = req.user._id;

      // Check if cooperative exists
      const cooperative = await Cooperative.findById(cooperativeId);
      if (!cooperative) {
        return res.status(404).json({ message: 'Cooperative not found' });
      }

      // Get user's membership plan
      const MembershipPlan = require('../models/MembershipPlan');
      const membershipPlan = await MembershipPlan.findOne({
        userId,
        cooperativeId,
        status: 'active',
      }).populate('membershipPlanTemplateId');

      if (!membershipPlan) {
        return res.status(404).json({ 
          message: 'No active membership plan found for this cooperative' 
        });
      }

      res.json({
        message: 'Membership plan retrieved successfully',
        membershipPlan: membershipPlan.getSummary(),
        membershipPlanTemplate: membershipPlan.membershipPlanTemplateId,
        cooperative: {
          id: cooperative._id,
          name: cooperative.name,
        },
      });
    } catch (error) {
      console.error('Get membership plan error:', error);
      res.status(500).json({ 
        message: 'Error retrieving membership plan', 
        error: error.message 
      });
    }
  }
);

// Cancel membership plan
router.patch('/:id/cancel-membership-plan', 
  auth, 
  body('reason').optional().trim().isLength({ max: 500 }).withMessage('Reason must be less than 500 characters'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const cooperativeId = req.params.id;
      const userId = req.user._id;

      // Get user's membership plan
      const MembershipPlan = require('../models/MembershipPlan');
      const membershipPlan = await MembershipPlan.findOne({
        userId,
        cooperativeId,
        status: 'active',
      });

      if (!membershipPlan) {
        return res.status(404).json({ 
          message: 'No active membership plan found for this cooperative' 
        });
      }

      // Check for active loans
      if (membershipPlan.loanUsage.currentActiveLoans > 0) {
        return res.status(400).json({ 
          message: 'Cannot cancel membership plan while you have active loans' 
        });
      }

      // Cancel the plan
      membershipPlan.status = 'cancelled';
      membershipPlan.cancellation = {
        cancelledAt: new Date(),
        cancelledBy: userId,
        reason: req.body.reason || 'User requested cancellation',
      };
      membershipPlan.autoRenewal.enabled = false;

      await membershipPlan.save();

      res.json({
        message: 'Membership plan cancelled successfully',
        membershipPlan: membershipPlan.getSummary(),
      });
    } catch (error) {
      console.error('Cancel membership plan error:', error);
      res.status(500).json({ 
        message: 'Failed to cancel membership plan',
        error: error.message 
      });
    }
  }
);

// Get pending join requests for a cooperative (COOPERATIVE_ADMIN only)
router.get('/:id/pending-requests', 
  auth, 
  authorizeRoles(ROLES.COOPERATIVE_ADMIN),
  async (req, res) => {
    try {
      const cooperativeId = req.params.id;
      const { page = 1, limit = 10 } = req.query;

      // Check if cooperative exists
      const cooperative = await Cooperative.findById(cooperativeId);
      if (!cooperative) {
        return res.status(404).json({ message: 'Cooperative not found' });
      }

      // Check if user has access to this cooperative
      const adminMembership = await Membership.findOne({
        cooperativeId,
        userId: req.user._id,
        roleInCoop: { $in: ['admin', 'moderator'] },
        status: 'active'
      });
      
      if (!adminMembership) {
        return res.status(403).json({ 
          message: 'Access denied to this cooperative' 
        });
      }

      // Get pending requests with pagination
      const pendingRequests = await Membership.find({
        cooperativeId,
        status: 'pending'
      })
      .populate('userId', 'name email role')
      .sort({ joinedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

      const totalPending = await Membership.countDocuments({
        cooperativeId,
        status: 'pending'
      });

      res.json({
        message: 'Pending join requests retrieved successfully',
        requests: pendingRequests.map(membership => ({
          id: membership._id,
          user: membership.userId,
          roleInCoop: membership.roleInCoop,
          requestedAt: membership.joinedAt,
          status: membership.status
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalPending / limit),
          totalRequests: totalPending,
          hasNext: page * limit < totalPending,
          hasPrev: page > 1
        }
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error retrieving pending requests', 
        error: error.message 
      });
    }
  }
);

// Approve/Reject join request (COOPERATIVE_ADMIN only)
router.patch('/:id/membership/:membershipId/status', 
  auth, 
  authorizeRoles(ROLES.COOPERATIVE_ADMIN),
  body('action').isIn(['approve', 'reject']).withMessage('Action must be approve or reject'),
  body('reason').optional().trim(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { action, reason , docVerification, nextKinStatus } = req.body;
      const cooperativeId = req.params.id;
      const membershipId = req.params.membershipId;

      // Check if cooperative exists
      const cooperative = await Cooperative.findById(cooperativeId);
      if (!cooperative) {
        return res.status(404).json({ message: 'Cooperative not found' });
      }

      // Find the membership request
      const membership = await Membership.findOne({
        _id: membershipId,
        cooperativeId
      }).populate('userId', 'name email');

      if (!membership) {
        return res.status(404).json({ message: 'Membership request not found' });
      }

      if (membership.status !== 'pending') {
        return res.status(400).json({ 
          message: `Cannot ${action} membership with status: ${membership.status}` 
        });
      }

      // Check if user has access to this cooperative
      const adminMembership = await Membership.findOne({
        cooperativeId,
        userId: req.user._id,
        roleInCoop: { $in: ['admin', 'moderator'] },
        status: 'active'
      });
      
      if (!adminMembership) {
        return res.status(403).json({ 
          message: 'Access denied to this cooperative' 
        });
      }

      // Update membership status
      if (action === 'approve') {
        membership.status = 'active';
        membership.approvedAt = new Date();
        membership.approvedBy = req.user._id;
        
        // Generate membership number
        const memberCount = await Membership.countDocuments({
          cooperativeId,
          status: 'active'
        });
        membership.membershipNumber = `${cooperative.name.substring(0, 3).toUpperCase()}${String(memberCount + 1).padStart(4, '0')}`;
        
        // Auto-upgrade user to cooperative tier if they're a buyer/seller
        const user = await User.findById(membership.userId._id);
        if (user && user.userTier === 'freemium') {
          user.upgradeTier('cooperative');
          await user.save();
        }
      } else {
        membership.status = 'terminated';
        membership.terminatedAt = new Date();
        membership.terminatedBy = req.user._id;
        membership.terminationReason = reason || `Join request ${action}ed`;
      }

      if (docVerification){
        membership.verificationFields.documents = membership.verificationFields.documents.map(doc=>{
          if (docVerification.find(d=>d.id === doc._id.toString())){
            doc.status = docVerification.find(d=>d.id === doc._id.toString()).status;
          }
          return doc;
        })

      }

      if (nextKinStatus){
        membership.verificationFields.nextOfKin.status = nextKinStatus;
      }

      await membership.save();

      // Update cooperative member count
      if (action === 'approve') {
        cooperative.membership.totalMembers = await Membership.countDocuments({
          cooperativeId,
          status: 'active'
        });
        await cooperative.save();
      }

      res.json({
        message: `Membership request ${action}ed successfully`,
        membership: {
          id: membership._id,
          user: membership.userId,
          status: membership.status,
          roleInCoop: membership.roleInCoop,
          approvedAt: membership.approvedAt,
          approvedBy: membership.approvedBy,
          membershipNumber: membership.membershipNumber
        }
      });
    } catch (error) {
      res.status(500).json({ 
        message: `Error ${req.body.action}ing membership request`, 
        error: error.message 
      });
    }
  }
);

// Approve/Reject join request by membershipNumber (COOPERATIVE_ADMIN only)
router.patch('/:id/membership/by-number/:membershipNumber/status', 
  auth, 
  authorizeRoles(ROLES.COOPERATIVE_ADMIN),
  body('action').isIn(['approve', 'reject']).withMessage('Action must be approve or reject'),
  body('reason').optional().trim(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { action, reason } = req.body;
      const cooperativeId = req.params.id;
      const membershipNumber = req.params.membershipNumber;

      console.log('Membership status update request:', {
        cooperativeId,
        membershipNumber,
        action,
        userRole: req.user.role,
        userId: req.user._id
      });

      // Check if cooperative exists
      const cooperative = await Cooperative.findById(cooperativeId);
      if (!cooperative) {
        return res.status(404).json({ message: 'Cooperative not found' });
      }

      // Find the membership by membershipNumber and cooperativeId
      const membership = await Membership.findOne({
        membershipNumber: membershipNumber,
        cooperativeId
      }).populate('userId', 'name email');

      if (!membership) {
        return res.status(404).json({ 
          message: `Membership with number ${membershipNumber} not found in this cooperative` 
        });
      }

      console.log('Found membership:', {
        membershipId: membership._id,
        membershipNumber: membership.membershipNumber,
        currentStatus: membership.status,
        userId: membership.userId._id
      });

      if (membership.status !== 'pending') {
        return res.status(400).json({ 
          message: `Cannot ${action} membership with status: ${membership.status}. Only pending memberships can be approved or rejected.` 
        });
      }

      // Check if user has access to this cooperative
      const adminMembership = await Membership.findOne({
        cooperativeId,
        userId: req.user._id,
        roleInCoop: { $in: ['admin', 'moderator'] },
        status: 'active'
      });
      
      if (!adminMembership) {
        return res.status(403).json({ 
          message: 'Access denied to this cooperative' 
        });
      }

      // Update membership status
      if (action === 'approve') {
        membership.status = 'active';
        membership.approvedAt = new Date();
        membership.approvedBy = req.user._id;
        
        // Auto-upgrade user to cooperative tier if they're a buyer/seller
        const user = await User.findById(membership.userId._id);
        if (user && user.userTier === 'freemium') {
          user.upgradeTier('cooperative');
          await user.save();
        }
      } else {
        membership.status = 'terminated';
        membership.terminatedAt = new Date();
        membership.terminatedBy = req.user._id;
        membership.terminationReason = reason || `Join request ${action}ed`;
      }

      await membership.save();

      // Update cooperative member count
      if (action === 'approve') {
        cooperative.membership.totalMembers = await Membership.countDocuments({
          cooperativeId,
          status: 'active'
        });
        cooperative.membership.activeMembers = cooperative.membership.totalMembers;
        await cooperative.save();
      }

      console.log('Membership updated successfully:', {
        membershipId: membership._id,
        newStatus: membership.status,
        approvedAt: membership.approvedAt,
        approvedBy: membership.approvedBy
      });

      res.json({
        message: `Membership request ${action}ed successfully`,
        membership: {
          id: membership._id,
          membershipNumber: membership.membershipNumber,
          user: membership.userId,
          status: membership.status,
          roleInCoop: membership.roleInCoop,
          approvedAt: membership.approvedAt,
          approvedBy: membership.approvedBy,
          terminatedAt: membership.terminatedAt,
          terminationReason: membership.terminationReason
        }
      });
    } catch (error) {
      console.error('Error updating membership status:', error);
      res.status(500).json({ 
        message: `Error ${req.body.action}ing membership request`, 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

// ========================
// CASE 2: Accept/Reject Invitations
// ========================

// Get user's invitations


// Accept/Reject invitation
router.patch('/invitations/:membershipId/respond', 
  auth, 
  body('action').isIn(['accept', 'reject']).withMessage('Action must be accept or reject'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { action } = req.body;
      const membershipId = req.params.membershipId;
      const userId = req.user._id;

      const cooperative = await Cooperative.find({
        adminId: userId
      });
      const cooperativeIds = cooperative.map(c => c._id);
      // Find the invitation
      const membership = await Membership.findOne({
        _id: membershipId,
        cooperativeId: { $in: cooperativeIds },
        status: 'pending'
      }).populate('cooperativeId');

      if (!membership) {
        return res.status(404).json({ 
          message: 'Invitation not found or already responded to' 
        });
      }

      if (action === 'accept') {
        membership.status = 'active';
        membership.approvedAt = new Date();
        membership.approvedBy = userId; // Self-approved
        
        // Generate membership number
        const memberCount = await Membership.countDocuments({
          cooperativeId: membership.cooperativeId._id,
          status: 'active'
        });
        membership.membershipNumber = `${membership.cooperativeId.name.substring(0, 3).toUpperCase()}${String(memberCount + 1).padStart(4, '0')}`;
        
        // Auto-upgrade user to cooperative tier if they're freemium
        const user = await User.findById(userId);
        if (user && user.userTier === 'freemium') {
          user.upgradeTier('cooperative');
          await user.save();
        }

        // Update cooperative member count
        const cooperative = await Cooperative.findById(membership.cooperativeId._id);
        cooperative.membership.totalMembers = await Membership.countDocuments({
          cooperativeId: membership.cooperativeId._id,
          status: 'active'
        });
        await cooperative.save();
      } else {
        membership.status = 'terminated';
        membership.terminatedAt = new Date();
        membership.terminatedBy = userId;
        membership.terminationReason = 'Invitation rejected by user';
      }

      await membership.save();

      res.json({
        message: `Invitation ${action}ed successfully`,
        membership: {
          id: membership._id,
          cooperative: membership.cooperativeId,
          status: membership.status,
          roleInCoop: membership.roleInCoop,
          membershipNumber: membership.membershipNumber
        }
      });
    } catch (error) {
      res.status(500).json({ 
        message: `Error ${req.body.action}ing invitation`, 
        error: error.message 
      });
    }
  }
);

// ========================
// CASE 3: Admin Override
// ========================

// Admin: Force add member to cooperative
router.post('/:id/admin/add-member', 
  auth, 
  authorizeRoles(ROLES.ADMIN),
  body('userId').isMongoId().withMessage('Valid user ID is required'),
  body('roleInCoop').isIn(['member', 'admin', 'moderator', 'treasurer', 'secretary']).withMessage('Valid role is required'),
  body('reason').optional().trim(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId, roleInCoop, reason } = req.body;
      const cooperativeId = req.params.id;

      // Check if cooperative exists
      const cooperative = await Cooperative.findById(cooperativeId);
      if (!cooperative) {
        return res.status(404).json({ message: 'Cooperative not found' });
      }

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check if user is already a member
      const existingMembership = await Membership.findOne({
        cooperativeId,
        userId,
      });

      if (existingMembership && existingMembership.status === 'active') {
        return res.status(400).json({ 
          message: 'User is already an active member of this cooperative' 
        });
      }

      // Create or update membership
      let membership;
      if (existingMembership) {
        // Update existing membership
        membership = existingMembership;
        membership.status = 'active';
        membership.roleInCoop = roleInCoop;
        membership.approvedAt = new Date();
        membership.approvedBy = req.user._id;
        membership.terminatedAt = null;
        membership.terminatedBy = null;
        membership.terminationReason = null;
      } else {
        // Create new membership
        membership = new Membership({
          cooperativeId,
          userId,
          roleInCoop,
          status: 'active',
          joinedAt: new Date(),
          approvedAt: new Date(),
          approvedBy: req.user._id,
        });
      }

      // Generate membership number if not exists
      if (!membership.membershipNumber) {
        const memberCount = await Membership.countDocuments({
          cooperativeId,
          status: 'active'
        });
        membership.membershipNumber = `${cooperative.name.substring(0, 3).toUpperCase()}${String(memberCount + 1).padStart(4, '0')}`;
      }

      await membership.save();

      // Auto-upgrade user to cooperative tier if they're freemium
      if (user.userTier === 'freemium') {
        user.upgradeTier('cooperative');
        await user.save();
      }

      // Update cooperative member count
      cooperative.membership.totalMembers = await Membership.countDocuments({
        cooperativeId,
        status: 'active'
      });
      await cooperative.save();

      res.status(201).json({
        message: 'Member added to cooperative successfully (Admin override)',
        membership: {
          id: membership._id,
          user: {
            id: user._id,
            name: user.name,
            email: user.email
          },
          cooperative: {
            id: cooperative._id,
            name: cooperative.name
          },
          roleInCoop: membership.roleInCoop,
          status: membership.status,
          membershipNumber: membership.membershipNumber,
          joinedAt: membership.joinedAt,
          approvedBy: membership.approvedBy
        },
        adminAction: {
          performedBy: req.user._id,
          reason: reason || 'Admin override - direct member addition',
          timestamp: new Date()
        }
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error adding member to cooperative', 
        error: error.message 
      });
    }
  }
);

// Admin: Force remove member from cooperative
router.delete('/:id/admin/remove-member/:userId', 
  auth, 
  authorizeRoles(ROLES.ADMIN),
  body('reason').optional().trim(),
  async (req, res) => {
    try {
      const cooperativeId = req.params.id;
      const userId = req.params.userId;
      const { reason } = req.body;

      // Find the membership
      const membership = await Membership.findOne({
        cooperativeId,
        userId,
        status: 'active'
      }).populate('userId', 'name email')
       .populate('cooperativeId', 'name');

      if (!membership) {
        return res.status(404).json({ 
          message: 'Active membership not found' 
        });
      }

      // Terminate membership
      membership.status = 'terminated';
      membership.terminatedAt = new Date();
      membership.terminatedBy = req.user._id;
      membership.terminationReason = reason || 'Admin override - forced removal';

      await membership.save();

      // Update cooperative member count
      const cooperative = await Cooperative.findById(cooperativeId);
      cooperative.membership.totalMembers = await Membership.countDocuments({
        cooperativeId,
        status: 'active'
      });
      await cooperative.save();

      res.json({
        message: 'Member removed from cooperative successfully (Admin override)',
        membership: {
          id: membership._id,
          user: membership.userId,
          cooperative: membership.cooperativeId,
          status: membership.status,
          terminatedAt: membership.terminatedAt,
          terminationReason: membership.terminationReason
        },
        adminAction: {
          performedBy: req.user._id,
          reason: reason || 'Admin override - forced removal',
          timestamp: new Date()
        }
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error removing member from cooperative', 
        error: error.message 
      });
    }
  }
);

module.exports = router;
