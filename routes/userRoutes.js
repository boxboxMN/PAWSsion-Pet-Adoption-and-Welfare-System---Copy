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
const { logActivity, createNotification } = require("../controllers/adminController"); 

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

router.post(
    "/api/user/profile/email-change/send-otp",
    checkUserSession,
    userController.sendProfileEmailChangeOtp
);

router.post(
    "/api/user/profile/email-change/verify-otp",
    checkUserSession,
    userController.verifyProfileEmailChangeOtp
);

router.post("/api/user/profile/update", checkUserSession, userController.updateProfile);
router.post("/api/user/profile/password", checkUserSession, userController.updatePassword);
router.post("/api/user/profile/verify-password", checkUserSession, userController.verifyPassword);
// Avatar route — keep only this one
// router.post( "/api/user/profile/avatar", checkUserSession, uploadAvatar.single("avatar"), userController.updateAvatar );
router.post(
  "/api/user/profile/avatar",
  checkUserSession,
  (req, res, next) => {
      uploadAvatar.single("avatar")(req, res, async (err) => {

          if (err instanceof multer.MulterError) {
              return res.status(400).json({
                  success: false,
                  error: err.message
              });
          }

          if (err) {
              return res.status(400).json({
                  success: false,
                  error: err.message
              });
          }

          try {
              const isValidFile = await validateAvatarFile(req.file);

              if (!isValidFile) {
                  if (req.file?.path) {
                      fs.unlink(req.file.path, () => {});
                  }

                  return res.status(400).json({
                      success: false,
                      error: "Invalid file content. Please upload a valid JPG or PNG image."
                  });
              }

              next();

          } catch (error) {
              console.error("Avatar file validation error:", error);

              if (req.file?.path) {
                  fs.unlink(req.file.path, () => {});
              }

              return res.status(400).json({
                  success: false,
                  error: "Unable to validate the uploaded file."
              });
          }
      });
  },
  userController.updateAvatar
);

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
router.post('/api/adopter/request-return', checkUserSession, async (req, res) => {
    try {
        const { pet_id, reason, details } = req.body; 
        const accountId = req.session.accountId; // Ito ay 3

        if (!pet_id || !reason || !details) {
            return res.status(400).json({ success: false, message: 'Missing required fields.' });
        }

        // 1. Kunin ang tamang adopter_id (1) gamit ang account_id (3)
        const [adopterRows] = await pool.query(
            `SELECT adopter_id FROM adopters WHERE account_id = ?`,
            [accountId]
        );

        if (adopterRows.length === 0) {
            return res.status(403).json({ success: false, message: 'Adopter profile not found.' });
        }

        const adopterId = adopterRows[0].adopter_id;

        // 2. I-verify kung talagang adopted ng user ang pet AT kunin ang organization_id
        const [adoption] = await pool.query(
            `SELECT app.application_id, a.organization_id 
             FROM user_adoption_applications app
             JOIN animals a ON app.animal_id = a.animal_id
             WHERE app.animal_id = ? AND app.adopter_id = ? AND app.status = 'Approved'`, 
            [pet_id, adopterId]
        );

        if (adoption.length === 0) {
            return res.status(403).json({ success: false, message: 'Pet not found in your adopted list.' });
        }

        const organizationId = adoption[0].organization_id;

        // 3. I-save ang return request sa database 
        await pool.query(
            `INSERT INTO pet_returns (animal_id, adopter_id, reason, details, status) VALUES (?, ?, ?, ?, 'Pending')`,
            [pet_id, adopterId, reason, details]
        );

        // 4. I-notify ang Organization
        const [orgAccount] = await pool.query(
            `SELECT account_id FROM organizations WHERE organization_id = ?`,
            [organizationId]
        );

        if (orgAccount.length > 0) {
            await createNotification(
                orgAccount[0].account_id,
                "New Pet Return Request",
                "An adopter has submitted a request to return a pet.",
                "return_request",
                "/org/kamustahan"
            );
        }

        res.json({ success: true, message: 'Return request submitted successfully.' });

    } catch (error) {
        console.error('Return Request Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});
router.get('/api/adopter/return-requests', checkUserSession, async (req, res) => {
    try {
        const [adopterRows] = await pool.query(
            `SELECT adopter_id FROM adopters WHERE account_id = ?`,
            [req.session.accountId]
        );

        if (adopterRows.length === 0) {
            return res.json({ success: true, requests: [] });
        }

        const adopterId = adopterRows[0].adopter_id;

        // ⭐ Latest return request per pet only
        const [requests] = await pool.query(
            `SELECT pr.id, pr.animal_id, pr.status, pr.org_response, pr.created_at
             FROM pet_returns pr
             INNER JOIN (
                 SELECT animal_id, MAX(id) AS max_id
                 FROM pet_returns
                 WHERE adopter_id = ?
                 GROUP BY animal_id
             ) latest ON pr.id = latest.max_id
             WHERE pr.adopter_id = ?`,
            [adopterId, adopterId]
        );

        res.json({ success: true, requests });
    } catch (error) {
        console.error("Return Requests Error:", error);
        res.status(500).json({ success: false });
    }
});
router.get('/api/adopter/return-history', checkUserSession, async (req, res) => {
    try {
        const [adopterRows] = await pool.query(
            `SELECT adopter_id FROM adopters WHERE account_id = ?`,
            [req.session.accountId]
        );

        if (adopterRows.length === 0)
            return res.json({ success: true, requests: [] });

        const [requests] = await pool.query(`
            SELECT pr.*, a.name AS pet_name, a.image_path AS pet_image,
                   o.organization_name
            FROM pet_returns pr
            JOIN animals a ON pr.animal_id = a.animal_id
            JOIN organizations o ON a.organization_id = o.organization_id
            WHERE pr.adopter_id = ?
            ORDER BY pr.created_at DESC
        `, [adopterRows[0].adopter_id]);

        res.json({ success: true, requests });
    } catch (error) {
        console.error("Return History Error:", error);
        res.status(500).json({ success: false });
    }
});
module.exports = router;

module.exports = router;
