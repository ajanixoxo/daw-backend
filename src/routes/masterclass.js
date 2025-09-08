const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Masterclass = require('../models/Masterclass');

const router = express.Router();

// Validation middleware
const validateMasterclass = [
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title must be between 1 and 200 characters'),
  body('description').trim().isLength({ min: 1, max: 1000 }).withMessage('Description must be between 1 and 1000 characters'),
  body('instructor').trim().isLength({ min: 1 }).withMessage('Instructor name is required'),
  body('videoUrl').isURL().withMessage('Valid video URL is required'),
  body('duration').isInt({ min: 1 }).withMessage('Duration must be a positive number'),
  body('category').isIn(['Business', 'Marketing', 'Finance', 'Technology', 'Leadership', 'Skills', 'Agriculture', 'Crafts', 'Other']).withMessage('Invalid category'),
  body('level').isIn(['Beginner', 'Intermediate', 'Advanced']).withMessage('Invalid level'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
];

// GET /api/masterclass - Get all masterclasses (with filtering and pagination)
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      level,
      status = 'published',
      search,
      sortBy = 'publishedAt',
      sortOrder = 'desc',
      isFree,
      instructor,
    } = req.query;

    // Build filter object
    const filter = {};
    
    // Only show published masterclasses to non-admin users
    if (!req.user || req.user.role !== 'admin') {
      filter.status = 'published';
    } else if (status) {
      filter.status = status;
    }

    if (category) filter.category = category;
    if (level) filter.level = level;
    if (isFree !== undefined) filter.isFree = isFree === 'true';
    if (instructor) filter.instructor = new RegExp(instructor, 'i');

    // Text search
    if (search) {
      filter.$text = { $search: search };
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const masterclasses = await Masterclass.find(filter)
      .populate('createdBy', 'name email')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
;

    const total = await Masterclass.countDocuments(filter);

    res.json({
      masterclasses,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalMasterclasses: total,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/masterclass/:id - Get single masterclass
router.get('/:id', async (req, res) => {
  try {
    const masterclass = await Masterclass.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!masterclass) {
      return res.status(404).json({ message: 'Masterclass not found' });
    }

    // Check if user can view this masterclass
    if (masterclass.status !== 'published' && 
        (!req.user || (req.user.role !== 'admin' && masterclass.createdBy._id.toString() !== req.user._id.toString()))) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(masterclass);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST /api/masterclass - Create new masterclass (Admin/Cooperative Admin only)
router.post('/', auth, validateMasterclass, async (req, res) => {
  try {
    // Check permissions
    if (!['admin', 'cooperative_admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Admin or Cooperative Admin role required.' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const masterclassData = {
      ...req.body,
      createdBy: req.user._id,
      isFree: req.body.price === 0 || req.body.price === '0',
    };

    const masterclass = new Masterclass(masterclassData);
    await masterclass.save();

    await masterclass.populate('createdBy', 'name email');

    res.status(201).json({
      message: 'Masterclass created successfully',
      masterclass,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PUT /api/masterclass/:id - Update masterclass
router.put('/:id', auth, validateMasterclass, async (req, res) => {
  try {
    const masterclass = await Masterclass.findById(req.params.id);

    if (!masterclass) {
      return res.status(404).json({ message: 'Masterclass not found' });
    }

    // Check permissions
    if (req.user.role !== 'admin' && masterclass.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const updateData = {
      ...req.body,
      isFree: req.body.price === 0 || req.body.price === '0',
    };

    const updatedMasterclass = await Masterclass.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');

    res.json({
      message: 'Masterclass updated successfully',
      masterclass: updatedMasterclass,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// DELETE /api/masterclass/:id - Delete masterclass
router.delete('/:id', auth, async (req, res) => {
  try {
    const masterclass = await Masterclass.findById(req.params.id);

    if (!masterclass) {
      return res.status(404).json({ message: 'Masterclass not found' });
    }

    // Check permissions
    if (req.user.role !== 'admin' && masterclass.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await Masterclass.findByIdAndDelete(req.params.id);

    res.json({ message: 'Masterclass deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;