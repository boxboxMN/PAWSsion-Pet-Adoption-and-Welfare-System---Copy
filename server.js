require("dotenv").config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");


// Anti-clickjacking security headers
app.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Content-Security-Policy",
    "frame-ancestors 'none'",
     "font-src 'self'"
  );
  next();
});

const path = require('path');
const fs = require('fs');
const multer = require('multer');

// ==========================================
// SECURITY HEADERS (OWASP ZAP FIX)
// ==========================================
app.use(
  helmet({
    // Disable HSTS locally so it doesn't force http:// to https://
    hsts: false,
  })
);

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      
      // DAGDAG DITO: Harangan ang kahit anong site na i-frame ang app mo (Clickjacking Protection)
      frameAncestors: ["'none'"], 

      scriptSrc: [
        "'self'", 
        "'wasm-unsafe-eval'",
        "https://cdn.tailwindcss.com",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com"
      ],
      // 1. Payagan ang inline event handlers tulad ng onclick="..."
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
        "https://cdnjs.cloudflare.com"
     ],
      fontSrc: [
        "'self'", 
        "https://fonts.gstatic.com",
        "https://cdnjs.cloudflare.com"
      ],
      imgSrc: ["'self'", "data:", "blob:", "https://cdnjs.cloudflare.com", "https://via.placeholder.com"],
      // 1. Payagan ang network connections/fetches sa jsDelivr (para sa Tesseract.js data & maps)
      connectSrc: ["'self'", "data:", "blob:", "https://cdn.jsdelivr.net",  "https://cdnjs.cloudflare.com"],
      // 2. Payagan ang Web Workers at Blob URLs na ginagamit ng Tesseract.js
      workerSrc: ["'self'", "blob:", "https://cdn.jsdelivr.net"],

      // Siguraduhing pinapayagan din ang upgrade requests na naka-off muna sa localhost
      upgradeInsecureRequests: null,
    },
  })
);

app.use(helmet.xssFilter());
app.use(helmet.noSniff());
app.use(helmet.frameguard({ action: 'deny' }));

const pool = require('./config/database');

console.log("🔵 DATABASE TEST CODE LOADED");
console.log("DB CONFIG CHECK:", {
    host: process.env.MYSQLHOST,
    port: process.env.MYSQLPORT,
    user: process.env.MYSQLUSER,
    database: process.env.MYSQLDATABASE
});
pool.query("SELECT 1 AS test")
    .then(() => {
        console.log("🟢 RAILWAY MYSQL CONNECTION SUCCESSFUL");
    })
    .catch((err) => {
        console.error("🔴 RAILWAY MYSQL CONNECTION FAILED:", err.message);
    });
const { uploadOrgPic } = require('./config/upload');
const { logActivity } = require("./controllers/adminController");
const { checkAccountStatus } = require("./controllers/adminController");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    const ignoredRoutes = [
        "/api/session-status"
    ];
    if (!ignoredRoutes.includes(req.path)) {
        console.log(`Incoming: ${req.method} ${req.url}`);
    }
    next();
});

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24
    }
}));

// ==========================================
// CSRF PROTECTION
// ==========================================
const {
    csrfSynchronisedProtection,
    generateToken
} = require("./middleware/csrf");

app.get("/auth/csrf-token", (req, res) => {
    res.json({
        token: generateToken(req)
    });
});
// ==========================================
// AUTHENTICATED USER REDIRECT
// ==========================================
const redirectAuthenticated = require("./middleware/redirectAuthenticated");

app.get("/", redirectAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});
// ==========================================
// STATIC FILES — serve FIRST (hindi kailangan ng session check)
// ==========================================
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ==========================================
// SESSION CHECKS — para lang sa protected routes
// ==========================================
app.use(checkAccountStatus);
const singleSession = require("./middleware/singleSession");
app.use(singleSession);

const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");
const orgRoutes = require("./routes/orgRoutes");
const authRoutes = require("./routes/auth");
const IndexController = require("./controllers/IndexController");   

const bcrypt = require('bcrypt');
const Organization = require('./models/organizationModel');

const adminController = require("./controllers/adminController");

//logic for password attempts and lockout
const orgPasswordAttempts = new Map();

function getOrgAttemptRecord(accountId) {
    return orgPasswordAttempts.get(accountId) || { attempts: 5, lockedUntil: null };


}

