const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { authorizeRoles, authorizeOwnership } = require('../middleware/authorize');
const { imageUploadMiddleware, processUploadedFiles, handleMulterError } = require('../middleware/imageUpload');
const { ROLES } = require('../config/roles');
const Cooperative = require('../models/Cooperative');
const Membership = require('../models/Membership');
const User = require('../models/User');

const router = express.Router();

// Validation middleware
const validateCooperative = [
  body('name').trim().notEmpty().withMessage('Cooperative name is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('imageUrl').optional().trim().isURL().withMessage('Invalid image URL format'),
  body('contactInfo.phone').optional().trim(),
  body('contactInfo.email').optional().isEmail().withMessage('Invalid email format'),
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

      const cooperative = new Cooperative(cooperativeData);
      await cooperative.save();

      // Create membership for the admin
      const membership = new Membership({
        cooperativeId: cooperative._id,
        userId: req.user._id,
        roleInCoop: 'admin',
        status: 'active',
        joinedAt: new Date(),
        approvedAt: new Date(),
        approvedBy: req.user._id,
      });
      await membership.save();

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

// List all cooperatives (All authenticated users)
router.get('/', 
  auth, 
  async (req, res) => {
    try {
      const { page = 1, limit = 10, status, verificationStatus } = req.query;
      
      const query = {};
      
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

      const memberships = await Membership.find(query)
        .populate('userId', 'name email profilePicture')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ joinedAt: -1 });

      const total = await Membership.countDocuments(query);

      res.json({
        members: memberships.map(m => ({
          ...m.getSummary(),
          user: m.userId,
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

// Update cooperative info
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

// Remove cooperative (Admin only)
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

// ========================
// CASE 1: Member Request to Join Cooperative
// ========================

// Request to join a cooperative (for buyers/sellers)
router.post('/:id/join', 
  auth, 
  async (req, res) => {
    try {
      const cooperativeId = req.params.id;
      const userId = req.user._id;

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

      // Create active membership (direct join, no approval required)
      const memberCount = await Membership.countDocuments({
        cooperativeId,
        status: 'active'
      });
      
      const membership = new Membership({
        cooperativeId,
        userId,
        roleInCoop: 'member',
        status: 'active', // Direct active status
        joinedAt: new Date(),
        approvedAt: new Date(), // Auto-approved
        approvedBy: userId, // Self-approved
        membershipNumber: `${cooperative.name.substring(0, 3).toUpperCase()}${String(memberCount + 1).padStart(4, '0')}`,
      });

      await membership.save();

      // Auto-upgrade user to cooperative tier if they're freemium
      if (req.user.userTier === 'freemium') {
        req.user.upgradeTier('cooperative');
        await req.user.save();
      }

      // Update cooperative member count (active members only)
      cooperative.membership.totalMembers = await Membership.countDocuments({
        cooperativeId,
        status: 'active'
      });
      cooperative.membership.activeMembers = cooperative.membership.totalMembers;
      await cooperative.save();

      res.status(201).json({
        message: 'Successfully joined cooperative! Welcome to the community.',
        membership: {
          id: membership._id,
          cooperativeId: membership.cooperativeId,
          status: membership.status,
          roleInCoop: membership.roleInCoop,
          membershipNumber: membership.membershipNumber,
          joinedAt: membership.joinedAt,
          approvedAt: membership.approvedAt
        },
        userTierUpgrade: req.user.userTier === 'cooperative' ? 'Upgraded to cooperative tier with full benefits' : null
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Error submitting join request', 
        error: error.message 
      });
    }
  }
);

// Get pending join requests for a cooperative (Coop Admin + Admin)
router.get('/:id/pending-requests', 
  auth, 
  authorizeRoles(ROLES.COOPERATIVE_ADMIN, ROLES.ADMIN),
  async (req, res) => {
    try {
      const cooperativeId = req.params.id;
      const { page = 1, limit = 10 } = req.query;

      // Check if cooperative exists
      const cooperative = await Cooperative.findById(cooperativeId);
      if (!cooperative) {
        return res.status(404).json({ message: 'Cooperative not found' });
      }

      // Check if user has access to this cooperative (if not admin)
      if (req.user.role === ROLES.COOPERATIVE_ADMIN) {
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

// Approve/Reject join request (Hierarchy-based access)
router.patch('/:id/membership/:membershipId/status', 
  auth, 
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
      const membershipId = req.params.membershipId;

      // Check if cooperative exists
      const cooperative = await Cooperative.findById(cooperativeId);
      if (!cooperative) {
        return res.status(404).json({ message: 'Cooperative not found' });
      }

      // Hierarchy-based access control
      if (req.user.role === ROLES.ADMIN) {
        // Platform admin can approve/reject for any cooperative
      } else if (req.user.role === ROLES.COOPERATIVE_ADMIN) {
        // Cooperative admin can only approve/reject for their own cooperative
        const adminMembership = await Membership.findOne({
          cooperativeId,
          userId: req.user._id,
          roleInCoop: 'admin',
          status: 'active'
        });
        
        if (!adminMembership) {
          return res.status(403).json({ 
            message: 'Access denied. You can only manage membership requests for cooperatives you manage.' 
          });
        }
      } else {
        return res.status(403).json({ 
          message: 'Access denied. Only administrators can manage membership requests.' 
        });
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

      // Check if user has access to this cooperative (if not admin)
      if (req.user.role === ROLES.COOPERATIVE_ADMIN) {
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

// ========================
// CASE 2: Accept/Reject Invitations
// ========================

// Get user's invitations
router.get('/my-invitations', 
  auth, 
  async (req, res) => {
    try {
      const userId = req.user._id;
      const { status = 'pending' } = req.query;

      const invitations = await Membership.find({
        userId,
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

      // Find the invitation
      const membership = await Membership.findOne({
        _id: membershipId,
        userId,
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
