// routes/auth.js
const express = require("express");

const { google } = require("googleapis");

const router = express.Router();
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const { fileTypeFromFile } = require("file-type");
const authController = require("../controllers/AuthController");
const pool = require("../config/database");
const redirectAuthenticated = require("../middleware/redirectAuthenticated");


// ==========================================
// TEMPORARY GMAIL OAUTH SETUP
// ==========================================

const gmailOAuthClient = new google.auth.OAuth2(
    process.env.GMAIL_OAUTH_CLIENT_ID,
    process.env.GMAIL_OAUTH_CLIENT_SECRET,
    process.env.GMAIL_OAUTH_REDIRECT_URI
);

// Setup page
router.get("/gmail/oauth/setup", (req, res) => {
    res.set("Cache-Control", "no-store");

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>PAWPON Gmail Authorization</title>
        </head>
        <body style="font-family: Arial; padding: 40px;">
            <h2>PAWPON Gmail Authorization</h2>
            <p>Enter your temporary setup secret.</p>

            <form method="POST" action="https://pawpon.up.railway.app/auth/gmail/oauth/start">
                <input
                    type="password"
                    name="setupSecret"
                    placeholder="Setup secret"
                    required
                    style="padding: 10px; width: 280px;"
                >
                <button type="submit" style="padding: 10px;">
                    Continue with Google
                </button>
            </form>
        </body>
        </html>
    `);
});

// Start Google authorization
router.post("/gmail/oauth/start", (req, res) => {
    const suppliedSecret = req.body.setupSecret || "";
    const expectedSecret = process.env.GMAIL_OAUTH_SETUP_SECRET || "";

    if (
        !expectedSecret ||
        !suppliedSecret ||
        suppliedSecret.length !== expectedSecret.length ||
        !crypto.timingSafeEqual(
            Buffer.from(suppliedSecret),
            Buffer.from(expectedSecret)
        )
    ) {
        return res.status(403).send("Invalid setup secret.");
    }

    const statePayload = `${Date.now()}.${crypto.randomBytes(32).toString("hex")}`;

    const encodedPayload = Buffer
        .from(statePayload)
        .toString("base64url");
    
    const signature = crypto
        .createHmac("sha256", expectedSecret)
        .update(encodedPayload)
        .digest("base64url");
    
    const state = `${encodedPayload}.${signature}`;

    const authUrl = gmailOAuthClient.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: [
            "https://www.googleapis.com/auth/gmail.send"
        ],
        state
    });

    return res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>PAWPON Gmail Authorization</title>
    </head>
    <body style="font-family: Arial; padding: 40px;">
        <h2>Setup Secret Verified!</h2>
        <p>Click below to continue to Google authorization.</p>
        <a href="${authUrl}">
            Continue to Google
        </a>
    </body>
    </html>
`);
});

