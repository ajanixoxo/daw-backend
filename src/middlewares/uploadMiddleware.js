const multer = require("multer");
const AppError = require("@utils/Error/AppError.js");

// Memory storage for seller onboarding (files uploaded to Cloudinary, not disk)
const memoryStorage = multer.memoryStorage();

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per file
const ALLOWED_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf"
];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(`Invalid file type: ${file.mimetype}. Allowed: images and PDF`, 400), false);
  }
};

/**
 * Multer config for seller onboarding (multipart form).
 * Fields: shopLogo, shopBanner, idDocument, proofOfResidence, businessCac, passportPhotograph
 * All optional for multer; controller validates required documents.
 */
const sellerOnboardUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter
}).fields([
  { name: "shopLogo", maxCount: 1 },
  { name: "shopBanner", maxCount: 1 },
  { name: "idDocument", maxCount: 1 },
  { name: "proofOfResidence", maxCount: 1 },
  { name: "businessCac", maxCount: 1 },
  { name: "passportPhotograph", maxCount: 1 }
]);

const IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
];

const imageFileFilter = (req, file, cb) => {
  if (IMAGE_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(`Invalid file type: ${file.mimetype}. Only images are allowed.`, 400), false);
  }
};

/**
 * Multer config for product image uploads.
 * Field: images (up to 4 files)
 */
const productImagesUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: imageFileFilter
}).array("images", 4);

/**
 * Multer config for shop edit (logo and banner only).
 */
const shopEditUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: imageFileFilter
}).fields([
  { name: "shopLogo", maxCount: 1 },
  { name: "shopBanner", maxCount: 1 }
]);

module.exports = {
  shopEditUpload,
  profileUpload: multer({
    storage: memoryStorage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: imageFileFilter,
  }).single("profilePicture"),
  sellerOnboardUpload,
  productImagesUpload,
};
