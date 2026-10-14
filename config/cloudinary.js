const cloudinary = require("cloudinary").v2;

// Read credentials from CLOUDINARY_URL
cloudinary.config();

module.exports = cloudinary;