// ==========================================
// RECEIPT UPLOAD (multer) — para sa cash donation
// ==========================================
const receiptDir = path.join(__dirname, 'uploads', 'receipts');
if (!fs.existsSync(receiptDir)) {
    fs.mkdirSync(receiptDir, { recursive: true });
}

const receiptStorage = multer.diskStorage({          
    destination: (req, file, cb) => cb(null, receiptDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.png';
        const unique = `receipt-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
        cb(null, unique);
    }
});

const uploadReceipt = multer({
    storage: receiptStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        if (/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed.'));
        }
    }
});
// ==========================================
// DONATION ROUTES
// ==========================================
app.post(
    '/api/donations/cash',
    uploadReceipt.single('receipt'),
    IndexController.submitCashDonation
);


//  In-Kind Donation 
app.post(
    '/api/donations/inkind',
    uploadReceipt.none(),
    IndexController.submitInKindDonation
);

//  PUBLIC ROUTE — para sa organizations list sa landing page
app.get('/api/organizations', IndexController.getOrganizations);
app.get('/api/public/stats', IndexController.getPublicStats);
app.use("/auth", authRoutes);
app.use(userRoutes);
app.use("/admin", adminRoutes);
app.use("/org", orgRoutes);
app.get('/api/current-user', async (req, res) => {
  try {
    // ⛔ TANGGALIN ang query fallback — session lang ang dapat pagkatiwalaan
    const accountId = req.session?.accountId;

    // ⛔ WALANG SESSION = WALANG DATA
    if (!accountId) {
      return res.status(401).json({
        success: false,
        name: null,
        profile_picture: null
      });
    }

    const [rows] = await pool.query(
      `SELECT a.account_id, a.email, ad.first_name, ad.last_name, ad.profile_picture
       FROM accounts a
       LEFT JOIN adopters ad ON ad.account_id = a.account_id
       WHERE a.account_id = ?
       LIMIT 1`,
      [accountId]
    );

    if (!rows[0]) {
      // Session exists pero wala na sa DB (deleted)
      req.session.destroy(() => {});
      return res.status(401).json({ success: false, name: null, profile_picture: null });
    }

    const firstName = rows[0].first_name || '';
    const lastName  = rows[0].last_name  || '';
    const displayName = [firstName, lastName].filter(Boolean).join(' ')
                        || rows[0].email || 'User';

    req.session.displayName = displayName;

    res.json({
      name: displayName,
      profile_picture: rows[0].profile_picture || null
    });
  } catch (error) {
    console.error('current-user error:', error);
    res.status(500).json({ success: false, name: null, profile_picture: null });
  }
});
app.get("/api/organization/pending", async (req, res) => {

    if (!req.session.accountId) {
        return res.status(401).json({
            error: "Unauthorized"
        });
    }

    try {

        const [rows] = await pool.query(

            `SELECT
                organization_name,
                verification_status,
                accounts.created_at
            FROM organizations
            JOIN accounts
            ON organizations.account_id = accounts.account_id
            WHERE organizations.account_id = ?`,

            [req.session.accountId]

        );

        if (!rows.length) {
            return res.status(404).json({
                error: "Organization not found"
            });
        }

        res.json(rows[0]);

    }

    catch(err){

        console.error(err);

        res.status(500).json({
            error:"Server Error"
        });

    }

});

//org profile
app.get("/api/organization/profile", async (req, res) => {

     // Pinipigilan ang browser mula sa pag-cache ng profile data (dapat laging updated/fresh)
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");

  if (!req.session.accountId) {
    return res.status(401).json({
        error: "Unauthorized"
    });
}

try {
    // GINAGAMIT NA NATIN ANG BAGONG MODEL MO DITO:
    const orgData = await Organization.getProfileByAccountId(req.session.accountId);

    if (!orgData) {
        return res.status(404).json({
            error: "Organization not found"
        });
    }

    // Ipapasa na ang BUONG object (kasama name, contact, address, pic, etc.) sa frontend
    res.json(orgData);

} catch (err) {
    console.error(err);
    res.status(500).json({
        error: "Server Error"
    });
}
});

// =====================================================
// FEEDBACK (shared by organizations and users)
// =====================================================
app.post("/api/feedback", async (req, res) => {
    const accountId = req.session?.accountId;
    if (!accountId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized"
        });
    }

    try {
        const { feedback_type, subject, message, rating } = req.body;

        // ---- Validation (unchanged) ----
        const allowedTypes = ["Report a Bug", "Feature Suggestion", "General Feedback", "Other"];

        if (!feedback_type || !allowedTypes.includes(feedback_type)) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid feedback type."
            });
        }

        if (!subject || !subject.trim()) {
            return res.status(400).json({
                success: false,
                message: "Subject is required."
            });
        }

        if (!message || message.trim().length < 10) {
            return res.status(400).json({
                success: false,
                message: "Message must be at least 10 characters."
            });
        }

        let ratingValue = null;
        if (rating !== null && rating !== undefined && rating !== "") {
            ratingValue = Number(rating);
            if (!Number.isInteger(ratingValue) || ratingValue < 1 || ratingValue > 5) {
                return res.status(400).json({
                    success: false,
                    message: "Rating must be a whole number between 1 and 5."
                });
            }
        }

        // ---- Determine whether this account is an organization or a user ----
        let submittedBy;
        let organizationId = null;

        try {
            organizationId = await Organization.getOrganizationIdByAccountId(accountId);
            submittedBy = "organization";
        } catch (notAnOrgErr) {
            const [adopterRows] = await pool.query(
                `SELECT adopter_id FROM adopters WHERE account_id = ?`,
                [accountId]
            );

            if (!adopterRows.length) {
                return res.status(404).json({
                    success: false,
                    message: "Account not found."
                });
            }

            submittedBy = "user";
        }

        // ---- Insert feedback ----
        await pool.query(
            `
            INSERT INTO feedback
                (account_id, organization_id, submitted_by, feedback_type, subject, message, rating)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            [accountId, organizationId, submittedBy, feedback_type, subject.trim(), message.trim(), ratingValue]
        );

        res.status(201).json({
            success: true,
            message: "Thanks! Your feedback has been submitted."
        });

    } catch (err) {
        console.error("Submit Feedback Error:", err);
        res.status(500).json({
            success: false,
            message: "Server error while submitting feedback."
        });
    }
});

