const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { authorizePermissions, authorizeOwnership } = require('../middleware/authorize');
const { PERMISSIONS } = require('../config/roles');
const Testimonial = require('../models/Testimonial');

const router = express.Router();

// Validation middleware
const validateTestimonial = [
  body('text')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Testimonial must be between 10 and 1000 characters'),
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
];

// Create testimonial
router.post(
  '/',
  auth,
  authorizePermissions(PERMISSIONS.CREATE_TESTIMONIAL),
  validateTestimonial,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const testimonial = new Testimonial({
        userId: req.user._id,
        text: req.body.text,
        rating: req.body.rating,
      });

      await testimonial.save();
      await testimonial.populate('userId', 'name email');

      res.status(201).json(testimonial);
    } catch (error) {
      res.status(500).json({ message: 'Error creating testimonial', error: error.message });
    }
  }
);

// Get all testimonials
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = 'createdAt', order = 'desc' } = req.query;

    const testimonials = await Testimonial.find()
      .populate('userId', 'name email')
      .sort({ [sort]: order })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Testimonial.countDocuments();

    res.json({
      testimonials,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalTestimonials: total,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching testimonials', error: error.message });
  }
});

// Get testimonial by ID
router.get('/:id', async (req, res) => {
  try {
    const testimonial = await Testimonial.findById(req.params.id)
      .populate('userId', 'name email');

    if (!testimonial) {
      return res.status(404).json({ message: 'Testimonial not found' });
    }

    res.json(testimonial);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching testimonial', error: error.message });
  }
});

// Update testimonial
router.put(
  '/:id',
  auth,
  authorizePermissions(PERMISSIONS.UPDATE_TESTIMONIAL),
  authorizeOwnership('userId'),
  validateTestimonial,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const testimonial = await Testimonial.findOneAndUpdate(
        { _id: req.params.id, userId: req.user._id },
        {
          text: req.body.text,
          rating: req.body.rating,
          updatedAt: Date.now(),
        },
        { new: true, runValidators: true }
      ).populate('userId', 'name email');

      if (!testimonial) {
        return res.status(404).json({ message: 'Testimonial not found' });
      }

      res.json(testimonial);
    } catch (error) {
      res.status(500).json({ message: 'Error updating testimonial', error: error.message });
    }
  }
);

// Delete testimonial
router.delete(
  '/:id',
  auth,
  authorizePermissions(PERMISSIONS.DELETE_TESTIMONIAL),
  authorizeOwnership('userId'),
  async (req, res) => {
    try {
      const testimonial = await Testimonial.findOneAndDelete({
        _id: req.params.id,
        userId: req.user._id,
      });

      if (!testimonial) {
        return res.status(404).json({ message: 'Testimonial not found' });
      }

      res.json({ message: 'Testimonial deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting testimonial', error: error.message });
    }
  }
);

// Get user's testimonials
router.get(
  '/user/my-testimonials',
  auth,
  authorizePermissions(PERMISSIONS.READ_TESTIMONIAL),
  async (req, res) => {
    try {
      const testimonials = await Testimonial.find({ userId: req.user._id })
        .sort({ createdAt: -1 });

      res.json(testimonials);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching user testimonials', error: error.message });
    }
  }
);

module.exports = router; 