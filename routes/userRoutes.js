const express = require("express");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const { fileTypeFromFile } = require("file-type");
const router = express.Router();
const userController = require("../controllers/userController");
const matchmakerController = require("../controllers/matchmakerController");
const { matchPets } = require("../controllers/matchmakerController");
const { csrfSynchronisedProtection } = require("../middleware/csrf");
const pool = require('../config/database');
const {uploadAdoptionDocument,  uploadAvatar} = require("../config/upload");
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = "uploads/avatars/"; 
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir); 
    },
    filename: function (req, file, cb) {
        const accountId = req.session?.accountId || "unknown";
        cb(null, `avatar-${accountId}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, 
    fileFilter: function (req, file, cb) {
        if (!file.mimetype.startsWith("image/")) {
            return cb(new Error("Only image files are allowed!"), false);
        }
        cb(null, true);
    }
});

async function validateAvatarFile(file) {
  if (!file || !file.path) {
      return false;
  }

  const detectedType = await fileTypeFromFile(file.path);

  if (!detectedType) {
      return false;
  }

  const allowedMimeTypes = [
      "image/jpeg",
      "image/png"
  ];

  return allowedMimeTypes.includes(detectedType.mime);
}

// Setup Multer storage para sa Donation Receipts
const receiptStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = "uploads/receipts/";
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const accountId = req.session?.accountId || "guest";
        cb(null, `receipt-${accountId}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const uploadReceipt = multer({
    storage: receiptStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB Limit
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimeType = allowedTypes.test(file.mimetype);

        if (extName && mimeType) {
            return cb(null, true);
        }
        cb(new Error("Only images (JPG, PNG) and PDF files are allowed!"));
    }
});

const docStorage = multer.diskStorage({
  destination: function (req, file, cb) {
      const dir = "uploads/documents/";
      if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
      }
      cb(null, dir);
  },
  filename: function (req, file, cb) {
      const accountId = req.session?.accountId || "guest";
      cb(null, `doc-${accountId}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const uploadDoc = multer({
  storage: docStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB Limit
  fileFilter: function (req, file, cb) {
      const allowedTypes = /jpeg|jpg|png|pdf/;
      const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimeType = allowedTypes.test(file.mimetype);

      if (extName && mimeType) {
          return cb(null, true);
      }
      cb(new Error("Only images (JPG, PNG) and PDF files are allowed!"));
  }
});
// Idagdag itong storage configuration sa userRouter.js
const kamustahanStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = "uploads/kamustahan/";
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, `kamustahan-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const uploadKamustahan = multer({ storage: kamustahanStorage });

function checkUserSession(req, res, next) {
    const isApi = req.originalUrl.startsWith("/api/");

    // 1. Walang session
    if (!req.session.accountId) {
        if (isApi) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Please log in."
            });
        }
        return res.redirect("/auth/login");
    }

    // 2. Role check — adopter lang
    if (req.session.role !== "adopter") {
        if (isApi) {
            return res.status(403).json({
                success: false,
                message: "Forbidden. This resource is for adopters only."
            });
        }
        // HTML page → redirect sa tamang dashboard
        if (req.session.role === "organization") {
            return res.redirect("/org/dashboard");
        }
        if (req.session.role === "admin") {
            return res.redirect("/admin/dashboard");
        }
        return res.redirect("/auth/login");
    }

    next();
}
router.get("/api/pets", checkUserSession, userController.getAvailablePets);
router.get("/api/pets/:id", checkUserSession, userController.getPetById);
router.get("/api/user/favorites", checkUserSession, userController.getPetFavorites);
router.post("/api/user/favorites", checkUserSession, csrfSynchronisedProtection, userController.addPetFavorite);
router.delete("/api/user/favorites/:animalId", checkUserSession, csrfSynchronisedProtection, userController.removePetFavorite);
router.post("/api/matchmaking/repair",checkUserSession,matchmakerController.repairBehavior);
router.post( "/api/matchmaking", checkUserSession, matchmakerController.matchPets);
router.get("/dashboard", checkUserSession, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/user/userDashboard.html"));
});
router.get("/sidebar", checkUserSession, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/user/userSidebar.html"));
}); 
router.get("/header", checkUserSession, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/user/userHeader.html"));
});
router.get("/adoption-hub", checkUserSession, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/user/adoptionHub.html"));
});
router.get("/matchmaker", checkUserSession, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/user/matchmaker.html"));
});
router.get("/application", checkUserSession, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/user/application.html"));
});
router.get("/donation", checkUserSession, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/user/donation.html"));
});
router.get("/cash-donation", checkUserSession, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/user/cash-donation.html"));
});
router.get("/inkind-donation", checkUserSession, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/user/inkind-donation.html"));
});
router.get("/kamustahan", checkUserSession, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/user/kamustahan.html"));
});
router.get("/feedback", checkUserSession, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/user/feedback.html"));
});
router.post("/api/feedback", checkUserSession, userController.submitFeedback);
router.get("/profile", checkUserSession, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/user/userProfile.html"));
}); 