// Google OAuth callback
router.get("/gmail/oauth/callback", async (req, res) => {
    res.set("Cache-Control", "no-store");

    try {
        const { code, state, error } = req.query;

        if (error) {
            return res.status(400).send("Google authorization was cancelled or denied.");
        }

        // Verify signed OAuth state
if (typeof state !== "string") {
    return res.status(403).send("Invalid authorization state.");
}

const stateParts = state.split(".");

if (stateParts.length !== 2) {
    return res.status(403).send("Invalid authorization state.");
}

const [encodedPayload, providedSignature] = stateParts;

const expectedSecret = process.env.GMAIL_OAUTH_SETUP_SECRET;

if (!expectedSecret) {
    return res.status(500).send("OAuth setup secret is missing.");
}

const expectedSignature = crypto
    .createHmac("sha256", expectedSecret)
    .update(encodedPayload)
    .digest("base64url");

const providedBuffer = Buffer.from(providedSignature);
const expectedBuffer = Buffer.from(expectedSignature);

if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
) {
    return res.status(403).send("Invalid authorization signature.");
}

const payload = Buffer
    .from(encodedPayload, "base64url")
    .toString("utf8");

const [timestampText, nonce] = payload.split(".");
const issuedAt = Number(timestampText);

if (
    !Number.isFinite(issuedAt) ||
    !nonce ||
    Date.now() - issuedAt > 5 * 60 * 1000 ||
    issuedAt > Date.now() + 60000
) {
    return res.status(403).send("Authorization state expired.");
}
        

        if (!code) {
            return res.status(400).send("Missing authorization code.");
        }

        const { tokens } = await gmailOAuthClient.getToken(code);

        if (!tokens.refresh_token) {
            return res.status(400).send(
                "No refresh token received. Please restart authorization."
            );
        }

        // Do not log or expose other OAuth tokens.
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>PAWPON Gmail Authorization</title></head>
            <body style="font-family: Arial; padding: 40px;">
                <h2>Authorization Successful!</h2>
                <p>Copy this Refresh Token and save it securely.</p>
                <textarea
                    readonly
                    style="width: 100%; height: 120px;"
                >${tokens.refresh_token}</textarea>
                <p>Do not share this token with anyone.</p>
            </body>
            </html>
        `);

    } catch (error) {
        console.error("Gmail OAuth callback failed:", error.message);

        return res.status(500).send(
            "Gmail authorization failed. Check Railway logs for the error."
        );
    }
});

const {
    csrfSynchronisedProtection,
    generateToken
} = require("../middleware/csrf");
console.log("AUTH ROUTES CHECK:");
console.log("forgotPassword:", typeof authController.forgotPassword);
console.log("resetPassword:", typeof authController.resetPassword);


// ==========================================
// MULTER CONFIGURATION
// ==========================================

const storage = multer.diskStorage({
    destination: "uploads/",

    filename: (req, file, cb) => {
        const randomName = crypto.randomBytes(16).toString("hex");
        const extension = path.extname(file.originalname).toLowerCase();

        cb(null, `${randomName}${extension}`);
    }
});

const upload = multer({
    storage: storage,

    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },

    fileFilter: (req, file, cb) => {
        const allowedExtensions = [
            ".pdf",
            ".jpg",
            ".jpeg",
            ".png"
        ];

        const ext = path.extname(file.originalname).toLowerCase();

        if (allowedExtensions.includes(ext)) {
            cb(null, true);
        } else {
            cb(
                new Error(
                    "Invalid file type. Only PDF, JPG, JPEG, and PNG are allowed."
                )
            );
        }
    }
});

async function validateUploadedFile(file) {
    if (!file || !file.path) {
        return false;
    }

    const detectedType = await fileTypeFromFile(file.path);

    if (!detectedType) {
        return false;
    }

    const allowedMimeTypes = [
        "application/pdf",
        "image/jpeg",
        "image/png"
    ];

    return allowedMimeTypes.includes(detectedType.mime);
}
const redirectAuthenticatedUser = async (req, res, next) => {
    try {
        // No active session
        if (!req.session?.accountId) {
            return next();
        }

        const [rows] = await pool.query(
            `SELECT account_id, role, status
             FROM accounts
             WHERE account_id = ?
             LIMIT 1`,
            [req.session.accountId]
        );

        // Session exists but account no longer exists
        if (!rows.length) {
            return req.session.destroy(() => {
                res.clearCookie("connect.sid", { path: "/" });
                return res.redirect("/auth/login");
            });
        }

        const account = rows[0];

        // Keep session role updated
        req.session.role = account.role;

        // Handle inactive accounts
        if (["disabled", "suspended", "banned", "rejected"].includes(account.status)) {
            return req.session.destroy(() => {
                res.clearCookie("connect.sid", { path: "/" });
                return res.redirect("/auth/login");
            });
        }

        // Pending organization
        if (account.role === "organization" && account.status === "pending") {
            return res.redirect("/org/pending");
        }

        // Redirect according to authenticated role
        if (account.role === "admin") {
            return res.redirect("/admin/dashboard");
        }

        if (account.role === "organization") {
            return res.redirect("/org/dashboard");
        }

        if (account.role === "adopter") {
            return res.redirect("/dashboard");
        }

        return next();

    } catch (error) {
        console.error("Authenticated session check error:", error);
        return next();
    }
};
// ==========================================
// LOGIN PAGE
// ==========================================

router.get("/login", redirectAuthenticated, async (req, res) => {

    // ==========================================
    // CHECK EXISTING AUTHENTICATED SESSION
    // ==========================================
    if (req.session && req.session.user) {

        console.log(
            "Existing authenticated session found:",
            req.session.user.email
        );

        // Use the dashboard stored in the session
        const dashboard = req.session.user.dashboard;

        if (dashboard) {
            return res.redirect(dashboard);
        }

        // Fallback if dashboard is not stored
        switch (req.session.user.role) {

            case "admin":
                return res.redirect("/admin/dashboard");

            case "officer":
                return res.redirect("/org/dashboard");

            case "organization":
                return res.redirect("/org/dashboard");

            case "adopter":
            case "donor":
                return res.redirect("/dashboard");

            default:
                console.warn(
                    "Authenticated session has unknown role:",
                    req.session.user.role
                );

                return res.redirect("/");
        }
    }

    // ==========================================
    // NO ACTIVE SESSION → SHOW LOGIN PAGE
    // ==========================================

    const loginPath = path.join(
        __dirname,
        "../public/auth/login.html"
    );

    fs.readFile(loginPath, "utf8", (err, html) => {

        if (err) {
            console.error("Error loading login page:", err);

            return res
                .status(500)
                .send("Unable to load login page.");
        }

        const csrfToken = generateToken(req);

        const htmlWithCsrf = html.replace(
            /<input\s+type="hidden"\s+name="csrfToken"\s+value="">/i,
            `<input type="hidden" name="csrfToken" value="${csrfToken}">`
        );

        res.send(htmlWithCsrf);
    });
});


// ==========================================
// CREATE ACCOUNT PAGE
// ==========================================

router.get("/create-account", (req, res) => {
    const createAccountPath = path.join(
        __dirname,
        "../public/auth/create_account.html"
    );

    fs.readFile(createAccountPath, "utf8", (err, html) => {
        if (err) {
            console.error(
                "Error loading create account page:",
                err
            );

            return res
                .status(500)
                .send("Unable to load create account page.");
        }

        const csrfToken = generateToken(req);

        const htmlWithCsrf = html.replace(
            /<input\s+type="hidden"\s+name="csrfToken"\s+value="">/i,
            `<input type="hidden" name="csrfToken" value="${csrfToken}">`
        );

        res.send(htmlWithCsrf);
    });
});


// ==========================================
// ORGANIZATION SIGNUP PAGE
// ==========================================

router.get("/organization-signup", (req, res) => {
    const organizationSignupPath = path.join(
        __dirname,
        "../public/auth/organization_signup.html"
    );

    fs.readFile(organizationSignupPath, "utf8", (err, html) => {
        if (err) {
            console.error(
                "Error loading organization signup page:",
                err
            );

            return res
                .status(500)
                .send("Unable to load organization signup page.");
        }

        const csrfToken = generateToken(req);

        const htmlWithCsrf = html.replace(
            /<input\s+type="hidden"\s+name="csrfToken"\s+value="">/i,
            `<input type="hidden" name="csrfToken" value="${csrfToken}">`
        );

        res.send(htmlWithCsrf);
    });
});


// ==========================================
// AUTHENTICATION ROUTES
// ==========================================
router.post(
    "/registration/send-otp",
    csrfSynchronisedProtection,
    authController.sendRegistrationOtp
);

router.post(
    "/registration/verify-otp",
    csrfSynchronisedProtection,
    authController.verifyRegistrationOtp
);

router.post(
    "/register",
    csrfSynchronisedProtection,
    authController.register
);

router.post(
    "/login",
    //csrfSynchronisedProtection, - comment ko muna while nag testing ako sa postman
    authController.login
);

router.post(
    "/google", 
    authController.googleSignIn
);

router.post(
    "/google-login",
    authController.googleLogin
);

router.post(
    "/logout",
    authController.logout
);

router.post(
    "/forgot-password",
    authController.forgotPassword
);

router.post(
    "/reset-password",
    authController.resetPassword
);


// ==========================================
// REAL-TIME AVAILABILITY CHECK
// ==========================================

router.get(
    "/check-email",
    authController.checkEmailAvailability
);

router.get(
    "/check-org-name",
    authController.checkOrgNameAvailability
);


// ==========================================
// ORGANIZATION REGISTRATION
// ==========================================

router.post(
    "/register-organization",

    (req, res, next) => {
        upload.single("document")(req, res, async (err) => {

            if (err instanceof multer.MulterError) {
                // Multer error such as file too large
                return res.status(400).send(err.message);
            }

            if (err) {
                // Custom file validation error
                return res.status(400).send(err.message);
            }

            try {
                const isValidFile = await validateUploadedFile(req.file);

                if (!isValidFile) {
                    if (req.file?.path) {
                        fs.unlink(req.file.path, () => {});
                    }

                    return res.status(400).send(
                        "Invalid file content. Please upload a valid PDF, JPG, JPEG, or PNG file."
                    );
                }

                next();

            } catch (error) {
                console.error("File validation error:", error);

                if (req.file?.path) {
                    fs.unlink(req.file.path, () => {});
                }

                return res.status(400).send(
                    "Unable to validate the uploaded file."
                );
            }
        });
    },

    csrfSynchronisedProtection,
    authController.registerOrganization
);


console.log("Organization route loaded");

module.exports = router;
