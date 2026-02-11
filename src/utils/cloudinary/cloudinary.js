const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
const AppError = require("@utils/Error/AppError.js");

// Configure from env (call once at app load)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload a file buffer to Cloudinary.
 * @param {Buffer} buffer - File buffer (e.g. from multer memoryStorage)
 * @param {object} options - { folder?: string, resource_type?: 'image'|'raw'|'auto', publicIdPrefix?: string }
 * @returns {Promise<{ secure_url: string, public_id: string }>}
 */
function uploadBuffer(buffer, options = {}) {
  const { folder = "daw", resource_type = "auto", publicIdPrefix } = options;

  return new Promise((resolve, reject) => {
    const uploadOptions = { folder, resource_type };
    if (publicIdPrefix) {uploadOptions.public_id = publicIdPrefix;}

    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (err, result) => {
        if (err) {
          reject(new AppError(err.message || "Cloudinary upload failed", 502));
          return;
        }
        if (!result || !result.secure_url) {
          reject(new AppError("Cloudinary returned no URL", 502));
          return;
        }
        resolve({ secure_url: result.secure_url, public_id: result.public_id });
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

module.exports = {
  cloudinary,
  uploadBuffer
};
