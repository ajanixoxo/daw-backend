const mongoose = require('mongoose');

const masterclassSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
    },
    description: {
        type: String,
        required: true,
        maxlength: 1000,
    },
    instructor: {
        type: String,
        required: true,
        trim: true,
    },
    instructorBio: {
        type: String,
        maxlength: 500,
    },
    videoUrl: {
        type: String,
        required: true,
    },
    thumbnailUrl: {
        type: String,
    },
    duration: {
        type: Number, // Duration in minutes
        required: true,
        min: 1,
    },
    category: {
        type: String,
        required: true,
        enum: ['Business', 'Marketing', 'Finance', 'Technology', 'Leadership', 'Skills', 'Agriculture', 'Crafts', 'Other'],
    },
    level: {
        type: String,
        required: true,
        enum: ['Beginner', 'Intermediate', 'Advanced'],
    },
    price: {
        type: Number,
        required: true,
        min: 0,
        default: 0, // 0 for free masterclasses
    },
    isFree: {
        type: Boolean,
        default: true,
    },
    tags: [{
        type: String,
        trim: true,
    }],
    status: {
        type: String,
        enum: ['draft', 'published', 'archived'],
        default: 'draft',
    },
    publishedAt: {
        type: Date,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
}, {
    timestamps: true,
});

// Index for better search performance
masterclassSchema.index({ title: 'text', description: 'text', instructor: 'text', tags: 'text' });
masterclassSchema.index({ category: 1, level: 1, status: 1 });
masterclassSchema.index({ createdBy: 1 });
masterclassSchema.index({ publishedAt: -1 });

// Set publishedAt when status changes to published
masterclassSchema.pre('save', function (next) {
    if (this.status === 'published' && !this.publishedAt) {
        this.publishedAt = new Date();
    }
    next();
});

const Masterclass = mongoose.model('Masterclass', masterclassSchema);

module.exports = Masterclass;