router.get("/api/user/applications", checkUserSession, userController.getUserApplications);
router.get("/api/user/donations", checkUserSession, userController.getUserDonations);
router.get("/api/user/profile", checkUserSession, userController.getProfile);
router.post("/api/user/profile/update", checkUserSession, userController.updateProfile);
router.post("/api/user/profile/password", checkUserSession, userController.updatePassword);
router.post("/api/user/profile/verify-password", checkUserSession, userController.verifyPassword);
// Avatar route — keep only this one
router.post( "/api/user/profile/avatar", checkUserSession, uploadAvatar.single("avatar"), userController.updateAvatar );
router.get("/api/organizations", checkUserSession, userController.getOrganizations);
router.post( "/api/user/donation/cash", checkUserSession, uploadReceipt.single("receipt"), userController.submitCashDonation);
router.post('/api/user/donation/in-kind', checkUserSession, userController.submitInKindDonation);
router.get("/api/user/approved-pets", checkUserSession, userController.getApprovedAdoptedPets);
router.get("/api/user/kamustahan-history", checkUserSession, userController.getKamustahanHistory);
router.post("/api/user/kamustahan", checkUserSession, uploadKamustahan.single("photos"), userController.submitKamustahanUpdate);

router.post(
    "/api/adoptions/submit-application",
    checkUserSession,
    (req, res, next) => {
        uploadAdoptionDocument.single("document")(req, res, (err) => {
            if (err) {
                return res.status(400).json({
                    status: "error",
                    message: err.message || "Invalid file uploaded."
                });
            }

            next();
        });
    },
    userController.submitAdoptionApplication
);

router.get('/check-applied/:petId', checkUserSession, userController.checkAppliedStatus);


router.patch('/api/user/applications/:id/cancel', checkUserSession, userController.cancelAdoptionApplication);


router.get("/api/user/recent-activities", checkUserSession, userController.getUserRecentActivities);


router.get("/api/user/upcoming-schedules", checkUserSession, userController.getUserUpcomingSchedules);

router.get("/api/organizations/:id", checkUserSession,  userController.getOrganizationById);

router.put('/api/user/kamustahan/:id', checkUserSession, uploadKamustahan.single('photos'), async (req, res) => {
    try {
        const updateId = req.params.id;
        const { update_text } = req.body;
        
        // Gamitin ang pool na naka-export sa itaas
        if (req.file) {
            const photoPath = `/uploads/kamustahan/${req.file.filename}`;
            await pool.query(
                'UPDATE kamustahan_updates SET update_text = ?, photos = ? WHERE update_id = ?', 
                [update_text, photoPath, updateId]
            );
        } else {
            await pool.query(
                'UPDATE kamustahan_updates SET update_text = ? WHERE update_id = ?', 
                [update_text, updateId]
            );
        }

        res.json({ success: true, message: 'Update successfully modified.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

router.get("/api/user/kamustahan-due", checkUserSession, userController.getKamustahanDue);

module.exports = router;