//FOR CHANGE PASSWORD

// MODAL CURRENT PASSWORD VERIFICATION: 
app.post("/api/organization/verify-password", async (req, res) => {
  if (!req.session.accountId) {
      return res.status(401).json({ message: "Unauthorized" });
  }

  //logic for password attempts and lockout
  const orgVerifyRecord = getOrgAttemptRecord(req.session.accountId);

  if (orgVerifyRecord.lockedUntil && Date.now() < orgVerifyRecord.lockedUntil) {
      const remainingTime = Math.ceil((orgVerifyRecord.lockedUntil - Date.now()) / 60000);
      return res.status(429).json({ 
          message: `Too many failed attempts. Try again in ${remainingTime} minute(s).` 
      });
  }

  const { currentPassword } = req.body;

  try {
      // Siguraduhin na ang tawag mo sa Model ay tugma (Organization)
      const storedHashedPassword = await Organization.getPasswordById(req.session.accountId);

      if (!storedHashedPassword) {
          return res.status(404).json({ message: "Account not found." });
      }

      const isMatch = await bcrypt.compare(currentPassword, storedHashedPassword);

      if (!isMatch) {
        orgVerifyRecord.attempts -= 1;

        if (orgVerifyRecord.attempts <= 0) {
            orgVerifyRecord.lockedUntil = Date.now() + 15 * 60 * 1000;
            orgVerifyRecord.attempts = 5;
            orgPasswordAttempts.set(req.session.accountId, orgVerifyRecord);

            await logActivity(req.session.accountId, "org_profile_verify_locked", "org_profile", req.session.accountId, "Locked after 5 failed attempts");

            return res.status(429).json({ 
                message: "Too many failed attempts. You are locked out from changing password for 15 minutes." 
            });
        }

        orgPasswordAttempts.set(req.session.accountId, orgVerifyRecord);

        await logActivity(req.session.accountId, "org_profile_verification_failed", "org_profile", req.session.accountId, `Attempts remaining: ${orgVerifyRecord.attempts}`);

        return res.status(400).json({ 
            message: `Incorrect password. You have ${orgVerifyRecord.attempts} attempt(s) remaining.` 
        });
      }

       // Reset on success
      orgPasswordAttempts.delete(req.session.accountId);

      res.status(200).json({ message: "Identity verified. Proceed to next step." });

  } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error during verification." });
  }
});

