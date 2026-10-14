
const multer = require("multer");
const path = require("path");
const { CloudinaryStorage } = require("multer-storage-cloudinary-v2");
const cloudinary = require("./cloudinary");

// ==========================================
// IMAGE FILE FILTER
// ==========================================
const imageFilter = (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) {
        cb(null, true);
    } else {
        cb(new Error("Only images are allowed!"), false);
    }
};

// ==========================================
// PET IMAGES - CLOUDINARY STORAGE
// ==========================================
const petCloudinaryStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: "pawpon/pets",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        resource_type: "image"
    }
});

const uploadPet = multer({
    storage: petCloudinaryStorage,
    fileFilter: imageFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // Maximum 5 MB
    }
});

/* ==========================================
   ADOPTER AVATARS - CLOUDINARY STORAGE
========================================== */

const avatarFilter = (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png"];

    if (allowedTypes.includes(file.mimetype)) {
        return cb(null, true);
    }

    cb(new Error("Avatar must be a JPG or PNG image."), false);
};

const avatarCloudinaryStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: "pawpon/avatars",
        allowed_formats: ["jpg", "jpeg", "png"],
        resource_type: "image"
    }
});

const uploadAvatar = multer({
    storage: avatarCloudinaryStorage,
    fileFilter: avatarFilter,
    limits: {
        fileSize: 2 * 1024 * 1024 // 2 MB
    }
});

/* ==========================================
   ADOPTION ID PROOFS - CLOUDINARY STORAGE
========================================== */

const adoptionDocumentFilter = (req, file, cb) => {
    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf"
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(
            new Error("ID proof must be a JPG, PNG, WEBP, or PDF file."),
            false
        );
    }
};

const adoptionDocumentStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: "pawpon/adoption-documents",
        resource_type: "auto",
        allowed_formats: ["jpg", "jpeg", "png", "webp", "pdf"]
    }
});

const uploadAdoptionDocument = multer({
    storage: adoptionDocumentStorage,
    fileFilter: adoptionDocumentFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB
    }
});

// ==========================================
// ORGANIZATION PROFILE PICTURES - LOCAL STORAGE
// Kept as in your original code
// ==========================================
const orgStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "public/uploads/orgs/");
    },
    filename: (req, file, cb) => {
        const uniqueSuffix =
            Date.now() + "-" + Math.round(Math.random() * 1E9);

        cb(
            null,
            "org-" +
                (req.session?.accountId || "user") +
                "-" +
                uniqueSuffix +
                path.extname(file.originalname)
        );
    }
});

const uploadOrgPic = multer({
    storage: orgStorage,
    fileFilter: imageFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

// ==========================================
// QR CODES - LOCAL STORAGE
// Kept as in your original code
// ==========================================
const qrStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/qr/");
    },
    filename: (req, file, cb) => {
        const uniqueSuffix =
            Date.now() + "-" + Math.round(Math.random() * 1E9);

        cb(
            null,
            "qr-" +
                (req.session?.accountId || "user") +
                "-" +
                uniqueSuffix +
                path.extname(file.originalname)
        );
    }
});

const uploadQR = multer({
    storage: qrStorage,
    fileFilter: imageFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

// ==========================================
// DROP-OFF DETAILS - LOCAL STORAGE
// Kept as in your original code
// ==========================================
const dropoffStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/dropoff/");
    },
    filename: (req, file, cb) => {
        const uniqueSuffix =
            Date.now() + "-" + Math.round(Math.random() * 1E9);

        cb(
            null,
            "dropoff-" +
                (req.session?.accountId || "user") +
                "-" +
                uniqueSuffix +
                path.extname(file.originalname)
        );
    }
});

const uploadDropoff = multer({
    storage: dropoffStorage,
    fileFilter: imageFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

// ==========================================
// EXPORT UPLOAD MIDDLEWARE
// ==========================================
module.exports = {
    uploadPet,
    uploadOrgPic,
    uploadQR,
    uploadDropoff,
    uploadAdoptionDocument,
    uploadAvatar
};
