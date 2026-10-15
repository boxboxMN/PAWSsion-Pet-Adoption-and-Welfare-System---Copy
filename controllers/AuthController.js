const bcrypt = require('bcrypt');
const validator = require('validator');
const pool = require('../config/database');

const regions = require('../public/data/regions.json');
const provinces = require('../public/data/provinces.json');
const cities = require('../public/data/cities.json');
const barangays = require('../public/data/barangays.json');

const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function normalizeAddress(value) {
    return String(value || '').trim().toLowerCase();
}

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#]).{8,}$/;
const phoneRegex = /^(09\d{9}|\+639\d{9})$/;
const zipRegex = /^\d{4}$/; //for zip code
const crypto = require("crypto");
const transporter = require("../config/email");
// const { logActivity } = require("./adminController");
const { logActivity, createNotification, notifyAllAdmins } = require("./adminController");
const loginAttempts = new Map(); // Map<accountId, { attempts: number, lockedUntil: number|null }>

// ==========================================
// SEND OTP FOR MANUAL REGISTRATION
// ==========================================
exports.sendRegistrationOtp = async (req, res) => {
    const email = (req.body.email || "").trim().toLowerCase();

    if (!validator.isEmail(email)) {
        return res.status(400).json({
            message: "Please enter a valid email address."
        });
    }

    try {
        // Don't send a registration OTP to an email already in use.
        const [existingAccounts] = await pool.query(
            "SELECT account_id FROM accounts WHERE email = ? LIMIT 1",
            [email]
        );

        if (existingAccounts.length > 0) {
            return res.status(409).json({
                message: "An account with this email already exists."
            });
        }

        // Prevent frequent resend requests.
        const [existingOtp] = await pool.query(
            `SELECT id
             FROM registration_email_otps
             WHERE email = ? AND resend_after > NOW()
             LIMIT 1`,
            [email]
        );

        if (existingOtp.length > 0) {
            return res.status(429).json({
                message: "Please wait 60 seconds before requesting another code."
            });
        }

        // Generate a 6-digit code and store only its bcrypt hash.
        const otp = String(crypto.randomInt(100000, 1000000));
        const otpHash = await bcrypt.hash(otp, 10);

        // Replace any older, unverified code for this email.
        await pool.query(
            "DELETE FROM registration_email_otps WHERE email = ?",
            [email]
        );

        await pool.query(
            `INSERT INTO registration_email_otps
                (email, otp_hash, expires_at, resend_after)
             VALUES
                (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE),
                      DATE_ADD(NOW(), INTERVAL 60 SECOND))`,
            [email, otpHash]
        );

        try {
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: "PAWSsion Email Verification Code",
                text: `Your PAWSsion registration verification code is ${otp}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
                html: `
                    <p>Your PAWSsion registration verification code is:</p>
                    <h2>${otp}</h2>
                    <p>This code expires in 10 minutes.</p>
                    <p>If you did not request this, you can ignore this email.</p>
                `
            });
        } catch (emailError) {
            // Remove the unused code if the email could not be sent.
            await pool.query(
                "DELETE FROM registration_email_otps WHERE email = ?",
                [email]
            );

            throw emailError;
        }

        return res.json({
            message: "Verification code sent. Please check your email."
        });

    } catch (error) {
        console.error("sendRegistrationOtp error:", error.message);

        return res.status(500).json({
            message: "Unable to send the verification code right now. Please try again later."
        });
    }
};

// ==========================================
// VERIFY OTP FOR MANUAL REGISTRATION
// ==========================================
exports.verifyRegistrationOtp = async (req, res) => {
    const email = (req.body.email || "").trim().toLowerCase();
    const otp = String(req.body.otp || "").trim();

    if (!validator.isEmail(email) || !/^\d{6}$/.test(otp)) {
        return res.status(400).json({
            message: "Enter a valid email address and 6-digit verification code."
        });
    }

    try {
        const [rows] = await pool.query(
            `SELECT id, otp_hash, expires_at, attempts, verified_at
             FROM registration_email_otps
             WHERE email = ?
             ORDER BY id DESC
             LIMIT 1`,
            [email]
        );

        if (rows.length === 0) {
            return res.status(400).json({
                message: "No verification code found. Please request a new one."
            });
        }

        const record = rows[0];

        if (record.verified_at) {
            return res.json({
                message: "Email already verified. You can continue registration."
            });
        }

        if (record.attempts >= 5) {
            return res.status(429).json({
                message: "Too many incorrect attempts. Please request a new code."
            });
        }

        if (new Date(record.expires_at) <= new Date()) {
            await pool.query(
                "DELETE FROM registration_email_otps WHERE id = ?",
                [record.id]
            );

            return res.status(400).json({
                message: "This code has expired. Please request a new one."
            });
        }

        const isMatch = await bcrypt.compare(otp, record.otp_hash);

        if (!isMatch) {
            await pool.query(
                `UPDATE registration_email_otps
                 SET attempts = attempts + 1
                 WHERE id = ?`,
                [record.id]
            );

            return res.status(400).json({
                message: "Incorrect verification code. Please check and try again."
            });
        }

        await pool.query(
            `UPDATE registration_email_otps
             SET verified_at = NOW()
             WHERE id = ?`,
            [record.id]
        );

        return res.json({
            message: "Email verified. You can continue registration."
        });

    } catch (error) {
        console.error("verifyRegistrationOtp error:", error.message);

        return res.status(500).json({
            message: "Unable to verify the code right now. Please try again."
        });
    }
};

exports.register = async (req, res) => {
  try {
    const firstName = (req.body.firstName || '').trim();
    const lastName = (req.body.lastName || '').trim();
    const birthday = (req.body.birthday || '').trim();
    const civilStatus = (req.body.civilStatus || '').trim() || null;
    const occupation = (req.body.occupation || '').trim() || null;

    const streetAddress = (req.body.streetAddress || '').trim();
    const region = (req.body.region || '').trim();
    const barangay = (req.body.barangay || '').trim();
    const city = (req.body.city || '').trim();
    const province = (req.body.province || '').trim();
    const zipCode = (req.body.zipCode || '').toString().trim().replace(/\D/g, '');
    const phoneNumber = (req.body.phoneNumber || '').trim();
    const googleSignup = req.session.googleSignup || null;

    if (
        googleSignup &&
        (!googleSignup.googleSub || !googleSignup.email)
    ) {
        return res.status(401).send("Google verification session is invalid. Please verify your Google account again.");
    }
    
    const email = googleSignup
    ? googleSignup.email.trim().toLowerCase()
    : (req.body.email || '').trim().toLowerCase();

    const password = req.body.password || '';
    const confirmPassword = req.body.confirmPassword || '';
    

    if (!firstName || !lastName || !birthday || !region || !barangay || !city || !province || !zipCode || !phoneNumber || !email || !password || !confirmPassword) {
        return res.status(400).send('Please fill out all required fields.');
    }

    // ZIP Code format validation
    if (!zipRegex.test(zipCode)) {
        return res.status(400).send('Please enter a valid 4-digit Philippine ZIP code.');
    }

    const selectedRegion = regions.find(
        r => normalizeAddress(r.region_name) === normalizeAddress(region)
    );
    
    if (!selectedRegion) {
        return res.status(400).send('Please select a valid region.');
    }

    const selectedProvince = provinces.find(
        p =>
            normalizeAddress(p.province_name) === normalizeAddress(province) &&
            p.region_code === selectedRegion.region_code
    );
    
    if (!selectedProvince) {
        return res.status(400).send('Please select a valid province for the selected region.');
    }

    console.log("DEBUG ADDRESS:", {
        city,
        province,
        selectedProvinceCode: selectedProvince.province_code
    });

    const selectedCity = cities.find(
        c =>
            normalizeAddress(c.city_name) === normalizeAddress(city) &&
            c.province_code === selectedProvince.province_code
    );
    
    if (!selectedCity) {
        return res.status(400).send('Please select a valid city or municipality for the selected province.');
    }

    const selectedBarangay = barangays.find(
        b =>
            normalizeAddress(b.brgy_name) === normalizeAddress(barangay) &&
            b.city_code === selectedCity.city_code &&
            b.province_code === selectedProvince.province_code
    );
    
    if (!selectedBarangay) {
        return res.status(400).send('Please select a valid barangay for the selected city or municipality.');
    }

    // Birthday validation & 18+ calculation
    const birthDate = new Date(birthday);
    if (isNaN(birthDate.getTime())) {
      return res.status(400).send('Please enter a valid birthday.');
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 18) {
      return res.status(400).send('You must be at least 18 years old to create an account.');
    }
    if (age > 120) {
      return res.status(400).send('Please enter a realistic birth date.');
    }

    if (!validator.isEmail(email)) {
      return res.status(400).send('Please enter a valid email address.');
    }

    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).send('Please enter a valid Philippine mobile number.');
    }
    if (!passwordRegex.test(password)) {
      return res.status(400).send('Password does not meet complexity requirements.');
    }

    if (password !== confirmPassword) {
      return res.status(400).send('Passwords do not match.');
    }

    const [existingAccounts] = await pool.query(
      'SELECT account_id FROM accounts WHERE email = ? LIMIT 1',
      [email]
    );

    if (existingAccounts.length > 0) {
      return res.status(409).send('An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Manual registration must have a verified, unexpired OTP.
      if (!googleSignup) {
        const [verifiedOtps] = await connection.execute(
        `SELECT id
        FROM registration_email_otps
        WHERE email = ?
            AND verified_at IS NOT NULL
            AND expires_at > NOW()
        ORDER BY verified_at DESC
        LIMIT 1`,
        [email]
        );
    
        if (verifiedOtps.length === 0) {
        await connection.rollback();
        return res.status(403).send(
            'Please verify your email with the code before registering.'
        );
        }
      }

      const [accountResult] = await connection.execute(
        'INSERT INTO accounts (email, password_hash, role, status, email_verified, google_sub) VALUES (?, ?, ?, ?, ?, ?)',
        [email, passwordHash, 'adopter', 'active', 1, googleSignup ? googleSignup.googleSub : null]
      );

      await connection.execute(
          `INSERT INTO adopters (
            account_id, first_name, last_name, birthday, civil_status, occupation,
            street_address, region, barangay, city, province, zip_code, phone_number
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            accountResult.insertId, firstName, lastName, birthday, civilStatus, occupation,
            streetAddress, region, barangay, city, province, zipCode, phoneNumber
          ]
      );

      if (!googleSignup) {
        await connection.execute(
          'DELETE FROM registration_email_otps WHERE email = ?',
          [email]
        );
      }
      
      await connection.commit();

      if (googleSignup) {
        delete req.session.googleSignup;
      }

      await logActivity(accountResult.insertId, "account_registered", "user", accountResult.insertId, `Adopter: ${firstName} ${lastName}`);

      return res.redirect('/auth/login?success=1');
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('register error:', error);
    return res.status(500).send('Unable to create account right now.');
  }
};