//MODAL NEW PASSWORD UPDATE
app.put("/api/organization/update-password", async (req, res) => {
    // 1. Check kung naka-login ang user
    if (!req.session.accountId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

     // 1.5. CHECK LOCKOUT (shared with verify-password)
     const orgUpdateRecord = getOrgAttemptRecord(req.session.accountId);
     if (orgUpdateRecord.lockedUntil && Date.now() < orgUpdateRecord.lockedUntil) {
         const remainingTime = Math.ceil((orgUpdateRecord.lockedUntil - Date.now()) / 60000);
         return res.status(429).json({
             message: `Too many failed attempts. Try again in ${remainingTime} minute(s).`
         });
     }

    const { currentPassword, newPassword } = req.body;
    const accountId = req.session.accountId;

    try {
        // 2. Kunin ang kasalukuyang password hash ng user mula sa DB
        const [users] = await pool.query("SELECT password_hash FROM accounts WHERE account_id = ?", [accountId]);
        
        if (users.length === 0) {
            return res.status(404).json({ message: "Account not found." });
        }

        // --- IPINATAMA DITO (password_hash imbis na password) ---
        const currentHash = users[0].password_hash; 

        // 3. I-verify muna kung tugma ang isinumiteng Current Password sa DB hash
        const isCurrentMatch = await bcrypt.compare(currentPassword, currentHash);
        if (!isCurrentMatch) {
            orgUpdateRecord.attempts -= 1;

            if (orgUpdateRecord.attempts <= 0) {
                orgUpdateRecord.lockedUntil = Date.now() + 15 * 60 * 1000;
                orgUpdateRecord.attempts = 5;
                orgPasswordAttempts.set(accountId, orgUpdateRecord);

                await logActivity(accountId, "org_profile_verify_locked", "org_profile", accountId, "Locked after 5 failed attempts (via save)");

                return res.status(429).json({
                    message: "Too many failed attempts. You are locked out from changing your profile for 15 minutes."
                });
            }

            orgPasswordAttempts.set(accountId, orgUpdateRecord);

            await logActivity(accountId, "org_profile_verification_failed", "org_profile", accountId, `Wrong current password (via save), attempts remaining: ${orgUpdateRecord.attempts}`);

            return res.status(400).json({
                message: `Incorrect current password. You have ${orgUpdateRecord.attempts} attempt(s) remaining.`
            });
        }

         // Reset on success
         orgPasswordAttempts.delete(accountId);

        // 4. SECURE BACKEND CHECK: I-verify kung ang New Password ay kapareho ng Current Password
        const isSameAsOld = await bcrypt.compare(newPassword, currentHash);
        if (isSameAsOld) {
            return res.status(400).json({ message: "New password cannot be the same as your old password." });
        }

        // 5. SECURE BACKEND CHECK: I-verify ang password strength criteria sa backend
      // Minimum 8 characters, kahit anong haba, kahit walang special characters
        const passwordRegex = /^.{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({ 
                message: "Password must be at least 8 characters long, contain an uppercase, lowercase, number, and special character." 
            });
        }

        // 6. I-hash na ang bagong password bago i-save
        const saltRounds = 10;
        const newHash = await bcrypt.hash(newPassword, saltRounds);

        // 7. I-update ang password sa DB
        await pool.query("UPDATE accounts SET password_hash = ? WHERE account_id = ?", [newHash, accountId]);

        await logActivity(accountId, "org_profile_updated", "org_profile", accountId, "Password changed");

        res.status(200).json({ message: "Password updated successfully!" });

    } catch (err) {
        console.error("Error updating password:", err);
        res.status(500).json({ message: "Server error while changing password." });
    }
});

// org availability (view calendar)
app.get("/api/organization/availability", async (req, res) => {

    if (!req.session.accountId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
  
    try {
      const availability = await Organization.getAvailability(req.session.accountId);
      res.json({ success: true, availability });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server Error" });
    }
});

app.put("/api/organization/availability", async (req, res) => {

    if (!req.session.accountId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
  
    try {
      const { days } = req.body;
  
      if (!Array.isArray(days) || days.length !== 7) {
        return res.status(400).json({ success: false, message: "Invalid availability data." });
      }
  
      for (const d of days) {
        if (typeof d.day_of_week !== 'number' || d.day_of_week < 0 || d.day_of_week > 6) {
          return res.status(400).json({ success: false, message: "Invalid day_of_week value." });
        }
        if (d.is_open && (!d.start_time || !d.end_time || d.start_time >= d.end_time)) {
          return res.status(400).json({ success: false, message: "Start time must be earlier than end time for open days." });
        }
      }
  
      await Organization.updateAvailability(req.session.accountId, days);
      res.json({ success: true, message: "Availability updated successfully." });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server Error" });
    }
});

// org drop-off hours (donation settings — separate schedule from interview availability)
app.get("/api/organization/dropoff-hours", async (req, res) => {
    if (!req.session.accountId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    try {
        const hours = await Organization.getDropoffHours(req.session.accountId);
        res.json({ success: true, hours });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

app.put("/api/organization/dropoff-hours", async (req, res) => {
    if (!req.session.accountId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    try {
        const { days } = req.body;
        if (!Array.isArray(days) || days.length !== 7) {
            return res.status(400).json({ success: false, message: "Invalid drop-off hours data." });
        }
        for (const d of days) {
            if (typeof d.day_of_week !== 'number' || d.day_of_week < 0 || d.day_of_week > 6) {
                return res.status(400).json({ success: false, message: "Invalid day_of_week value." });
            }
            if (d.is_open && (!d.start_time || !d.end_time || d.start_time >= d.end_time)) {
                return res.status(400).json({ success: false, message: "Start time must be earlier than end time for open days." });
            }
        }
        await Organization.updateDropoffHours(req.session.accountId, days);
        res.json({ success: true, message: "Drop-off hours updated successfully." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

//org edit profile
app.put("/api/organization/update-profile", uploadOrgPic.single('profile_pic'), async (req, res) => {
    res.set("Cache-Control", "no-store");
    
    // 1. Siguraduhing naka-login ang user via session
  if (!req.session.accountId) {
      return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    // Kunin ang text fields na pinadala ng FormData mula sa frontend
    const { organization_name, contact_number, contact_person, address, region, province, city, barangay, zip_code, description } = req.body;
      
    // Guard against the literal strings "undefined"/"null" that FormData.append()
    // silently produces if a field's value was ever a real JS undefined/null.
    const sanitize = (value) => {
        if (value === undefined || value === null) return "";
        const trimmed = String(value).trim();
        return (trimmed === "undefined" || trimmed === "null") ? "" : trimmed;
    };

    const sanitizedContactNumber = sanitize(contact_number);

    if (sanitizedContactNumber) {
        const phoneRegex = /^09\d{9}$/;
        if (!phoneRegex.test(sanitizedContactNumber)) {
            return res.status(400).json({ message: "Contact number must be 11 digits starting with 09." });
        }
    }

      const profileData = {
        organization_name: sanitize(organization_name),
        contact_number: sanitizedContactNumber,
        contact_person: sanitize(contact_person),
        address: sanitize(address),
        region: sanitize(region),
        province: sanitize(province),
        city: sanitize(city),
        barangay: sanitize(barangay),
        zip_code: sanitize(zip_code),
        description: sanitize(description),
        profile_pic: null // Naka-null muna by default
      };

      // 2. Kung may piniling bagong larawan ang user at sinalo ito ng Multer
      if (req.file) {
          // Ito ang web path na ise-save sa DB para ma-access ng <img src="...">
          profileData.profile_pic = `/uploads/orgs/${req.file.filename}`;
      }

      // 3. Tawagin ang model function natin para mag-execute ng UPDATE query sa DB
      const success = await Organization.updateProfile(req.session.accountId, profileData);

      if (success) {
          res.status(200).json({ message: "Profile updated successfully!", 
          profile_pic: profileData.profile_pic
          });
      } else {
          // Pwedeng pumasok dito kung pinindot ang save pero wala namang binagong text or image ang user
          res.status(400).json({ message: "No changes were made or update failed." });
      }

  } catch (err) {
      console.error("Error updating profile:", err);
      res.status(500).json({ message: "Server error while updating profile." });
  }
});

// Endpoint para makuha ang active session profile pic
app.get("/api/organization/session-data", async (req, res) => {
  // 1. Siguraduhing naka-login
  if (!req.session.accountId) {
      return res.status(401).json({ message: "Unauthorized" });
  }
  try {
      // 2. Kunin ang organization data mula sa MySQL gamit ang accountId ng session
      const currentOrg = await Organization.getById(req.session.accountId); 
      
      // 3. Ibalik ang profile_pic
      res.status(200).json({ 
          profile_pic: currentOrg ? currentOrg.profile_pic : null 
      });
  } catch (err) {
      console.error("Error fetching session data:", err);
      res.status(500).json({ error: "Server error" });
  }
});

app.get('/api/organization/applications', async (req, res) => {
    try {
        const accountId = req.session?.accountId;
        if (!accountId) {
            return res.status(401).json({ error: "Unauthorized access." });
        }

        // 1. Kunin ang organization_id gamit ang account_id ng session
        const [orgRows] = await pool.query(
            `SELECT organization_id FROM organizations WHERE account_id = ?`,
            [accountId]
        );

        if (!orgRows.length) {
            return res.status(404).json({ error: "Organization not found." });
        }

        const orgId = orgRows[0].organization_id;

        // 2. Query na may WHERE clause para sa naka-login na Organization lang
        const query = `
           SELECT 
                app.application_id AS id,
                app.applicant_snapshot,
                p.name AS pet_name,
                p.species AS pet_type,
                p.gender AS pet_gender,
                p.image_path AS pet_image,
                app.status,
                DATE_FORMAT(app.created_at, '%b %d, %Y') AS applied_date,
                DATE_FORMAT(app.created_at, '%h:%i %p') AS applied_time,
                CASE WHEN app.status = 'Under Review' THEN NULL ELSE DATE_FORMAT(i.interview_date, '%Y-%m-%d') END AS interview_date,
                CASE WHEN app.status = 'Under Review' THEN NULL ELSE i.interview_time END AS interview_time,
                CASE WHEN app.status = 'Under Review' THEN NULL ELSE i.interview_method END AS interview_method,
                CASE WHEN app.status = 'Under Review' THEN NULL ELSE i.interview_location_link END AS interview_location_link
            FROM user_adoption_applications app
            INNER JOIN animals p ON app.animal_id = p.animal_id
            LEFT JOIN application_interviews i ON app.application_id = i.application_id
            WHERE p.organization_id = ?
            ORDER BY app.created_at DESC;
        `;

        const [rows] = await pool.query(query, [orgId]);

        // 3. MAP FUNCTION: I-parse ang JSON snapshot para sa bawat application record
        const formattedApplications = rows.map(app => {
            let snapshot = {};
            try {
                snapshot = typeof app.applicant_snapshot === 'string'
                    ? JSON.parse(app.applicant_snapshot)
                    : (app.applicant_snapshot || {});
            } catch (e) {
                console.error("JSON parse error:", e);
            }

            const applicantData = snapshot.applicant || snapshot;

            return {
                id: app.id,
                applicant_name: applicantData.fullName || applicantData.full_name || 'N/A',
                applicant_email: applicantData.email || 'N/A',
                applicant_phone: applicantData.phone || applicantData.contact_number || 'N/A',
                pet_name: app.pet_name,
                pet_type: app.pet_type,
                pet_gender: app.pet_gender,
                pet_image: app.pet_image,
                status: app.status,
                applied_date: app.applied_date,
                applied_time: app.applied_time,
                interview_date: app.interview_date,
                interview_time: app.interview_time,
                interview_method: app.interview_method,
                interview_location_link: app.interview_location_link
            };
        });

        res.status(200).json(formattedApplications);
    } catch (error) {
        console.error("Database Error:", error);
        res.status(500).json({ error: "Failed to fetch applications from database" });
    }
});

// Adoption routes
app.use('/api/userAdoptions', userRoutes);

app.post('/api/user/applications/:id/reschedule-request', async (req, res) => {
    if (!req.session?.accountId) {
        return res.status(401).json({ success: false, message: "Unauthorized access." });
    }

    const applicationId = req.params.id;
    const accountId = req.session.accountId;
    const { preferred_date, preferred_time, reason } = req.body;

    try {
        // ✅ OWNERSHIP CHECK — siguraduhing ang application ay pag-aari ng naka-login na user
        const [ownerRows] = await pool.query(
            `SELECT app.application_id
             FROM user_adoption_applications app
             INNER JOIN adopters ad ON ad.adopter_id = app.adopter_id
             WHERE app.application_id = ? AND ad.account_id = ?
             LIMIT 1`,
            [applicationId, accountId]
        );

        if (!ownerRows.length) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: this application does not belong to you."
            });
        }

        const query = `
            INSERT INTO application_interviews 
                (application_id, requested_interview_date, requested_interview_time, reschedule_reason, resched_status)
            VALUES (?, ?, ?, ?, 'Pending')
            ON DUPLICATE KEY UPDATE 
                requested_interview_date = VALUES(requested_interview_date),
                requested_interview_time = VALUES(requested_interview_time),
                reschedule_reason = VALUES(reschedule_reason),
                resched_status = 'Pending'
        `;

        const [result] = await pool.query(query, [
            applicationId,
            preferred_date, 
            preferred_time, 
            reason
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Application not found." });
        }

        return res.status(200).json({
            success: true,
            message: "Reschedule request submitted for organization review."
        });
    } catch (error) {
        console.error("Reschedule Error:", error);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

app.get("/api/contact-info", adminController.getContactInfo);
// GANITO DAPAT:
app.post("/api/contact-messages", csrfSynchronisedProtection, adminController.submitContactMessage);
app.get("/api/guide", adminController.getGuideSections);

// Notification routes
app.get("/api/notifications", adminController.getNotifications);
app.put("/api/notifications/:id/read", adminController.markNotificationRead);
app.put("/api/notifications/read-all", adminController.markAllNotificationsRead);
/**
 * Kunin ang listahan ng mga approved organizations para sa public landing page / donation selector
 */
app.get('/api/organizations', async (req, res) => {
    try {
        const [organizations] = await pool.query(`
    SELECT
        o.organization_id,
        o.organization_name,
        o.city,
        o.province,
        o.contact_number,
        o.description,
        o.profile_pic,
        p.gcash_name,
        p.gcash_number,
        p.qr_code,
        p.maya_name,
        p.maya_number,
        p.maya_qr_code,
        d.dropoff_location_name,
        d.dropoff_address,
        d.dropoff_hours,
        d.dropoff_notes,
        d.dropoff_image
    FROM organizations o
    INNER JOIN organization_payment_details p ON o.organization_id = p.organization_id
    LEFT JOIN organization_dropoff_details d ON o.organization_id = d.organization_id
    WHERE o.verification_status = 'Approved'
`);
app.delete("/api/notifications/:id", adminController.deleteNotification);

        const formattedOrgs = organizations.map(org => {
            const profilePic = (org.profile_pic && org.profile_pic.trim() !== '')
                ? (org.profile_pic.startsWith('/') ? org.profile_pic : `/uploads/${org.profile_pic}`)
                : '/uploads/default-org.png';

            const qrCode = (org.qr_code && org.qr_code.trim() !== '' && org.qr_code !== '/uploads/qr/')
                ? (org.qr_code.startsWith('/') ? org.qr_code : `/uploads/qr/${org.qr_code}`)
                : '';

            const mayaQrCode = (org.maya_qr_code && org.maya_qr_code.trim() !== '' && org.maya_qr_code !== '/uploads/qr/')
                ? (org.maya_qr_code.startsWith('/') ? org.maya_qr_code : `/uploads/qr/${org.maya_qr_code}`)
                : '';

            let dropoffImg = (org.dropoff_image && org.dropoff_image.trim() !== '') ? org.dropoff_image.trim() : '';

            if (dropoffImg && !dropoffImg.startsWith('/') && !dropoffImg.startsWith('http')) {
                dropoffImg = dropoffImg.startsWith('qr-') ? `/uploads/qr/${dropoffImg}` : `/uploads/${dropoffImg}`;
            }

            return {
                ...org,
                profile_pic: profilePic,
                qr_code: qrCode,
                maya_qr_code: mayaQrCode,
                dropoff_image: dropoffImg
            };
        });

        res.json({ success: true, organizations: formattedOrgs });
    } catch (err) {
        console.error("Get Public Organizations Error:", err);
        res.status(500).json({ success: false, message: "Failed to load organizations." });
    }
});

/**
 * Pag-submit ng Cash Donation mula sa Landing Page (Public / Guest / Logged-in)
 * Tandaan: Gumagamit ito ng Multer upload para sa resibo (receipt). Siguraduhing naisama mo ang angkop na upload middleware kung kinakailangan.
 */
app.post('/api/donations/cash', async (req, res) => {
    const accountId = req.session?.accountId || null;

    const {
        organization_id,
        donor_name,
        gcash_account_name,
        reference_number,
        amount,
        payment_method
    } = req.body;

    if (!organization_id || !donor_name || !reference_number || !amount) {
        return res.status(400).json({ success: false, error: "Please fill in all required fields." });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ success: false, error: "Donation amount must be greater than zero." });
    }

    const cleanRefNum = reference_number.trim();
    const refRegex = /^(?=.*[0-9])[a-zA-Z0-9]{10,15}$/;
    if (!refRegex.test(cleanRefNum)) {
        return res.status(400).json({ success: false, error: "Please enter a valid reference number (10-15 alphanumeric characters including a digit)." });
    }

    if (!req.file) {
        return res.status(400).json({ success: false, error: "Please upload your proof of payment (Receipt)." });
    }

    try {
        const [existingRef] = await pool.query(
            `SELECT cash_donation_id FROM cash_donations WHERE reference_number = ? LIMIT 1`,
            [cleanRefNum]
        );

        if (existingRef.length > 0) {
            return res.status(400).json({ success: false, error: "This reference number has already been submitted." });
        }

        const [paymentRows] = await pool.query(
            `SELECT gcash_number, maya_number FROM organization_payment_details WHERE organization_id = ?`,
            [organization_id]
        );

        const selectedMethod = payment_method ? payment_method.trim() : 'GCash';

        if (selectedMethod.toLowerCase() === 'maya') {
            if (!paymentRows.length || !paymentRows[0].maya_number) {
                return res.status(400).json({ success: false, error: "Maya payment details are not set for this organization." });
            }
        } else {
            if (!paymentRows.length || !paymentRows[0].gcash_number) {
                return res.status(400).json({ success: false, error: "GCash payment details are not set for this organization." });
            }
        }

        const receipt_path = `/uploads/receipts/${req.file.filename}`;

        let adopter_id = null;
        if (accountId) {
            const [adopterRows] = await pool.query(`SELECT adopter_id FROM adopters WHERE account_id = ?`, [accountId]);
            if (adopterRows.length > 0) adopter_id = adopterRows[0].adopter_id;
        }

        const [result] = await pool.query(
            `INSERT INTO cash_donations 
            (adopter_id, organization_id, donor_name, donor_email, gcash_account_name, reference_number, amount, receipt_path, payment_method, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', NOW())`,
            [
                adopter_id,
                organization_id,
                donor_name,
                donor_email,
                gcash_account_name || donor_name,
                cleanRefNum,
                parsedAmount,
                receipt_path,
                selectedMethod
            ]
        );

        if (accountId) {
            await logActivity(accountId, "donation_submitted", "cash_donation", result.insertId, `₱${parsedAmount}`);
        }

        const [[orgAccount]] = await pool.query(
            `SELECT account_id FROM organizations WHERE organization_id = ?`,
            [organization_id]
        );

        if (orgAccount) {
            await createNotification(
                orgAccount.account_id,
                "New Cash Donation",
                `${donor_name} submitted a cash donation of ₱${parsedAmount}.`,
                "donation_submitted",
                "/org/donation"
            );
        }

        return res.json({
            success: true,
            message: "Thank you! Your cash donation has been submitted and is pending verification.",
            donationId: result.insertId
        });

    } catch (error) {
        console.error("Submit Public Cash Donation Error:", error);
        return res.status(500).json({ success: false, error: "Database error while processing donation: " + error.message });
    }
});
// Legal pages
app.get("/privacy-policy", (req, res) => {
    res.sendFile(path.join(__dirname, "public/legal1.html"));
});
app.get("/terms", (req, res) => {
    res.sendFile(path.join(__dirname, "public/legal2.html"));
});
app.get("/contact", (req, res) => {
    res.sendFile(path.join(__dirname, "public/legal3.html"));
});
app.get("/faqs", (req, res) => {
    res.sendFile(path.join(__dirname, "public/legal4.html"));
});

// app.get("/api/session-status", adminController.getSessionStatus);
// const PORT = 3000;
// app.listen(PORT, () => {
//   console.log(`Server running on http://localhost:${PORT}`);
// });

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});
