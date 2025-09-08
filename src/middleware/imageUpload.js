const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let subfolder = 'misc';
    
    // Determine subfolder based on the route
    if (req.route.path.includes('cooperative')) {
      subfolder = 'cooperatives';
    } else if (req.route.path.includes('product')) {
      subfolder = 'products';
    } else if (req.route.path.includes('store')) {
      subfolder = 'stores';
    }
    
    const fullPath = path.join(uploadDir, subfolder);
    
    // Create subfolder if it doesn't exist
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
    
    cb(null, fullPath);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const timestamp = Date.now();
    const randomNum = Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = `${file.fieldname}_${timestamp}_${randomNum}${ext}`;
    cb(null, filename);
  }
});

// File filter for images only
const fileFilter = (req, file, cb) => {
  // Check if file is an image
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

// Middleware for different upload scenarios
const imageUploadMiddleware = {
  // Single image upload
  single: (fieldName) => upload.single(fieldName),
  
  // Multiple images upload
  array: (fieldName, maxCount = 10) => upload.array(fieldName, maxCount),
  
  // Multiple fields with different names
  fields: (fields) => upload.fields(fields),
  
  // For cooperative images (logo, banner, gallery)
  cooperativeImages: upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'banner', maxCount: 1 },
    { name: 'gallery', maxCount: 10 }
  ]),
  
  // For product images (main image + gallery)
  productImages: upload.fields([
    { name: 'imageUrl', maxCount: 1 },
    { name: 'images', maxCount: 10 }
  ]),
  
  // For store images (logo, banner, gallery)
  storeImages: upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'banner', maxCount: 1 },
    { name: 'gallery', maxCount: 10 }
  ])
};

// Helper function to process uploaded files and return URLs
const processUploadedFiles = (req) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const processedFiles = {};
  
  if (req.files) {
    // Handle multiple fields
    Object.keys(req.files).forEach(fieldName => {
      const files = req.files[fieldName];
      if (Array.isArray(files)) {
        processedFiles[fieldName] = files.map(file => ({
          url: `${baseUrl}/uploads/${path.basename(path.dirname(file.path))}/${file.filename}`,
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          uploadedAt: new Date()
        }));
      }
    });
  } else if (req.file) {
    // Handle single file
    const file = req.file;
    processedFiles.single = {
      url: `${baseUrl}/uploads/${path.basename(path.dirname(file.path))}/${file.filename}`,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      uploadedAt: new Date()
    };
  }
  
  return processedFiles;
};

// Error handling middleware for multer
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: 'File too large. Maximum size is 5MB.',
        code: 'FILE_TOO_LARGE'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        message: 'Too many files uploaded.',
        code: 'TOO_MANY_FILES'
      });
    }
    return res.status(400).json({
      message: 'File upload error: ' + error.message,
      code: 'UPLOAD_ERROR'
    });
  }
  
  if (error.message === 'Only image files are allowed!') {
    return res.status(400).json({
      message: 'Only image files are allowed. Supported formats: JPG, PNG, GIF, WebP.',
      code: 'INVALID_FILE_TYPE'
    });
  }
  
  next(error);
};

// Serve static files middleware
const serveStaticImages = (req, res, next) => {
  // This will be handled by express.static in server.js
  next();
};

module.exports = {
  imageUploadMiddleware,
  processUploadedFiles,
  handleMulterError,
  serveStaticImages,
  upload
};
