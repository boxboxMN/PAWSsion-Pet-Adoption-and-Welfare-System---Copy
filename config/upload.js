
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

/* ==========================================
   ORGANIZATION PROFILE PICTURES - CLOUDINARY
========================================== */
const orgCloudinaryStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: "pawpon/org-profiles",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        resource_type: "image"
    }
});
const uploadOrgPic = multer({
    storage: orgCloudinaryStorage,
    fileFilter: imageFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB
    }
});
/* ==========================================
   QR CODES - CLOUDINARY STORAGE
========================================== */
const qrCloudinaryStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: "pawpon/qr-codes",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        resource_type: "image"
    }
});

const uploadQR = multer({
    storage: qrCloudinaryStorage,
    fileFilter: imageFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB
    }
});

/* ==========================================
   DROP-OFF DETAILS - CLOUDINARY STORAGE
========================================== */
const dropoffCloudinaryStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: "pawpon/dropoff",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        resource_type: "image"
    }
});

const uploadDropoff = multer({
    storage: dropoffCloudinaryStorage,
    fileFilter: imageFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB
    }
});
const inkindProofStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = "uploads/inkind-proof/";
        // Ensure the folder exists (safe even if called repeatedly)
        const fs = require("fs");
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const who = req.session?.accountId || "guest";
        cb(null, "inkind-" + who + "-" + uniqueSuffix + path.extname(file.originalname));
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
    uploadAvatar,
    uploadDropoff: uploadDropoff ,
     uploadInkindProof: multer({ storage: inkindProofStorage, fileFilter: imageFilter }) 

};