exports.login = async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';

    if (!email || !password) {
      return res.status(400).send('Email and password are required.');
    }

    // Detect suspicious patterns (SQL injection attempts)
    const suspiciousPattern = /('|--|;|\bor\b\s+\d+\s*=\s*\d+|\bunion\b\s+\bselect\b)/i;
    if (suspiciousPattern.test(email) || suspiciousPattern.test(password)) {
      await logActivity(null, "suspicious_login_input", "auth", null, `Email: ${email}`);
    }

    const [rows] = await pool.query(
      'SELECT account_id, email, password_hash, status, role, last_login FROM accounts WHERE email = ? LIMIT 1',
      [email]
    );
    const genericAuthError = 'Invalid credentials. Please check your email and password.';

    if (rows.length === 0) {
      await logActivity(null, "login_failed", "auth", null, `Unknown email: ${email}`);
      return res.status(401).send(genericAuthError);
    }

    const account = rows[0];

    // --- LOGIN LOCKOUT CHECK ---
    const loginRecord = loginAttempts.get(account.account_id) || { attempts: 5, lockedUntil: null };

    if (loginRecord.lockedUntil && Date.now() < loginRecord.lockedUntil) {
      const remainingTime = Math.ceil((loginRecord.lockedUntil - Date.now()) / 60000);
      await logActivity(account.account_id, "login_locked", "auth", account.account_id, `${remainingTime} min remaining`);
      return res.status(429).send(`Too many failed login attempts. Please try again in ${remainingTime} minute(s).`);
    }

    // ==========================================
    // BLOCKED STATUS CHECKS (before anything else)
    // ==========================================
    if (account.status === "disabled") {
      await logActivity(account.account_id, "login_blocked", "auth", account.account_id, "Account disabled");
      return res.status(403).send("This account has been disabled.");
    }
    if (account.status === "suspended") {
      await logActivity(account.account_id, "login_blocked", "auth", account.account_id, "Account suspended");
      return res.status(403).send("This account has been suspended.");
    }
    if (account.status === "banned") {
      await logActivity(account.account_id, "login_blocked", "auth", account.account_id, "Account banned");
      return res.status(403).send("This account has been permanently banned.");
    }
    if (account.status === "rejected") {
      await logActivity(account.account_id, "login_blocked", "auth", account.account_id, "Account rejected");
      return res.status(403).send("Your account has been rejected.");
    }

    // ==========================================
    // PENDING ORGANIZATION (special flow)
    // ==========================================
    if (account.role === "organization" && account.status === "pending") {
      // 1. Update last_login
      await pool.query(
        `UPDATE accounts SET last_login = NOW() WHERE account_id = ?`,
        [account.account_id]
      );

      // 2. Regenerate session
      await new Promise((resolve, reject) => {
        req.session.regenerate((err) => {
          if (err) return reject(err);
          resolve();
        });
      });

      // 3. Set session data
      req.session.accountId = account.account_id;
      req.session.role = account.role;

      // 4. SAVE session ID to DB (SAS)
      await pool.query(
        `UPDATE accounts SET current_session_id = ? WHERE account_id = ?`,
        [req.sessionID, account.account_id]
      );

      const [orgRows] = await pool.query(
        `SELECT organization_name FROM organizations WHERE account_id = ? LIMIT 1`,
        [account.account_id]
      );

      req.session.displayName = orgRows.length > 0
        ? orgRows[0].organization_name
        : account.email;

      await logActivity(account.account_id, "login_pending_org", "auth", account.account_id, "Org pending verification");

      return res.redirect("/org/pending");
    }

    // ==========================================
    // PASSWORD CHECK
    // ==========================================
    const isValidPassword = await bcrypt.compare(password, account.password_hash);

    if (!isValidPassword) {
      loginRecord.attempts -= 1;

      if (loginRecord.attempts <= 0) {
        loginRecord.lockedUntil = Date.now() + 15 * 60 * 1000;
        loginRecord.attempts = 5;
        loginAttempts.set(account.account_id, loginRecord);

        await logActivity(account.account_id, "login_locked", "auth", account.account_id, "Locked after 5 failed attempts");

        return res.status(429).send("Too many failed login attempts. Your account is temporarily locked for 15 minutes.");
      }

      loginAttempts.set(account.account_id, loginRecord);

      await logActivity(account.account_id, "login_failed", "auth", account.account_id, `Wrong password, attempts remaining: ${loginRecord.attempts}`);
      return res.status(401).send(genericAuthError);
    }

    // Reset lockout on successful password match
    loginAttempts.delete(account.account_id);

    // ==========================================
    // ✅ LOGIN SUCCESS
    // ==========================================

    // Check before updating last_login
    const isFirstLogin = !account.last_login;

    // 1. Update last_login
    await pool.query(
      `UPDATE accounts SET last_login = NOW() WHERE account_id = ?`,
      [account.account_id]
    );

    // 2. ⭐ Regenerate session ID (security best practice)
    await new Promise((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    // 3. Set session data
    req.session.accountId = account.account_id;
    req.session.role = account.role;
    req.session.isFirstLogin = isFirstLogin;

    // 4. ⭐ SAVE session ID to DB (Single Active Session)
    await pool.query(
      `UPDATE accounts SET current_session_id = ? WHERE account_id = ?`,
      [req.sessionID, account.account_id]
    );

    console.log(`[SAS] Login: account ${account.account_id} session ${req.sessionID}`);

    await logActivity(account.account_id, "login_success", "auth", account.account_id);

    // 5. Redirect based on role
    if (account.role === "admin") {
      return res.redirect("/admin/dashboard");
    }

    if (account.role === "adopter") {
      const [adopterRows] = await pool.query(
        "SELECT first_name, last_name FROM adopters WHERE account_id = ? LIMIT 1",
        [account.account_id]
      );

      req.session.displayName = adopterRows.length
        ? `${adopterRows[0].first_name} ${adopterRows[0].last_name}`.trim()
        : account.email;

      return res.redirect("/dashboard");
    }

    if (account.role === "organization") {
      const [orgRows] = await pool.query(
        "SELECT organization_name FROM organizations WHERE account_id = ? LIMIT 1",
        [account.account_id]
      );

      req.session.displayName = orgRows.length ? orgRows[0].organization_name : account.email;
      return res.redirect("/org/dashboard");
    }

    return res.status(403).send("Unknown account role.");

  } catch (error) {
    console.error('login error:', error);
    return res.status(500).send('Unable to sign in right now.');
  }
};
exports.logout = (req, res) => {
    const accountId = req.session?.accountId;
    const sessionId = req.sessionID;

    req.session.destroy(async (err) => {
        if (err) {
            console.error("Logout error:", err);
            return res.status(500).json({
                success: false,
                message: "Failed to logout."
            });
        }

        // ✅ I-clear ang session ID sa DB — pero siguraduhing ikaw pa ang active
        if (accountId && sessionId) {
            try {
                await pool.query(
                    `UPDATE accounts 
                     SET current_session_id = NULL 
                     WHERE account_id = ? AND current_session_id = ?`,
                    [accountId, sessionId]
                );
            } catch (dbErr) {
                console.error("[SAS] Failed to clear session ID:", dbErr);
            }
        }

        res.clearCookie("connect.sid", { path: "/" });

        await logActivity(accountId, "logout", "auth", accountId);

        return res.status(200).json({
            success: true,
            message: "Logged out successfully."
        });
    });
};

exports.registerOrganization = async (req, res) => {
    try {
        // Sanitize and validate inputs on the server-side
        const googleSignup = req.session.googleSignup || null;

        if (
            googleSignup &&
            (!googleSignup.googleSub || !googleSignup.email)
        ) {
            return res.status(401).send("Google verification session is invalid. Please verify your Google account again.");
        }
        
        const email = googleSignup
            ? googleSignup.email.trim().toLowerCase()
            : (req.body.email || '').trim().toLowerCase();

        const password = req.body.password || '';
        const confirmPassword = req.body.confirmPassword || '';
        const organizationName = (req.body.organizationName || '').trim();
        const organizationType = (req.body.organizationType || '').trim();
        const contactPerson = (req.body.contactPerson || '').trim();
        const contactNumber = (req.body.contactNumber || '').trim();
       const streetAddress = (req.body.streetAddress || '').trim();
        const region = (req.body.region || '').trim();
        const province = (req.body.province || '').trim();
        const city = (req.body.city || '').trim();
        const barangay = (req.body.barangay || '').trim();
        const zipCode = (req.body.zipCode || '').toString().trim().replace(/\D/g, '');
        const description = (req.body.description || '').trim();

        if (
            !email || !password || !confirmPassword || !organizationName || 
            !organizationType || !contactPerson || !contactNumber || 
            !region || !province || !city || !barangay || !zipCode
        ) {
            return res.status(400).send("Please complete all required fields.");
        }


        if (!zipRegex.test(zipCode)) {
            return res.status(400).send("Please enter a valid 4-digit Philippine ZIP code.");
        }

        const selectedRegion = regions.find(
            r => normalizeAddress(r.region_name) === normalizeAddress(region)
        );
        
        if (!selectedRegion) {
            return res.status(400).send("Please select a valid region.");
        }
        
        const selectedProvince = provinces.find(
            p =>
                normalizeAddress(p.province_name) === normalizeAddress(province) &&
                p.region_code === selectedRegion.region_code
        );
        
        if (!selectedProvince) {
            return res.status(400).send("Please select a valid province for the selected region.");
        }
        
        const selectedCity = cities.find(
            c =>
                normalizeAddress(c.city_name) === normalizeAddress(city) &&
                c.province_code === selectedProvince.province_code
        );
        
        if (!selectedCity) {
            return res.status(400).send("Please select a valid city or municipality for the selected province.");
        }
        
        const selectedBarangay = barangays.find(
            b =>
                normalizeAddress(b.brgy_name) === normalizeAddress(barangay) &&
                b.city_code === selectedCity.city_code &&
                b.province_code === selectedProvince.province_code
        );
        
        if (!selectedBarangay) {
            return res.status(400).send("Please select a valid barangay for the selected city or municipality.");
        }
        
        if (!validator.isEmail(email)) {
            return res.status(400).send("Please enter a valid email address.");
        }
        if (!phoneRegex.test(contactNumber)) {
            return res.status(400).send("Please enter a valid Philippine mobile number.");
        }
        if (!passwordRegex.test(password)) {
            return res.status(400).send("Password does not meet complexity requirements.");
        }

        if (password !== confirmPassword) {
            return res.status(400).send("Passwords do not match.");
        }
        if (!req.file) {
            return res.status(400).send("Verification document is required.");
        }

        const [existing] = await pool.query(
            "SELECT account_id FROM accounts WHERE email=?",
            [email]
        );

        if (existing.length > 0) {
            return res.status(400).send("An account with this email already exists.");
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            // Manual organization registration requires verified email OTP.
            if (!googleSignup) {
                const [verifiedOtps] = await connection.query(
                    `SELECT id
                    FROM registration_email_otps
                    WHERE email = ?
                    AND verified_at IS NOT NULL
                    AND expires_at > NOW()
                    ORDER BY verified_at DESC
                    LIMIT 1`,
                    [email]
                );

                if (verifiedOtps.length === 0) {
                    await connection.rollback();

                    return res.status(403).send(
                        "Please verify your email with the code before registering."
                    );
                }
            }

            const [accountResult] = await connection.query(
                `INSERT INTO accounts (email, password_hash, role, status, email_verified, google_sub) VALUES (?, ?, ?, ?, ?, ?)`,
                [email, passwordHash, "organization", "pending", 1, googleSignup ? googleSignup.googleSub : null]
            );

            const accountId = accountResult.insertId;

            const [organizationResult] = await connection.query(
                `INSERT INTO organizations (
                    account_id, organization_name, organization_type, contact_person, 
                    contact_number, address, region, province, city, 
                    barangay, zip_code, description, verification_status
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                [
                    accountId, organizationName, organizationType, contactPerson,
                    contactNumber, streetAddress, region, province, city, barangay, 
                    zipCode, description, "Pending"
                ]
            );
            
            const organizationId = organizationResult.insertId;

            await connection.query(
                `INSERT INTO organization_documents (organization_id, document_name, file_path) VALUES (?, ?, ?)`,
                [organizationId, req.file.originalname, req.file.filename]
            );

            if (!googleSignup) {
                await connection.query(
                    "DELETE FROM registration_email_otps WHERE email = ?",
                    [email]
                );
            }
            
            await connection.commit();

            if (googleSignup) {
                delete req.session.googleSignup;
            }

            await logActivity(accountId, "account_registered", "user", accountId, `Organization: ${organizationName}`);

            await notifyAllAdmins(
                "New Organization Pending Approval",
                `${organizationName} has registered and is awaiting verification.`,
                "org_pending",
                "/admin/organization"
            );

            res.send("Organization registered successfully.");

        } catch(err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

    } catch(err) {
        console.error(err);
        res.status(500).send("Registration failed. Please try again later.");
    }
};

exports.checkEmailAvailability = async (req, res) => {
    try {
        const email = (req.query.email || '').trim().toLowerCase();

        if (!email) {
            return res.status(400).send("Email parameter is required.");
        }
        const [existingAccounts] = await pool.query(
            'SELECT account_id FROM accounts WHERE email = ?',
            [email]
        );

        if (existingAccounts.length > 0) {
            return res.status(409).send("Email is already registered.");
        }
        return res.status(200).send("Email is available.");
    } catch (err) {
        console.error("Error sa checkEmailAvailability:", err);
        return res.status(500).send("Internal server error.");
    }
};

exports.checkOrgNameAvailability = async (req, res) => {
    try {
        const orgName = (req.query.orgName || '').trim();

        if (!orgName) {
            return res.status(400).send("Organization name parameter is required.");
        }
        const [existingOrg] = await pool.query(
            'SELECT organization_id FROM organizations WHERE LOWER(organization_name) = LOWER(?)',
            [orgName]
        );

        if (existingOrg.length > 0) {
            
            return res.status(409).send("Organization name is already taken.");
        }
        return res.status(200).send("Organization name is available.");
    } catch (err) {
        console.error("Error sa checkOrgNameAvailability:", err);
        return res.status(500).send("Internal server error.");
    }
};
//FORGOT PASSWORD
exports.forgotPassword = async (req, res) => {
    try {
        const email = (req.body.email || "").trim().toLowerCase();

        if (!email) {
            return res.status(400).send("Email is required.");
        }

        if (!validator.isEmail(email)) {
            return res.status(400).send("Please enter a valid email address.");
        }

        const [accounts] = await pool.query(
            `
            SELECT account_id, email
            FROM accounts
            WHERE email = ?
            LIMIT 1
            `,
            [email]
        );

        // Do not reveal whether the email exists
        if (accounts.length === 0) {
            return res.status(200).send(
                "If an account with that email exists, a password reset link has been sent."
            );
        }

        const account = accounts[0];

        // Generate secure random token
        const rawToken = crypto.randomBytes(32).toString("hex");

        // Store only the hash of the token
        const tokenHash = crypto
            .createHash("sha256")
            .update(rawToken)
            .digest("hex");

        // Token expires after 30 minutes
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

        // Delete previous unused tokens for this account
        await pool.query(
            `
            DELETE FROM password_reset_tokens
            WHERE account_id = ?
            `,
            [account.account_id]
        );

        // Store new reset token
        await pool.query(
            `
            INSERT INTO password_reset_tokens
            (
                account_id,
                token_hash,
                expires_at
            )
            VALUES (?, ?, ?)
            `,
            [
                account.account_id,
                tokenHash,
                expiresAt
            ]
        );

        const resetLink =
            `${process.env.APP_URL}/auth/reset-password.html?token=${rawToken}`;

        await transporter.sendMail({
            from: `"Pawpon Support" <${process.env.EMAIL_USER}>`,
            to: account.email,
            subject: "Pawpon Password Reset",
            html: `
                <div style="
                    font-family: Arial, sans-serif;
                    max-width: 600px;
                    margin: auto;
                    padding: 30px;
                    color: #334155;
                ">
                    <h2 style="color:#1656ff;">
                        Pawpon Password Reset
                    </h2>

                    <p>
                        We received a request to reset your Pawpon account password.
                    </p>

                    <p>
                        Click the button below to create a new password.
                    </p>

                    <div style="margin:30px 0;">
                        <a
                            href="${resetLink}"
                            style="
                                background:#1656ff;
                                color:white;
                                padding:12px 22px;
                                border-radius:8px;
                                text-decoration:none;
                                font-weight:bold;
                                display:inline-block;
                            "
                        >
                            Reset My Password
                        </a>
                    </div>

                    <p style="font-size:13px;color:#64748b;">
                        This link will expire in 30 minutes.
                    </p>

                    <p style="font-size:13px;color:#64748b;">
                        If you did not request a password reset, you can safely ignore this email.
                    </p>
                </div>
            `
        });

        return res.status(200).send(
            "If an account with that email exists, a password reset link has been sent."
        );

    } catch (error) {
        console.error("forgotPassword error:", error);

        return res.status(500).send(
            "Unable to process password reset right now."
        );
    }
};

//CHANGE PASSWORD
exports.resetPassword = async (req, res) => {
    try {
        const token = (req.body.token || "").trim();
        const password = req.body.password || "";
        const confirmPassword = req.body.confirmPassword || "";

        if (!token || !password || !confirmPassword) {
            return res.status(400).send("All fields are required.");
        }

        if (!passwordRegex.test(password)) {
            return res.status(400).send(
                "Password must contain at least 8 characters, including uppercase, lowercase, number, and special character."
            );
        }

        if (password !== confirmPassword) {
            return res.status(400).send("Passwords do not match.");
        }

        // Hash token so the raw token is never stored in DB
        const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        const [rows] = await pool.query(
            `
            SELECT
                reset_id,
                account_id
            FROM password_reset_tokens
            WHERE token_hash = ?
              AND used_at IS NULL
              AND expires_at > NOW()
            LIMIT 1
            `,
            [tokenHash]
        );

        if (rows.length === 0) {
            return res.status(400).send(
                "This password reset link is invalid or has expired."
            );
        }

        const resetRequest = rows[0];

        // Hash new password
        const passwordHash = await bcrypt.hash(password, 10);

        // Update actual account password
        await pool.query(
            `
            UPDATE accounts
            SET password_hash = ?
            WHERE account_id = ?
            `,
            [
                passwordHash,
                resetRequest.account_id
            ]
        );

        // Mark reset token as used
        await pool.query(
            `
            UPDATE password_reset_tokens
            SET used_at = NOW()
            WHERE reset_id = ?
            `,
            [resetRequest.reset_id]
        );

        return res.status(200).send(
            "Password changed successfully."
        );

    } catch (error) {
        console.error("resetPassword error:", error);

        return res.status(500).send(
            "Unable to reset password right now."
        );
    }
};

// GOOGLE SIGN-IN: VERIFY CREDENTIAL AND STAGE NEW REGISTRATION
exports.googleSignIn = async (req, res) => {
    try {
        const credential = req.body?.credential;

        if (!credential) {
            return res.status(400).json({
                success: false,
                message: "Google credential is required."
            });
        }

        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();

        if (
            !payload ||
            !payload.sub ||
            !payload.email ||
            payload.email_verified !== true
        ) {
            return res.status(401).json({
                success: false,
                message: "Google account verification failed."
            });
        }

        const email = payload.email.trim().toLowerCase();

        // Check if this Google account is already linked
        const [googleAccounts] = await pool.query(
            `SELECT account_id
             FROM accounts
             WHERE google_sub = ?
             LIMIT 1`,
            [payload.sub]
        );

        if (googleAccounts.length > 0) {
            return res.status(409).json({
                success: false,
                message: "This Google account is already registered. Account sign-in will be handled in the next step."
            });
        }

        // Prevent creating a second account with an existing email
        const [existingAccounts] = await pool.query(
            `SELECT account_id
             FROM accounts
             WHERE email = ?
             LIMIT 1`,
            [email]
        );

        if (existingAccounts.length > 0) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists. Please sign in using your existing account."
            });
        }

        // Keep verified Google details temporarily for the registration flow
        req.session.googleSignup = {
            googleSub: payload.sub,
            email,
            firstName: payload.given_name || "",
            lastName: payload.family_name || ""
        };

        return res.status(200).json({
            success: true,
            next: "choose_role",
            email,
            firstName: payload.given_name || "",
            lastName: payload.family_name || ""
        });

    } catch (error) {
        console.error("Google sign-in verification error:", error);

        return res.status(401).json({
            success: false,
            message: "Unable to verify your Google account. Please try again."
        });
    }
};

// GOOGLE LOGIN: VERIFY GOOGLE ACCOUNT AND SIGN IN EXISTING USER
exports.googleLogin = async (req, res) => {
    try {
        const credential = req.body?.credential;

        if (!credential) {
            return res.status(400).json({
                success: false,
                message: "Google credential is required."
            });
        }

        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();

        if (
            !payload ||
            !payload.sub ||
            !payload.email ||
            payload.email_verified !== true
        ) {
            return res.status(401).json({
                success: false,
                message: "Google account verification failed."
            });
        }

        // First, find an account already linked to this Google identity.
        let [rows] = await pool.query(
            `SELECT account_id, email, role, status, google_sub, last_login
            FROM accounts
            WHERE google_sub = ?
            LIMIT 1`,
            [payload.sub]
        );

        // If not linked yet, check whether the verified Google email
        // belongs to an existing PAWSsion account.
        if (rows.length === 0) {
            const [emailRows] = await pool.query(
                `SELECT account_id, email, role, status, google_sub
                FROM accounts
                WHERE LOWER(email) = LOWER(?)
                LIMIT 1`,
                [payload.email]
            );

            if (emailRows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "No PAWSsion account is linked to this Google account. Please register first."
                });
            }

            const existingAccount = emailRows[0];

            // Do not replace a Google identity already linked to another account.
            if (existingAccount.google_sub) {
                return res.status(409).json({
                    success: false,
                    message: "This PAWSsion account is already linked to a different Google account."
                });
            }

            // Link only if the account is still unlinked.
            const [updateResult] = await pool.query(
                `UPDATE accounts
                SET google_sub = ?
                WHERE account_id = ?
                AND google_sub IS NULL`,
                [payload.sub, existingAccount.account_id]
            );

            if (updateResult.affectedRows !== 1) {
                return res.status(409).json({
                    success: false,
                    message: "Unable to link this Google account. Please try again."
                });
            }

            rows = [existingAccount];
        }

        const account = rows[0];

        if (account.status === "disabled") {
            return res.status(403).json({ success: false, message: "This account has been disabled." });
        }
        if (account.status === "suspended") {
            return res.status(403).json({ success: false, message: "This account has been suspended." });
        }
        if (account.status === "banned") {
            return res.status(403).json({ success: false, message: "This account has been permanently banned." });
        }
        if (account.status === "rejected") {
            return res.status(403).json({ success: false, message: "Your account has been rejected." });
        }

        // Regenerate session ID before signing in.
        await new Promise((resolve, reject) => {
            req.session.regenerate((err) => {
                if (err) return reject(err);
                resolve();
            });
        });

        req.session.accountId = account.account_id;
        req.session.role = account.role;
        req.session.isFirstLogin = !account.last_login;

        let redirectUrl = "";

        if (account.role === "admin") {
            redirectUrl = "/admin/dashboard";
        } else if (account.role === "adopter") {
            const [adopterRows] = await pool.query(
                "SELECT first_name, last_name FROM adopters WHERE account_id = ? LIMIT 1",
                [account.account_id]
            );

            req.session.displayName = adopterRows.length
                ? `${adopterRows[0].first_name} ${adopterRows[0].last_name}`.trim()
                : account.email;

            redirectUrl = "/dashboard";
        } else if (account.role === "organization") {
            const [orgRows] = await pool.query(
                "SELECT organization_name FROM organizations WHERE account_id = ? LIMIT 1",
                [account.account_id]
            );

            req.session.displayName = orgRows.length
                ? orgRows[0].organization_name
                : account.email;

            redirectUrl = account.status === "pending"
                ? "/org/pending"
                : "/org/dashboard";
        } else {
            return res.status(403).json({
                success: false,
                message: "Unknown account role."
            });
        }

        await pool.query(
            "UPDATE accounts SET last_login = NOW(), current_session_id = ? WHERE account_id = ?",
            [req.sessionID, account.account_id]
        );

        await logActivity(
            account.account_id,
            "login_success",
            "auth",
            account.account_id,
            "Google login"
        );

        return res.status(200).json({
            success: true,
            redirectUrl
        });

    } catch (error) {
        console.error("Google login error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to sign in with Google right now. Please try again."
        });
    }
};