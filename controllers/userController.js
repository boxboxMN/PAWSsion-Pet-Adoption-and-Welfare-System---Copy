
const pool = require("../config/database"); 
const bcrypt = require("bcrypt");
const validator = require('validator');
const AdoptionModel = require('../models/userModel');
const { getAnimalImages } = require("../models/animalImageModel");
const { logActivity } = require("./adminController");
const { createNotification, notifyAllAdmins } = require("./adminController");
const { uploadToCloudinary } = require("../services/cloudinaryUpload");

const crypto = require("crypto");
const transporter = require("../config/email");

const regions = require("../public/data/regions.json");
const provinces = require("../public/data/provinces.json");
const cities = require("../public/data/cities.json");
const barangays = require("../public/data/barangays.json");

function normalizeImagePath(imagePath, legacyFolder, fallback = "") {
    if (typeof imagePath !== "string") {
        return fallback;
    }

    const image = imagePath.trim();
    if (!image || image === "null" || image === "undefined") {
        return fallback;
    }

    const cloudinaryMatch = image.match(
        /https?:\/\/res\.cloudinary\.com\/[^\s"'<>]+/i
    );
    if (cloudinaryMatch) {
        return cloudinaryMatch[0];
    }

    if (/^https?:\/\//i.test(image)) {
        return image;
    }

    const localPath = image.replace(/\\/g, "/");
    if (localPath.startsWith("/")) {
        return localPath;
    }
    if (localPath.startsWith("uploads/")) {
        return `/${localPath}`;
    }

    return `${legacyFolder.replace(/\/+$/, "")}/${encodeURIComponent(localPath)}`;
}

// =====================================================
// SEUSR-03: ADOPTION APPLICATION VALIDATION HELPERS
// =====================================================
const ADOPTION_NAME_REGEX       = /^[a-zA-ZñÑáéíóúÁÉÍÓÚàèìòùÀÈÌÒÙ\s.'-]{2,100}$/;
const ADOPTION_PHONE_REGEX      = /^(09\d{9}|\+639\d{9})$/;
const ADOPTION_ADDRESS_REGEX    = /^[a-zA-Z0-9ñÑáéíóúÁÉÍÓÚ\s.,#\-\/()]{5,255}$/;
const ADOPTION_OCCUPATION_REGEX = /^[a-zA-Z0-9ñÑ\s.,\-()\/]{2,100}$/;
const ADOPTION_RELATION_REGEX   = /^[a-zA-ZñÑ\s.\-]{2,50}$/;
const ADOPTION_ALLOWED_CIVIL    = ['Single', 'Married', 'Widowed', 'Separated', 'Divorced', 'Annulled'];

// 5+ sunod-sunod na parehong character (hal. "aaaaa", "!!!!!")
const ADOPTION_GIBBERISH_REGEX  = /(.)\1{4,}/;

// SQL injection / XSS / dangerous patterns
const ADOPTION_DANGEROUS_REGEX  = /(<script|<\/script|javascript:|onerror\s*=|onload\s*=|onclick\s*=|onmouseover\s*=|onfocus\s*=|onblur\s*=|<iframe|<img\s|<\s*script|'\s*--|;\s*drop\s|;\s*delete\s|;\s*update\s|;\s*insert\s|union\s+select|or\s+1\s*=\s*1|or\s+'1'\s*=\s*'1'|\bexec\s*\(|\bxp_cmdshell\b|<svg|<object|<embed)/i;

function validateAdoptionField(value, {
    fieldName   = 'Field',
    required    = true,
    minLength   = 1,
    maxLength   = 255,
    regex       = null,
    custom      = null
} = {}) {

    if (value === undefined || value === null || String(value).trim() === '') {
        if (required) {
            const err = new Error(`${fieldName} is required.`);
            err.code = 'VALIDATION';
            throw err;
        }
        return null;
    }

    const clean = String(value).trim();

    if (clean.length < minLength) {
        const err = new Error(`${fieldName} must be at least ${minLength} characters.`);
        err.code = 'VALIDATION';
        throw err;
    }
    if (clean.length > maxLength) {
        const err = new Error(`${fieldName} is too long (maximum ${maxLength} characters).`);
        err.code = 'VALIDATION';
        throw err;
    }

    // Dangerous pattern check (XSS / SQLi)
    if (ADOPTION_DANGEROUS_REGEX.test(clean)) {
        const err = new Error(`${fieldName} contains invalid or dangerous characters.`);
        err.code = 'VALIDATION';
        throw err;
    }

    // Gibberish check
    if (ADOPTION_GIBBERISH_REGEX.test(clean)) {
        const err = new Error(`${fieldName} looks like gibberish. Please enter real information.`);
        err.code = 'VALIDATION';
        throw err;
    }

    // Format regex
    if (regex && !regex.test(clean)) {
        const err = new Error(`${fieldName} contains invalid characters.`);
        err.code = 'VALIDATION';
        throw err;
    }

    // Custom validation
    if (typeof custom === 'function') {
        const customMsg = custom(clean);
        if (customMsg) {
            const err = new Error(customMsg);
            err.code = 'VALIDATION';
            throw err;
        }
    }

    return clean;
}
exports.getProfile = async (req, res) => {
    const accountId = req.session?.accountId;
    if (!accountId) return res.status(401).json({ error: "Unauthorized" });

    try {
        
        const [rows] = await pool.query(
            `SELECT 
                adopters.first_name, 
                adopters.last_name, 
                accounts.email, 
                accounts.role,
                adopters.phone_number, 
                adopters.birthday,
                adopters.civil_status,
                adopters.occupation,
                adopters.street_address,
                adopters.barangay,
                adopters.city,
                adopters.province,
                adopters.region,
                adopters.zip_code,
                adopters.profile_picture, 
                accounts.created_at
                FROM adopters 
             JOIN accounts ON adopters.account_id = accounts.account_id 
             WHERE adopters.account_id = ?`,
            [accountId]
        );

        if (rows.length === 0) return res.status(404).json({ error: "Profile not found" });
        res.json(rows[0]);
    } catch (error) {
        console.error("Get Profile Error:", error);
        res.status(500).json({ error: "Server error" });
    }
};

exports.updateProfile = async (req, res) => {
    const accountId = req.session?.accountId;
    if (!accountId) {
        return res.status(401).json({ error: "Unauthorized access" });
    }

    const firstName = (req.body.firstName || '').trim();
    const lastName = (req.body.lastName || '').trim();
    
    const email = (req.body.email || '')
        .trim()
        .toLowerCase();
    
    const mobile = (req.body.mobile || '')
        .trim()
        .replace(/\s+/g, '');
    
    const birthday = (req.body.birthday || '').trim();
    const civilStatus = (req.body.civilStatus || '').trim();
    const occupation = (req.body.occupation || '').trim();
    const streetAddress = (req.body.streetAddress || '').trim();
    const barangay = (req.body.barangay || '').trim();
    const city = (req.body.city || '').trim();
    const province = (req.body.province || '').trim();
    const region = (req.body.region || '').trim();
    const zipCode = (req.body.zipCode || '')
        .toString()
        .trim()

     if (!firstName || !lastName || !email) {
        return res.status(400).json({ error: "First name, Last name, and Email are required." });
    }

    const zipRegex = /^\d{4}$/;

    if (zipCode && !zipRegex.test(zipCode)) {
        return res.status(400).json({
            success: false,
            error: "Please enter a valid 4-digit ZIP code."
        });
    }

    // ADDRESS HIERARCHY VALIDATION
    function normalizeAddress(value) {
        return String(value || '').trim().toLowerCase();
    }

    const selectedRegion = regions.find(
        r => normalizeAddress(r.region_name) === normalizeAddress(region)
    );

    if (!selectedRegion) {
        return res.status(400).json({
            success: false,
            error: "Please select a valid region."
        });
    }

    const selectedProvince = provinces.find(
        p =>
            normalizeAddress(p.province_name) === normalizeAddress(province) &&
            p.region_code === selectedRegion.region_code
    );

    if (!selectedProvince) {
        return res.status(400).json({
            success: false,
            error: "Please select a valid province for the selected region."
        });
    }

    const selectedCity = cities.find(
        c =>
            normalizeAddress(c.city_name) === normalizeAddress(city) &&
            c.province_code === selectedProvince.province_code
    );

    if (!selectedCity) {
        return res.status(400).json({
            success: false,
            error: "Please select a valid city or municipality for the selected province."
        });
    }

    const selectedBarangay = barangays.find(
        b =>
            normalizeAddress(b.brgy_name) === normalizeAddress(barangay) &&
            b.city_code === selectedCity.city_code &&
            b.province_code === selectedProvince.province_code
    );

    if (!selectedBarangay) {
        return res.status(400).json({
            success: false,
            error: "Please select a valid barangay for the selected city or municipality."
        });
    }

    // ==========================================
    // EMAIL VALIDATION
    // ==========================================
    const strictEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;

    if (!validator.isEmail(email) || !strictEmailRegex.test(email)) {
        return res.status(400).json({
            success: false,
            error: "Please enter a valid email address."
        });
    }

    // ==========================================
    // MOBILE NUMBER VALIDATION
    // ==========================================
    const phoneRegex = /^(09\d{9}|\+639\d{9})$/;

    if (mobile && !phoneRegex.test(mobile)) {
        return res.status(400).json({
            success: false,
            error: "Please enter a valid Philippine mobile number."
        });
    }

     const [currentAccount] = await pool.query(
        `SELECT email
         FROM accounts
         WHERE account_id = ?
         LIMIT 1`,
        [accountId]
    );
    
    if (currentAccount.length === 0) {
        return res.status(404).json({
            success: false,
            error: "Account not found."
        });
    }
    
    const currentEmail = String(currentAccount[0].email || "")
        .trim()
        .toLowerCase();
    
    const emailChanged = email !== currentEmail;

    const [existingEmail] = await pool.query(
        `SELECT account_id 
         FROM accounts 
         WHERE LOWER(email) = LOWER(?) 
         AND account_id != ?
         LIMIT 1`,
        [email, accountId]
    );
    
    if (existingEmail.length > 0) {
        return res.status(409).json({
            success: false,
            error: "An account with this email already exists."
        });
    }

     // Require a verified OTP only when the email changes.
    if (emailChanged) {
        const [verifiedOtp] = await pool.query(
            `SELECT id
            FROM profile_email_change_otps
            WHERE account_id = ?
            AND email = ?
            AND verified_at IS NOT NULL
            AND expires_at > NOW()
            AND attempts < 5
            ORDER BY id DESC
            LIMIT 1`,
            [accountId, email]
        );

        if (verifiedOtp.length === 0) {
            return res.status(403).json({
                success: false,
                error: "Please verify your new email address before saving your profile.",
                requiresEmailVerification: true
            });
        }
    }
    
    const connection = await pool.getConnection();
    try {
      
        await connection.beginTransaction();

        
        await connection.query(
            `UPDATE accounts SET email = ? WHERE account_id = ?`,
            [email, accountId]
        );

        // Remove the verified OTP after the email change.
        if (emailChanged) {
            await connection.query(
                `DELETE FROM profile_email_change_otps
                WHERE account_id = ? AND email = ?`,
                [accountId, email]
            );
        }
        
        await connection.query(
            `UPDATE adopters SET 
                first_name = ?, 
                last_name = ?, 
                phone_number = ?, 
                birthday = ?, 
                civil_status = ?, 
                occupation = ?, 
                street_address = ?, 
                barangay = ?, 
                city = ?, 
                province = ?, 
                region = ?, 
                zip_code = ?
             WHERE account_id = ?`,
            [
                firstName,
                lastName,
                mobile || null,
                birthday || null,
                civilStatus || null,
                occupation || null,
                streetAddress || null,
                barangay || null,
                city || null,
                province || null,
                region || null,
                zipCode || null,
                accountId
            ]
        );

        await connection.commit();

        
        req.session.displayName = `${firstName} ${lastName}`.trim() || email;

        res.json({ success: true, message: "Profile updated successfully!" });
    } catch (error) {
        await connection.rollback();
        console.error("Update profile database error:", error);
        res.status(500).json({ error: "Database transaction failed during update" });
    } finally {
        connection.release();
    }
};

const userPasswordAttempts = new Map();

function getUserAttemptRecord(accountId) {
    return userPasswordAttempts.get(accountId) || { attempts: 5, lockedUntil: null };
}

/**
 * VERIFY USER'S CURRENT PASSWORD (used to unlock New Password fields)
 * POST /api/user/profile/verify-password
 */
exports.verifyPassword = async (req, res) => {
    const accountId = req.session?.accountId;
    if (!accountId) {
        return res.status(401).json({ error: "Unauthorized access" });
    }

    const record = getUserAttemptRecord(accountId);

    if (record.lockedUntil && Date.now() < record.lockedUntil) {
        const remainingTime = Math.ceil((record.lockedUntil - Date.now()) / 60000);
        return res.status(429).json({
            valid: false,
            locked: true,
            message: `Too many failed attempts. Try again in ${remainingTime} minute(s).`
        });
    }

    const { currentPassword } = req.body;
    if (!currentPassword) {
        return res.status(400).json({ valid: false, message: "Password is required." });
    }

    try {
        const [users] = await pool.query(
            `SELECT password_hash FROM accounts WHERE account_id = ? LIMIT 1`,
            [accountId]
        );

        if (!users.length) {
            return res.status(404).json({ valid: false, message: "User not found" });
        }

        const isMatch = await bcrypt.compare(currentPassword, users[0].password_hash);

        if (!isMatch) {
            record.attempts -= 1;

            if (record.attempts <= 0) {
                record.lockedUntil = Date.now() + 15 * 60 * 1000;
                record.attempts = 5;
                userPasswordAttempts.set(accountId, record);

                return res.status(429).json({
                    valid: false,
                    locked: true,
                    message: "Too many failed attempts. You are locked out from changing password for 15 minutes."
                });
            }

            userPasswordAttempts.set(accountId, record);

            return res.json({
                valid: false,
                attemptsLeft: record.attempts,
                message: `Incorrect password. You have ${record.attempts} attempt(s) remaining.`
            });
        }

        res.json({ valid: true });

    } catch (error) {
        console.error("Verify password error:", error);
        res.status(500).json({ valid: false, message: "Server error during verification" });
    }
};

exports.updatePassword = async (req, res) => {
    const accountId = req.session?.accountId;
    if (!accountId) {
        return res.status(401).json({ error: "Unauthorized access" });
    }

    const record = getUserAttemptRecord(accountId);

    // 1. CHECK KUNG NAKA-LOCKOUT
    if (record.lockedUntil && Date.now() < record.lockedUntil) {
        const remainingTime = Math.ceil((record.lockedUntil - Date.now()) / 60000);
        return res.status(429).json({
            error: `Too many failed attempts. Try again in ${remainingTime} minute(s).`,
            locked: true
        });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "All fields are required" });
    }

    try {
        const [users] = await pool.query(
            `SELECT password_hash FROM accounts WHERE account_id = ? LIMIT 1`,
            [accountId]
        );

        if (!users.length) {
            return res.status(404).json({ error: "User not found" });
        }

        const user = users[0];

        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);

        if (!isMatch) {
            record.attempts -= 1;

            if (record.attempts <= 0) {
                record.lockedUntil = Date.now() + 15 * 60 * 1000;
                record.attempts = 5;
                userPasswordAttempts.set(accountId, record);

                return res.status(429).json({
                    error: "Too many failed attempts. You are locked out from changing password for 15 minutes.",
                    locked: true
                });
            }

            userPasswordAttempts.set(accountId, record);

            return res.status(400).json({
                error: "Incorrect Current Password",
                attemptsLeft: record.attempts
            });
        }

        // Reset on success
        userPasswordAttempts.delete(accountId);

        const saltRounds = 10;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

        await pool.query(
            `UPDATE accounts SET password_hash = ? WHERE account_id = ?`,
            [newPasswordHash, accountId]
        );

        await logActivity(accountId, "user_profile_updated", "user_profile", accountId, "Password changed");

        res.json({ success: true, message: "Password updated successfully!" });
    } catch (error) {
        console.error("Update password database error:", error);
        res.status(500).json({ error: "Server error during password update" });
    }
};


exports.updateAvatar = async (req, res) => {
    const accountId = req.session?.accountId;

    if (!accountId) {
        return res.status(401).json({
            success: false,
            error: "Unauthorized access. Please re-login."
        });
    }

    if (!req.file) {
        return res.status(400).json({
            success: false,
            error: "No image file provided or file type invalid."
        });
    }

    // Cloudinary returns the hosted image URL here.
    const profilePictureUrl = req.file?.path;
    if (
        typeof profilePictureUrl !== "string" ||
        !/^https?:\/\//i.test(profilePictureUrl)
    ) {
        return res.status(500).json({
            success: false,
            error: "Cloudinary did not return a valid avatar URL."
        });
    }

    try {
        const queryText = `
            UPDATE adopters
            SET profile_picture = ?
            WHERE account_id = ?
        `;

        const [result] = await pool.query(queryText, [
            profilePictureUrl,
            accountId
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                error: "Adopter profile record not found."
            });
        }

        return res.json({
            success: true,
            message: "Profile picture saved successfully!",
            avatarUrl: profilePictureUrl
        });

    } catch (error) {
        console.error("Avatar update error:", error);

        return res.status(500).json({
            success: false,
            error: "Failed to save profile picture."
        });
    }
};

// ==========================================
// PET & ORGANIZATION FEEDS
// ==========================================
exports.getAvailablePets = async (req, res) => {
    try {

        const [pets] = await pool.query(`
            SELECT
                a.*,
                o.organization_name,
                o.profile_pic
            FROM animals a
            INNER JOIN organizations o
                ON a.organization_id = o.organization_id
            WHERE a.adoption_status='Available'
            AND a.deleted_at IS NULL
            ORDER BY a.created_at DESC
        `);

        const additionalImages = await getAnimalImages(
            pets.map(pet => pet.animal_id)
        );

        // Attach medical history
        for (const pet of pets) {
            const petImages = [
                ...(pet.image_path ? [pet.image_path] : []),
                ...(additionalImages.get(pet.animal_id) || [])
            ];
            pet.images = [...new Set(petImages)];

            const [medical] = await pool.query(`
                SELECT
                    medical_id,
                    treatment,
                    administered_date,
                    administered_by,
                    notes
                FROM animal_medical_history
                WHERE animal_id = ?
                ORDER BY administered_date DESC
            `, [pet.animal_id]);

            pet.medical_history = medical;
        }

        res.json({
            success: true,
            pets
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: "Failed to load pets."
        });

    }
};

exports.getPetFavorites = async (req, res) => {
    const accountId = req.session?.accountId;
    if (!accountId) {
        return res.status(401).json({ success: false, message: "Unauthorized access." });
    }

    try {
        const [favorites] = await pool.query(
            "SELECT animal_id FROM pet_favorites WHERE account_id = ? ORDER BY created_at DESC",
            [accountId]
        );
        res.json({
            success: true,
            favoritePetIds: favorites.map(favorite => favorite.animal_id)
        });
    } catch (err) {
        console.error("Get Pet Favorites Error:", err);
        res.status(500).json({ success: false, message: "Failed to load saved favorites." });
    }
};

exports.addPetFavorite = async (req, res) => {
    const accountId = req.session?.accountId;
    if (!accountId) {
        return res.status(401).json({ success: false, message: "Unauthorized access." });
    }

    const animalId = Number(req.body?.animal_id);
    if (!Number.isSafeInteger(animalId) || animalId <= 0) {
        return res.status(400).json({ success: false, message: "A valid pet ID is required." });
    }

    try {
        const [pets] = await pool.query(
            `SELECT animal_id
             FROM animals
             WHERE animal_id = ? AND adoption_status = 'Available' AND deleted_at IS NULL`,
            [animalId]
        );
        if (pets.length === 0) {
            return res.status(404).json({ success: false, message: "This pet is no longer available." });
        }

        await pool.query(
            "INSERT IGNORE INTO pet_favorites (account_id, animal_id) VALUES (?, ?)",
            [accountId, animalId]
        );
        res.status(200).json({ success: true, animal_id: animalId });
    } catch (err) {
        console.error("Add Pet Favorite Error:", err);
        res.status(500).json({ success: false, message: "Failed to save this favorite." });
    }
};

exports.removePetFavorite = async (req, res) => {
    const accountId = req.session?.accountId;
    if (!accountId) {
        return res.status(401).json({ success: false, message: "Unauthorized access." });
    }

    const animalId = Number(req.params.animalId);
    if (!Number.isSafeInteger(animalId) || animalId <= 0) {
        return res.status(400).json({ success: false, message: "A valid pet ID is required." });
    }

    try {
        await pool.query(
            "DELETE FROM pet_favorites WHERE account_id = ? AND animal_id = ?",
            [accountId, animalId]
        );
        res.json({ success: true, animal_id: animalId });
    } catch (err) {
        console.error("Remove Pet Favorite Error:", err);
        res.status(500).json({ success: false, message: "Failed to remove this favorite." });
    }
};

exports.getOrganizations = async (req, res) => {
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
            LEFT JOIN organization_payment_details p ON o.organization_id = p.organization_id
            LEFT JOIN organization_dropoff_details d ON o.organization_id = d.organization_id
            WHERE o.verification_status = 'Approved'
        `);
        
        const formattedOrgs = organizations.map(org => {
            const profilePic = normalizeImagePath(org.profile_pic, "/uploads/orgs","/uploads/default-org.png");

            const qrCode = normalizeImagePath(  org.qr_code, "/uploads/qr","" );

            const mayaQrCode = normalizeImagePath(org.maya_qr_code, "/uploads/qr","");

            const dropoffImg = normalizeImagePath( org.dropoff_image,"/uploads", "" );
            return {
                ...org,
                profile_pic: profilePic,
                qr_code: qrCode,
                maya_qr_code: mayaQrCode,
                dropoff_image: dropoffImg
            };
        });

        res.json(formattedOrgs);
    } catch (err) {
        console.error("Get Organizations Error:", err);
        res.status(500).json({ success: false, message: "Failed to load organizations." });
    }
};
exports.submitCashDonation = async (req, res) => {
    const accountId = req.session?.accountId;
    if (!accountId) {
        return res.status(401).json({ success: false, error: "Unauthorized access. Please login." });
    }

    const {
        organization_id,
        donor_name,
        donor_email,
        gcash_account_name,
        reference_number,
        amount,
        payment_method // Sinasalo ang piniling payment method mula sa frontend (GCash o Maya)
    } = req.body;

    if (!organization_id || !donor_name || !donor_email || !reference_number || !amount) {
        return res.status(400).json({ success: false, error: "Please fill in all required fields." });
    }

    // --- VALIDATION: Remove negative amounts and enforce limits ---
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ success: false, error: "Donation amount must be greater than zero and cannot be negative." });
    }

    // --- VALIDATION: Ensure valid reference number format ---
    const cleanRefNum = reference_number.trim();
    const refRegex = /^(?=.*[0-9])[a-zA-Z0-9]{10,15}$/; // Alphanumeric, 10-15 chars, must contain at least one digit
    if (!refRegex.test(cleanRefNum)) {
        return res.status(400).json({ success: false, error: "Please enter a valid reference number (10-15 characters, letters and numbers, must include at least one digit)." });
    }

    if (!req.file) {
        return res.status(400).json({ success: false, error: "Please upload your proof of payment (Receipt)." });
    }

    try {
        // --- CHECK: Duplicate reference number to prevent reuse ---
        const [existingRef] = await pool.query(
            `SELECT cash_donation_id FROM cash_donations WHERE reference_number = ? LIMIT 1`,
            [cleanRefNum]
        );

        if (existingRef.length > 0) {
            return res.status(400).json({ success: false, error: "This reference number has already been submitted." });
        }

        // --- PAYMENT METHOD & DETAILS VALIDATION ---
        const [paymentRows] = await pool.query(
            `SELECT gcash_number, gcash_name, maya_number, maya_name FROM organization_payment_details WHERE organization_id = ?`,
            [organization_id]
        );

        // Tukuyin kung GCash o Maya ang ginamit (default sa GCash kung walang pumasok)
        const selectedMethod = payment_method ? payment_method.trim() : 'GCash';

        if (selectedMethod.toLowerCase() === 'maya') {
            if (!paymentRows.length || !paymentRows[0].maya_number) {
                return res.status(400).json({ 
                    success: false, 
                    error: "This organization has not provided Maya payment details yet. Maya donations are currently disabled for this organization." 
                });
            }
        } else {
            if (!paymentRows.length || !paymentRows[0].gcash_number) {
                return res.status(400).json({ 
                    success: false, 
                    error: "This organization has not provided GCash payment details yet. Cash donations are currently disabled for this organization." 
                });
            }
        }

        const receipt_path = await uploadToCloudinary(
            req.file,
            "pawpon/donation-receipts"
        );

        const [adopterRows] = await pool.query(
            `SELECT adopter_id FROM adopters WHERE account_id = ?`,
            [accountId]
        );

        const adopter_id = adopterRows.length > 0 ? adopterRows[0].adopter_id : null;

        // --- INSERT SA DATABASE (Kasama ang payment_method kung mayroon ka ring kolum nito) ---
        const [result] = await pool.query(
            `INSERT INTO cash_donations 
            (adopter_id, organization_id, donor_name, donor_email, gcash_account_name, reference_number, amount, receipt_path, payment_method, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', NOW())`,
            [
                adopter_id,
                organization_id,
                donor_name,
                donor_email,
                gcash_account_name && gcash_account_name.trim() !== ""
                ? gcash_account_name.trim()
                : null,         
                cleanRefNum,
                parsedAmount,
                receipt_path,
                selectedMethod
            ]
        );
        await logActivity(accountId, "donation_submitted", "cash_donation", result.insertId, `₱${parsedAmount}`);

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

        await notifyOrgOfNewDonation(organization_id, "cash"); // or "in-kind"

    } catch (error) {
        console.error("Submit Cash Donation Error:", error);
        return res.status(500).json({ success: false, error: "Database error while processing donation: " + error.message });
    }
};

// ==========================================
// GET USER DONATIONS & HISTORY
// ==========================================

exports.getUserDonations = async (req, res) => {
    const accountId = req.session?.accountId;
    if (!accountId) {
        return res.status(401).json({ success: false, error: "Unauthorized access. Please login." });
    }

    try {
        const [adopterRows] = await pool.query(
            `SELECT a.adopter_id, acc.email 
             FROM adopters a 
             JOIN accounts acc ON a.account_id = acc.account_id 
             WHERE a.account_id = ?`,
            [accountId]
        );

        const adopterId = adopterRows.length > 0 ? adopterRows[0].adopter_id : null;
        const userEmail = adopterRows.length > 0 ? adopterRows[0].email : null;

        // 1. Fetch Cash Donations
        const [cashRows] = await pool.query(`
            SELECT 
                c.cash_donation_id AS id,
                c.created_at AS date,
                'Cash' AS type,
                o.organization_name AS organization,
                c.gcash_account_name,
                c.reference_number,
                c.amount,
                c.status,
                c.receipt_path,
                c.rejection_reason
            FROM cash_donations c
            LEFT JOIN organizations o ON c.organization_id = o.organization_id
            WHERE c.adopter_id = ? OR c.donor_email = ?
            ORDER BY c.created_at DESC
        `, [adopterId, userEmail]);

        // 2. Fetch In-Kind Donations (Direkta mula sa inkind_donations table)
        const [inkindRows] = await pool.query(`
            SELECT 
                i.inkind_donation_id AS id,
                i.created_at AS date,
                'In-Kind' AS type,
                o.organization_name AS organization,
                i.item_name,
                i.quantity,
                i.unit,
                i.proof_image_path,
                i.status,
                i.rejection_reason
            FROM inkind_donations i
            LEFT JOIN organizations o ON i.organization_id = o.organization_id
            WHERE i.adopter_id = ? OR i.donor_email = ?
            ORDER BY i.created_at DESC
        `, [adopterId, userEmail]);

        // 3. Pagsamahin at i-sort ayon sa petsa
        const allDonations = [...cashRows, ...inkindRows].sort(
            (a, b) => new Date(b.date) - new Date(a.date)
        );

        return res.json({
            success: true,
            donations: allDonations
        });

    } catch (error) {
        console.error("Get User Donations Error:", error);
        return res.status(500).json({ success: false, error: "Database error while fetching donation history: " + error.message });
    }
};
exports.submitInKindDonation = async (req, res) => {
    const accountId = req.session?.accountId;
    if (!accountId) {
        return res.status(401).json({ success: false, error: "Unauthorized access. Please login." });
    }

    const { organization_id, item_name, quantity, unit, category } = req.body;

    // ⭐ Required fields check
    if (!organization_id || !category || !item_name || quantity === undefined || quantity === null || quantity === "") {
        return res.status(400).json({ success: false, error: "Please fill in all required fields." });
    }

    const cleanItemName = String(item_name).trim();
    const cleanQuantity = String(quantity).trim();
    const cleanUnit     = (unit && String(unit).trim()) ? String(unit).trim() : "";
    const cleanCategory = String(category).trim();

    // ⭐ Category → allowed units map (must match frontend)
    const CATEGORY_UNITS = {
        "Food & Treats":          ["kg", "sacks", "packs", "boxes", "cans", "pcs"],
        "Toys":                   ["pcs", "packs", "boxes", "sets"],
        "Medicine & Health":      ["bottles", "boxes", "packs", "pcs", "tubes"],
        "Grooming & Hygiene":     ["bottles", "packs", "pcs", "liters"],
        "Accessories & Supplies": ["pcs", "packs", "boxes", "sets"],
        "Bedding & Housing":      ["pcs", "packs", "boxes"],
        "Other":                  ["pcs", "kg", "packs", "boxes", "sacks", "bottles", "liters"]
    };

    // ⭐ Category validation
    if (!CATEGORY_UNITS[cleanCategory]) {
        return res.status(400).json({ success: false, error: "Invalid donation category." });
    }

    // ⭐ Item name validation
    const gibberishPattern = /(.)\1{3,}/;
    const validItemPattern = /^[a-zA-Z0-9\sñÑ\-',.()\/&+]{3,}$/;
    const hasVowel         = /[aeiouAEIOU]/.test(cleanItemName);

    if (
        cleanItemName.length < 3 ||
        cleanItemName.length > 100 ||
        /^[0-9]+$/.test(cleanItemName) ||
        !hasVowel ||
        gibberishPattern.test(cleanItemName) ||
        !validItemPattern.test(cleanItemName)
    ) {
        return res.status(400).json({ success: false, error: "Invalid item name format. Please enter a real item description." });
    }

    // ⭐ Quantity validation
    const strictQuantityPattern = /^[1-9]\d*$/;
    if (!strictQuantityPattern.test(cleanQuantity)) {
        return res.status(400).json({ success: false, error: "Invalid quantity. Please enter a whole number greater than zero (e.g., 5)." });
    }

    // ⭐ Unit must belong to the selected category
    if (!cleanUnit || !CATEGORY_UNITS[cleanCategory].includes(cleanUnit)) {
        return res.status(400).json({ success: false, error: "Invalid unit for the selected category." });
    }

    try {
        const [dropoffRows] = await pool.query(
            `SELECT dropoff_address FROM organization_dropoff_details WHERE organization_id = ?`,
            [organization_id]
        );

        if (!dropoffRows.length || !dropoffRows[0].dropoff_address) {
            return res.status(400).json({
                success: false,
                error: "This organization has not set up drop-off location details yet. In-kind donations are currently disabled for this organization."
            });
        }

        const [adopterRows] = await pool.query(
            `SELECT a.adopter_id, a.first_name, a.last_name, acc.email
             FROM adopters a
             JOIN accounts acc ON a.account_id = acc.account_id
             WHERE a.account_id = ?`,
            [accountId]
        );

        if (!adopterRows.length) {
            return res.status(404).json({ success: false, error: "Adopter record not found." });
        }

        const adopter   = adopterRows[0];
        const donorName = `${adopter.first_name} ${adopter.last_name}`.trim();

        // ⭐ INSERT — kasama na ang `category`
        //    NOTE: Ensure `inkind_donations.category` column exists (VARCHAR(50)).
        const [result] = await pool.query(
            `INSERT INTO inkind_donations
            (adopter_id, organization_id, donor_name, donor_email, category, item_name, quantity, unit, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', NOW())`,
            [
                adopter.adopter_id,
                organization_id,
                donorName,
                adopter.email,
                cleanCategory,
                cleanItemName,
                cleanQuantity,
                cleanUnit
            ]
        );

        await logActivity(
            accountId,
            "donation_submitted",
            "inkind_donation",
            result.insertId,
            `[${cleanCategory}] ${cleanQuantity} ${cleanUnit} ${cleanItemName}`
        );

        const [[orgAccountInkind]] = await pool.query(
            `SELECT account_id FROM organizations WHERE organization_id = ?`,
            [organization_id]
        );

        if (orgAccountInkind) {
            await createNotification(
                orgAccountInkind.account_id,
                "New In-Kind Donation",
                `${donorName} wants to donate ${cleanQuantity} ${cleanUnit} of ${cleanItemName} (${cleanCategory}).`,
                "donation_submitted",
                "/org/donation"
            );
        }

        return res.json({
            success: true,
            message: "In-kind donation request submitted successfully!",
            inkindDonationId: result.insertId
        });

    } catch (error) {
        console.error("Submit In-Kind Donation Error:", error);
        return res.status(500).json({
            success: false,
            error: "Database error while submitting in-kind donation: " + error.message
        });
    }
};
// Idagdag ito sa userController.js kung wala pa:
exports.getOrgDropoffDetails = async (req, res) => {
    try {
        const { org_id } = req.params;
        const [rows] = await pool.query(
            `SELECT 
                o.organization_name, 
                d.dropoff_address, 
                d.dropoff_hours, 
                d.dropoff_notes, 
                d.dropoff_image 
             FROM organizations o
             LEFT JOIN organization_dropoff_details d ON o.organization_id = d.organization_id
             WHERE o.organization_id = ?`,
            [org_id]
        );

        if (!rows.length) {
            return res.status(404).json({ success: false, message: "Organization dropoff details not found." });
        }

        res.json({ success: true, dropoff: rows[0] });
    } catch (error) {
        console.error("Error fetching dropoff details:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};
// user application pet id
exports.getPetById = async (req, res) => {
    try {
        const petId = req.params.id;

        const [rows] = await pool.query(`
            SELECT
                a.animal_id,
                a.name,
                a.species,
                a.gender,
                a.age,
                a.image_path,
                o.organization_name
            FROM animals a
            JOIN organizations o
                ON a.organization_id = o.organization_id
            WHERE a.animal_id = ?
            AND a.deleted_at IS NULL
        `, [petId]);

        if (rows.length === 0) {
            return res.status(404).json({
                message: "Pet not found"
            });
        }

        res.json(rows[0]);

    } catch (err) {
        console.error(err);
        res.status(500).json(err);
    }
};

//for user adoption application submission
exports.submitAdoptionApplication = async (req, res) => {
    try {
        // =====================================================
        // 1. SESSION CHECK
        // =====================================================
        const accountId = req.session?.accountId;

        if (!accountId) {
            return res.status(401).json({
                status: 'error',
                message: 'Unauthorized access. Please log in to submit an application.'
            });
        }

        // =====================================================
        // 2. ADOPTER RECORD CHECK
        // =====================================================
        const [adopterRows] = await pool.query(
            `SELECT adopter_id FROM adopters WHERE account_id = ?`,
            [accountId]
        );

        if (!adopterRows.length) {
            return res.status(404).json({
                status: 'error',
                message: 'Adopter profile record not found.'
            });
        }

        const adopterId = adopterRows[0].adopter_id;

        // =====================================================
        // 3. UPLOADED FILE
        // =====================================================
        // Save the Cloudinary URL, not the Cloudinary public ID.
        const documentPath = req.file ? (req.file.path || req.file.secure_url || null) : null;

        const {
            animal_id,
            full_name,
            contact_number,
            email,
            full_address,
            civil_status,
            age,
            occupation,
            adoption_intent,
            emergency_name,
            emergency_phone,
            emergency_relation
        } = req.body;

        // =====================================================
        // 4. SERVER-SIDE VALIDATION (SEUSR-03)
        // =====================================================
        let cleanFullName, cleanContact, cleanEmail, cleanAddress,
            cleanCivilStatus, cleanAge, cleanOccupation, cleanIntent,
            cleanEmergencyName, cleanEmergencyPhone, cleanEmergencyRelation;

        try {

            cleanFullName = validateAdoptionField(full_name, {
                fieldName: 'Full Name',
                minLength: 2,
                maxLength: 100,
                regex: ADOPTION_NAME_REGEX
            });

            cleanContact = validateAdoptionField(contact_number, {
                fieldName: 'Contact Number',
                minLength: 11,
                maxLength: 13,
                regex: ADOPTION_PHONE_REGEX
            });

            cleanEmail = validateAdoptionField(email, {
                fieldName: 'Email Address',
                minLength: 5,
                maxLength: 150,
                custom: (val) =>
                    !validator.isEmail(val)
                        ? 'Please enter a valid email address.'
                        : null
            });

            cleanAddress = validateAdoptionField(full_address, {
                fieldName: 'Full Address',
                minLength: 5,
                maxLength: 255,
                regex: ADOPTION_ADDRESS_REGEX
            });

            cleanCivilStatus = validateAdoptionField(civil_status, {
                fieldName: 'Civil Status',
                maxLength: 20,
                custom: (val) =>
                    !ADOPTION_ALLOWED_CIVIL.includes(val)
                        ? `Civil Status must be one of: ${ADOPTION_ALLOWED_CIVIL.join(', ')}.`
                        : null
            });

            const rawAge = validateAdoptionField(age, {
                fieldName: 'Age',
                minLength: 1,
                maxLength: 3,
                custom: (val) => {
                    const n = Number(val);
                    if (!Number.isInteger(n)) return 'Age must be a whole number.';
                    if (n < 18)              return 'You must be at least 18 years old.';
                    if (n > 120)             return 'Please enter a realistic age.';
                    return null;
                }
            });
            cleanAge = Number(rawAge);

            cleanOccupation = validateAdoptionField(occupation, {
                fieldName: 'Occupation / Source of Income',
                minLength: 2,
                maxLength: 100,
                regex: ADOPTION_OCCUPATION_REGEX
            });

            cleanIntent = validateAdoptionField(adoption_intent, {
                fieldName: 'Adoption Intent',
                minLength: 20,
                maxLength: 2000
                // Free text — DANGEROUS_REGEX pa rin ang bantay (walang <script>, etc.)
            });

            cleanEmergencyName = validateAdoptionField(emergency_name, {
                fieldName: 'Emergency Contact Name',
                minLength: 2,
                maxLength: 100,
                regex: ADOPTION_NAME_REGEX
            });

            cleanEmergencyPhone = validateAdoptionField(emergency_phone, {
                fieldName: 'Emergency Phone Number',
                minLength: 11,
                maxLength: 13,
                regex: ADOPTION_PHONE_REGEX
            });

            cleanEmergencyRelation = validateAdoptionField(emergency_relation, {
                fieldName: 'Relationship to Emergency Contact',
                minLength: 2,
                maxLength: 50,
                regex: ADOPTION_RELATION_REGEX
            });

        } catch (validationError) {
            if (validationError.code === 'VALIDATION') {
                // I-log bilang suspicious attempt (para sa security audit)
                try {
                    await logActivity(
                        accountId,
                        "suspicious_application_input",
                        "application",
                        null,
                        validationError.message
                    );
                } catch (_) { /* huwag i-block ang response kung log fails */ }

                return res.status(400).json({
                    status: 'error',
                    message: validationError.message
                });
            }
            throw validationError;
        }

        // =====================================================
        // 5. VALIDATE animal_id (numeric)
        // =====================================================
        const animalIdNum = Number(animal_id);

        if (!Number.isInteger(animalIdNum) || animalIdNum <= 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid pet selected.'
            });
        }

        const [petRows] = await pool.query(
            `SELECT organization_id, name FROM animals WHERE animal_id = ? AND deleted_at IS NULL`,
            [animalIdNum]
        );

        if (!petRows.length) {
            return res.status(404).json({
                status: 'error',
                message: 'Selected pet not found.'
            });
        }

        const organizationId = petRows[0].organization_id;
        const animalName = petRows[0].name;
        // =====================================================
        // 6. BUILD IMMUTABLE SNAPSHOT (cleaned values only)
        // =====================================================
        const applicantSnapshot = {
            full_name:      cleanFullName,
            contact_number: cleanContact,
            email:          cleanEmail,
            full_address:   cleanAddress,
            civil_status:   cleanCivilStatus,
            age:            cleanAge,
            occupation:     cleanOccupation,
            submitted_at:   new Date().toISOString()
        };

        const snapshotJSON = JSON.stringify(applicantSnapshot);

        // =====================================================
        // 7. CHECK EXISTING APPLICATION (re-apply flow)
        // =====================================================
        const [existingApp] = await pool.query(
            `SELECT application_id, status FROM user_adoption_applications
             WHERE adopter_id = ? AND animal_id = ?
             ORDER BY created_at DESC LIMIT 1`,
            [adopterId, animalIdNum]
        );

        const currentStatus = existingApp.length > 0
            ? (existingApp[0].status || '').trim().toLowerCase()
            : '';

        if (existingApp.length > 0 && ['declined', 'rejected', 'cancelled'].includes(currentStatus)) {

            const [oldAppRows] = await pool.query(
                `SELECT document_path FROM user_adoption_applications WHERE application_id = ?`,
                [existingApp[0].application_id]
            );
            const oldDocumentPath = oldAppRows.length > 0 ? oldAppRows[0].document_path : null;
            const finalDocumentPath = documentPath || oldDocumentPath;

            const updateQuery = `
                UPDATE user_adoption_applications SET
                    organization_id   = ?,
                    applicant_snapshot= ?,
                    adoption_intent   = ?,
                    emergency_name    = ?,
                    emergency_phone   = ?,
                    emergency_relation= ?,
                    document_path     = ?,
                    status            = 'Under Review',
                    decline_reason    = NULL,
                    created_at        = NOW(),
                    updated_at        = NOW()
                WHERE application_id  = ?
            `;

            const updateValues = [
                organizationId,
                snapshotJSON,
                cleanIntent,
                cleanEmergencyName,
                cleanEmergencyPhone,
                cleanEmergencyRelation,
                finalDocumentPath,
                existingApp[0].application_id
            ];

            await pool.query(updateQuery, updateValues);

            await pool.query(
                `DELETE FROM application_interviews WHERE application_id = ?`,
                [existingApp[0].application_id]
            );

            await logActivity(
                accountId,
                "adoption_application_submitted",
                "application",
                existingApp[0].application_id,
                `Re-application for ${animalName}`
            );

            const [[orgAccountReapply]] = await pool.query(
                `SELECT account_id FROM organizations WHERE organization_id = ?`,
                [organizationId]
            );

            if (orgAccountReapply) {
                await createNotification(
                    orgAccountReapply.account_id,
                    "New Adoption Application",
                    `An adopter re-submitted an application for ${animalName}.`,
                    "application_submitted",
                    "/org/adoption"
                );
            }

            return res.status(200).json({
                status: 'success',
                message: 'Re-application submitted successfully! Your application status is now Under Review.'
            });
        }

        // =====================================================
        // 8. INSERT NEW APPLICATION (parameterized)
        // =====================================================
        const insertQuery = `
            INSERT INTO user_adoption_applications (
                organization_id, adopter_id, animal_id,
                applicant_snapshot, adoption_intent,
                emergency_name, emergency_phone, emergency_relation,
                document_path, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `;

        const values = [
            organizationId,
            adopterId,
            animalIdNum,
            snapshotJSON,
            cleanIntent,
            cleanEmergencyName,
            cleanEmergencyPhone,
            cleanEmergencyRelation,
            documentPath || null,
            'Under Review'
        ];

        await pool.query(insertQuery, values);

        await logActivity(
            accountId,
            "adoption_application_submitted",
            "application",
            null,
            animalName
        );

        const [[orgAccountNew]] = await pool.query(
            `SELECT account_id FROM organizations WHERE organization_id = ?`,
            [organizationId]
        );

        if (orgAccountNew) {
            await createNotification(
                orgAccountNew.account_id,
                "New Adoption Application",
                `A new application was submitted for pet ${animalName}.`,
                "application_submitted",
                "/org/adoption"
            );
        }

        return res.status(200).json({
            status: 'success',
            message: 'Application submitted successfully! Please wait for approval.'
        });

    } catch (error) {
        console.error('Error saving adoption application:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to submit application. Please try again.'
        });
    }
};
// Check if user has already applied for a specific pet
exports.checkAppliedStatus = async (req, res) => {
    try {
        const accountId = req.session?.accountId;
        const petId = req.params.petId;

        if (!accountId) {
            return res.json({ hasApplied: false });
        }

        // 1. Kunin muna ang totoong adopter_id mula sa adopters table
        const [adopterRows] = await pool.query(
            `SELECT adopter_id FROM adopters WHERE account_id = ?`,
            [accountId]
        );

        if (!adopterRows.length) {
            return res.json({ hasApplied: false });
        }

        const adopterId = adopterRows[0].adopter_id;

        // Query application with decline_reason included
        const [rows] = await pool.query(
            `SELECT application_id, status, decline_reason 
             FROM user_adoption_applications 
             WHERE adopter_id = ? AND animal_id = ? 
             ORDER BY created_at DESC LIMIT 1`,
            [adopterId, petId]
        );

        if (rows.length > 0) {
            return res.json({ 
                hasApplied: true, 
                status: rows[0].status,
                declineReason: rows[0].decline_reason || "No specific reason provided."
            });
        }

        return res.json({ hasApplied: false });
    } catch (error) {
        console.error("Error checking application status:", error);
        return res.status(500).json({ error: "Server error" });
    }
};
// =====================================================
// GET CURRENT USER'S ADOPTION APPLICATIONS
exports.getUserApplications = async (req, res) => {
    try {
        // =====================================================
        // 1. CHECK LOGIN SESSION
        // =====================================================
        const accountId = req.session?.accountId;

        if (!accountId) {
            return res.status(401).json({ success: false, message: "You must be logged in." });
        }

        // =====================================================
        // 2. GET adopter_id USING account_id
        // =====================================================
        const [adopterRows] = await pool.query(
            `SELECT adopter_id FROM adopters WHERE account_id = ? LIMIT 1`,
            [accountId]
        );


        if (adopterRows.length === 0) {
            return res.status(404).json({ success: false, message: "Adopter profile not found." });
        }

        const adopterId = adopterRows[0].adopter_id;

        // =====================================================
        // 3. GET APPLICATIONS
        // =====================================================
        const [applications] = await pool.query(
            `
            SELECT
                app.application_id,
                app.adopter_id,
                app.animal_id,
                app.applicant_snapshot,
                app.adoption_intent,
                app.emergency_name,
                app.emergency_phone,
                app.emergency_relation,
                app.document_path,
                app.status,
                app.decline_reason,
                COALESCE(app.updated_at, app.created_at) AS created_at,
                app.updated_at,
                i.interview_date,
                i.interview_time,
                i.interview_method,
                i.interview_location_link,
                i.meetup_location,
                -- RESCHEDULE INTERVIEW
                i.requested_interview_date,
                i.requested_interview_time,
                i.reschedule_reason,
                i.resched_status,
                -- PET INFORMATION
                animal.name AS pet_name,
                animal.species AS species,
                animal.gender AS gender,
                animal.age AS pet_age,
                animal.image_path AS image_path,
                animal.adoption_status AS pet_adoption_status,
                -- ORGANIZATION INFORMATION
                org.organization_id,
                org.organization_name,
                org.profile_pic
            FROM user_adoption_applications app
            INNER JOIN animals animal ON app.animal_id = animal.animal_id
            LEFT JOIN organizations org ON animal.organization_id = org.organization_id
            LEFT JOIN application_interviews i ON app.application_id = i.application_id
            WHERE app.adopter_id = ?
            ORDER BY COALESCE(app.updated_at, app.created_at) DESC
            `,
            [adopterId]
        );

        // MAP FUNCTION: I-parse ang JSON snapshot para madaling basahin sa Frontend
        const formattedApplications = applications.map(app => {
            let parsedSnapshot = {};
            try {
                parsedSnapshot = typeof app.applicant_snapshot === 'string' 
                    ? JSON.parse(app.applicant_snapshot) 
                    : (app.applicant_snapshot || {});
            } catch (e) {
                console.error("JSON parse error:", e);
            }

            return {
                ...app,
                full_name: parsedSnapshot.full_name || 'N/A',
                contact_number: parsedSnapshot.contact_number || 'N/A',
                email: parsedSnapshot.email || 'N/A',
                full_address: parsedSnapshot.full_address || 'N/A',
                civil_status: parsedSnapshot.civil_status || 'N/A',
                age: parsedSnapshot.age || 'N/A',
                petAdoptionStatus: app.pet_adoption_status || "Available",
                occupation: parsedSnapshot.occupation || 'N/A'
            };
        });

        // =====================================================
        // 5. SEND RESPONSE
        // =====================================================
        return res.status(200).json({ success: true, applications: formattedApplications });

    } catch (error) {
        console.error("Error fetching user adoption applications:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load adoption applications.",
            error: error.message
        });
    }
};

// =====================================================
// CANCEL ADOPTION APPLICATION (USER SIDE)
// =====================================================
exports.cancelAdoptionApplication = async (req, res) => {
    try {
        const accountId = req.session?.accountId;
        const applicationId = req.params.id;

        if (!accountId) {
            return res.status(401).json({ success: false, message: "Unauthorized access." });
        }

        // 1. Kuhanin muna ang adopter_id ng naka-login na user
        const [adopterRows] = await pool.query(
            `SELECT adopter_id FROM adopters WHERE account_id = ? LIMIT 1`,
            [accountId]
        );

        if (!adopterRows.length) {
            return res.status(404).json({ success: false, message: "Adopter profile not found." });
        }

        const adopterId = adopterRows[0].adopter_id;

        // 2. I-update lamang kapag ang application ay naka-'Under Review' pa at pagmamay-ari ng user
        const [result] = await pool.query(
            `UPDATE user_adoption_applications 
             SET status = 'Cancelled', updated_at = NOW() 
             WHERE application_id = ? AND adopter_id = ? AND status = 'Under Review'`,
            [applicationId, adopterId]
        );

        if (result.affectedRows === 0) {
            return res.status(400).json({ 
                success: false, 
                message: "Unable to cancel application. It may already be processed or not found." 
            });
        }
        await logActivity(accountId, "adoption_application_cancelled", "application", applicationId);

        return res.status(200).json({
            success: true,
            message: "Application cancelled successfully."
        });

    } catch (error) {
        console.error("Error cancelling application:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to cancel application: " + error.message
        });
    }
};
// ==========================================
// KAMUSTAHAN MODULE (USER SIDE)
// ==========================================

exports.getApprovedAdoptedPets = async (req, res) => {
    const accountId = req.session?.accountId;
    if (!accountId) {
        return res.status(401).json({ success: false, error: "Unauthorized access." });
    }

    try {
        // I-log natin ang accountId para ma-check sa console
        console.log("Fetching pets for accountId:", accountId);

        const [adopterRows] = await pool.query(
            `SELECT adopter_id FROM adopters WHERE account_id = ? LIMIT 1`,
            [accountId]
        );

        if (!adopterRows.length) {
            console.log("No adopter record found for this account.");
            return res.status(404).json({ success: false, error: "Adopter profile not found." });
        }

        const adopterId = adopterRows[0].adopter_id;
        console.log("Found adopter_id:", adopterId);

        // BAGONG QUERY: Ginawang UPPER(status) para iwas case-sensitivity
        const [pets] = await pool.query(`
            SELECT DISTINCT
                a.animal_id,
                a.name,
                a.species,
                a.image_path,
                a.organization_id
            FROM user_adoption_applications app
            JOIN animals a ON app.animal_id = a.animal_id
            WHERE app.adopter_id = ? 
            AND UPPER(app.status) = 'APPROVED'
        `, [adopterId]);

        console.log("Pets found:", pets); // I-check sa console kung may laman ang pets array

        return res.json({
            success: true,
            pets: pets
        });

    } catch (error) {
        console.error("Get Approved Adopted Pets Error:", error);
        return res.status(500).json({ success: false, error: "Server error." });
    }
};
exports.submitKamustahanUpdate = async (req, res) => {
    const accountId = req.session?.accountId;
    if (!accountId) {
        return res.status(401).json({ success: false, error: "Unauthorized access." });
    }

    try {
        const [adopterRows] = await pool.query(
            `SELECT adopter_id FROM adopters WHERE account_id = ? LIMIT 1`,
            [accountId]
        );

        if (!adopterRows.length) {
            return res.status(404).json({ success: false, error: "Adopter profile not found." });
        }

        const adopterId = adopterRows[0].adopter_id;
        const { animal_id, organization_id, update_text } = req.body;
        const photoPath = req.file ? `/uploads/kamustahan/${req.file.filename}` : '';

        if (!animal_id || !organization_id || !update_text) {
            return res.status(400).json({ success: false, error: "Please fill in all required fields." });
        }

        // 1. Check if there is an active scheduled update ('For Update') for this pet
        const [scheduleRows] = await pool.query(`
            SELECT update_id, status, scheduled_date as target_schedule 
            FROM kamustahan_updates 
            WHERE adopter_id = ? AND animal_id = ? AND status = 'For Update'
            ORDER BY created_at DESC LIMIT 1
        `, [adopterId, animal_id]);

        if (!scheduleRows.length) {
            return res.status(400).json({ 
                success: false, 
                error: "No scheduled update found for this pet, or the update for the current schedule has already been submitted." 
            });
        }

        const currentSchedule = scheduleRows[0];
        const updateId = currentSchedule.update_id;

        // 2. Check if a scheduled_date actually exists and is valid in the database
        if (!currentSchedule.target_schedule) {
            return res.status(400).json({ 
                success: false, 
                error: "No schedule date has been set in the database for this pet yet. Please wait for the organization to set a schedule." 
            });
        }

       // 3. Format Philippine Time and the database target schedule accurately
            const phTimeOptions = { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' };
            const formatter = new Intl.DateTimeFormat('en-CA', phTimeOptions);

            const phToday = formatter.format(new Date());
            const targetDateStr = formatter.format(new Date(currentSchedule.target_schedule));

            // Prevent 1970-01-01 or invalid empty database date traps
            if (targetDateStr === '1970-01-01' || !targetDateStr) {
                return res.status(400).json({
                    success: false,
                    error: "The deadline for this pet is not yet properly configured in the system."
                });
            }

            // ==========================================
            // DEADLINE CHECK (hindi na exact-date)
            // ==========================================
            if (phToday > targetDateStr) {
                return res.status(400).json({
                    success: false,
                    error: `The deadline to submit this update has already passed. The scheduled deadline was on ${targetDateStr}.`
                });
            }
        // 4. Update the record and set the upload timestamp
        await pool.query(`
            UPDATE kamustahan_updates 
            SET update_date = CURDATE(), 
                update_text = ?, 
                photos = ?, 
                status = 'Pending',
                created_at = NOW()
            WHERE update_id = ?
        `, [update_text, photoPath, updateId]);
        
        await logActivity(accountId, "kamustahan_submitted", "kamustahan_update", updateId);
        
        const [[orgAccountKamustahan]] = await pool.query(
            `SELECT account_id FROM organizations WHERE organization_id = ?`,
            [organization_id]
        );

        if (orgAccountKamustahan) {
            await createNotification(
                orgAccountKamustahan.account_id,
                "New Kamustahan Update",
                "An adopter posted a new pet update for you to review.",
                "kamustahan_submitted",
                "/org/kamustahan"
            );
        }

        return res.json({
            success: true,
            message: "Kamustahan update successfully submitted!"
        });

        await createNotification(orgAccountId, "New Kamustahan Update", `An adopter posted an update for ${petName}.`, "kamustahan_submitted", "/org/kamustahan");

    } catch (error) {
        console.error("Submit Kamustahan Error:", error);
        return res.status(500).json({ success: false, error: "Database error during submission." });
    }
};

exports.getKamustahanHistory = async (req, res) => {
    const accountId = req.session?.accountId;
    if (!accountId) {
        return res.status(401).json({ success: false, error: "Unauthorized access." });
    }

    try {
        const [adopterRows] = await pool.query(
            `SELECT adopter_id FROM adopters WHERE account_id = ? LIMIT 1`,
            [accountId]
        );

        if (!adopterRows.length) {
            return res.status(404).json({ success: false, error: "Adopter profile not found." });
        }

        const adopterId = adopterRows[0].adopter_id;

        const [updates] = await pool.query(`
            SELECT 
                k.update_id,
                k.update_date,
                k.update_text,
                k.photos,
                k.status,
                k.created_at,
                a.name AS pet_name
            FROM kamustahan_updates k
            JOIN animals a ON k.animal_id = a.animal_id
            WHERE k.adopter_id = ?
            ORDER BY k.created_at DESC
        `, [adopterId]);

        return res.json({
            success: true,
            updates: updates
        });

    } catch (error) {
        console.error("Get Kamustahan History Error:", error);
        return res.status(500).json({ success: false, error: "Failed to load kamustahan history." });
    }
};
// I-update din ang getKamustahanHistory para makuha ang created_at timestamp
exports.getKamustahanHistory = async (req, res) => {
    const accountId = req.session?.accountId;
    if (!accountId) {
        return res.status(401).json({ success: false, error: "Unauthorized access." });
    }

    try {
        const [adopterRows] = await pool.query(
            `SELECT adopter_id FROM adopters WHERE account_id = ? LIMIT 1`,
            [accountId]
        );

        if (!adopterRows.length) {
            return res.status(404).json({ success: false, error: "Adopter profile not found." });
        }

        const adopterId = adopterRows[0].adopter_id;

        const [updates] = await pool.query(`
            SELECT 
                k.update_id,
                k.update_date,
                k.update_text,
                k.photos,
                k.status,
                k.created_at,
                a.name AS pet_name
            FROM kamustahan_updates k
            JOIN animals a ON k.animal_id = a.animal_id
            WHERE k.adopter_id = ?
            ORDER BY k.created_at DESC
        `, [adopterId]);

        return res.json({
            success: true,
            updates: updates
        });

    } catch (error) {
        console.error("Get History Error:", error);
        return res.status(500).json({ success: false, error: "Failed to load history." });
    }
};

//check if there are any due kamustahan reminders for the user and create notifications if needed (new added)
async function checkKamustahanRemindersDue(accountId) {
    const [dueUpdates] = await pool.query(`
        SELECT ku.update_id, ku.animal_id, ku.scheduled_date, a.name AS pet_name
        FROM kamustahan_updates ku
        JOIN animals a ON a.animal_id = ku.animal_id
        WHERE ku.adopter_id = (SELECT adopter_id FROM adopters WHERE account_id = ?)
          AND ku.status = 'For Update'
          AND ku.scheduled_date IS NOT NULL
          AND ku.scheduled_date <= CURDATE()
          AND NOT EXISTS (
              SELECT 1 FROM notifications n
              WHERE n.account_id = ?
                AND n.type = 'kamustahan_due'
                AND n.link = CONCAT('/kamustahan?pet=', ku.animal_id)
                AND DATE(n.created_at) = CURDATE()
          )
    `, [accountId, accountId]);

    for (const item of dueUpdates) {
        await createNotification(
            accountId,
            "Kamustahan Update Due",
            `It's time to share an update on ${item.pet_name}!`,
            "kamustahan_due",
            `/kamustahan?pet=${item.animal_id}`
        );
    }
}
exports.checkKamustahanRemindersDue = checkKamustahanRemindersDue;

//functions for recent activities in user dashboard
exports.getUserRecentActivities = async (req, res) => {
    const accountId = req.session?.accountId;
    if (!accountId) {
        return res.status(401).json({ success: false, error: "Unauthorized access." });
    }

    try {
        // 1. Get adopter_id & email
        const [adopterRows] = await pool.query(
            `SELECT adopter_id, email FROM adopters 
             JOIN accounts ON adopters.account_id = accounts.account_id 
             WHERE adopters.account_id = ? LIMIT 1`,
            [accountId]
        );

        if (!adopterRows.length) {
            return res.status(404).json({ success: false, error: "Adopter profile not found." });
        }

        const { adopter_id, email } = adopterRows[0];

        // 2. Fetch Adoption Applications & Status Changes
        const [apps] = await pool.query(`
            SELECT 
                app.application_id AS id,
                'application' AS activity_type,
                app.status,
                a.name AS pet_name,
                a.species,
                i.interview_date,
                i.interview_time,
                COALESCE(app.updated_at, app.created_at) AS activity_date
            FROM user_adoption_applications app
            JOIN animals a ON app.animal_id = a.animal_id
            LEFT JOIN application_interviews i ON app.application_id = i.application_id
            WHERE app.adopter_id = ?
        `, [adopter_id]);

        // 3. Fetch Cash Donations
        const [cash] = await pool.query(`
            SELECT 
                c.cash_donation_id AS id,
                'donation_cash' AS activity_type,
                c.amount,
                o.organization_name,
                c.status,
                c.created_at AS activity_date
            FROM cash_donations c
            LEFT JOIN organizations o ON c.organization_id = o.organization_id
            WHERE c.adopter_id = ? OR c.donor_email = ?
        `, [adopter_id, email]);

        // 4. Fetch In-Kind Donations
        const [inkind] = await pool.query(`
            SELECT 
                i.inkind_donation_id AS id,
                'donation_inkind' AS activity_type,
                i.item_name,
                i.quantity,
                o.organization_name,
                i.status,
                i.created_at AS activity_date
            FROM inkind_donations i
            LEFT JOIN organizations o ON i.organization_id = o.organization_id
            WHERE i.adopter_id = ? OR i.donor_email = ?
        `, [adopter_id, email]);

        // 5. Fetch Kamustahan Updates
        const [kamustahan] = await pool.query(`
            SELECT 
                k.update_id AS id,
                'kamustahan' AS activity_type,
                k.status,
                a.name AS pet_name,
                k.created_at AS activity_date
            FROM kamustahan_updates k
            JOIN animals a ON k.animal_id = a.animal_id
            WHERE k.adopter_id = ?
        `, [adopter_id]);

        // Combine and sort newest first
        const allActivities = [...apps, ...cash, ...inkind, ...kamustahan]
            .filter(item => item.activity_date)
            .sort((a, b) => new Date(b.activity_date) - new Date(a.activity_date))
            .slice(0, 5); // Show top 10 most recent

        return res.json({ success: true, activities: allActivities });
    } catch (error) {
        console.error("Error fetching activities:", error);
        return res.status(500).json({ success: false, error: "Database error fetching activities." });
    }
};

// ==========================================
// GET UPCOMING SCHEDULES / INTERVIEWS
// ==========================================
exports.getUserUpcomingSchedules = async (req, res) => {
    const accountId = req.session?.accountId;
    if (!accountId) {
        return res.status(401).json({ success: false, message: "Unauthorized access." });
    }

    try {
        const [adopterRows] = await pool.query(
            `SELECT adopter_id FROM adopters WHERE account_id = ? LIMIT 1`,
            [accountId]
        );

        if (!adopterRows.length) {
            return res.status(404).json({ success: false, message: "Adopter profile not found." });
        }

        const adopterId = adopterRows[0].adopter_id;

        const [schedules] = await pool.query(`
            SELECT 
                app.application_id,
                app.status AS application_status,
                i.interview_date,
                i.interview_time,
                i.interview_method,
                i.interview_location_link,
                i.resched_status,
                a.name AS pet_name,
                a.species,
                o.organization_name
            FROM user_adoption_applications app
            INNER JOIN application_interviews i ON app.application_id = i.application_id
            INNER JOIN animals a ON app.animal_id = a.animal_id
            LEFT JOIN organizations o ON app.organization_id = o.organization_id
            WHERE app.adopter_id = ? 
              AND app.status = 'Interview Scheduled'
              AND i.interview_date IS NOT NULL
              AND STR_TO_DATE(CONCAT(DATE_FORMAT(i.interview_date, '%Y-%m-%d'), ' ', COALESCE(i.interview_time, '23:59:59')), '%Y-%m-%d %H:%i:%s') >= NOW()
            ORDER BY i.interview_date ASC, i.interview_time ASC
        `, [adopterId]);

        return res.status(200).json({
            success: true,
            schedules
        });
    } catch (error) {
        console.error("Error fetching upcoming schedules:", error);
        return res.status(500).json({ success: false, message: "Server error fetching schedules." });
    }
}
exports.logout = (req, res) => {

    console.log("========== LOGOUT REQUEST ==========");

    if (!req.session) {

        console.log("No active session found.");

        res.clearCookie("connect.sid", {
            path: "/"
        });

        return res.json({
            success: true,
            message: "Already logged out."
        });
    }


    req.session.destroy((err) => {

        if (err) {

            console.error("LOGOUT SESSION DESTROY ERROR:", err);

            return res.status(500).json({
                success: false,
                message: "Failed to logout."
            });

        }


        console.log("Session destroyed successfully.");


        res.clearCookie("connect.sid", {
            path: "/"
        });


        console.log("Session cookie cleared.");
        console.log("====================================");


        return res.status(200).json({
            success: true,
            message: "Logged out successfully."
        });

    });
};
exports.getOrganizationById = async (req, res) => {
    try {
        const orgId = req.params.id;
        
        // I-JOIN ang organizations at accounts table para makuha ang email
        const [rows] = await pool.query(
            `SELECT 
                o.*, 
                accounts.email,
                p.qr_code,
                p.maya_qr_code
             FROM organizations o
             JOIN accounts ON o.account_id = accounts.account_id
             LEFT JOIN organization_payment_details p
                ON o.organization_id = p.organization_id
             WHERE o.organization_id = ?`, 
            [orgId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: "Organization not found" });
        }

        const organization = rows[0];
        organization.profile_pic = normalizeImagePath(
            organization.profile_pic,
            "/uploads/orgs",
            "/uploads/default-org.png"
        );
        organization.qr_code = normalizeImagePath(
            organization.qr_code,
            "/uploads/qr"
        );
        organization.maya_qr_code = normalizeImagePath(
            organization.maya_qr_code,
            "/uploads/qr"
        );

        res.json(organization);
    } catch (err) {
        console.error("Error fetching organization profile:", err);
        res.status(500).json({ error: "Server error" });
    }
};

// ==========================================
// SUBMIT FEEDBACK (Adopter)
// POST /api/feedback
// ==========================================
exports.submitFeedback = async (req, res) => {
    try {
        const accountId = req.session?.accountId;
        if (!accountId) {
            return res.status(401).json({ success: false, message: "Please log in to send feedback." });
        }

        const { feedback_type, subject, message, rating } = req.body;

        const cleanSubject = (subject || "").trim();
        const cleanMessage = (message || "").trim();
        const validTypes = ["Report a Bug", "Feature Suggestion", "General Feedback", "Other"];

        if (!feedback_type || !validTypes.includes(feedback_type)) {
            return res.status(400).json({ success: false, message: "Please select a valid feedback type." });
        }
        if (!cleanSubject) {
            return res.status(400).json({ success: false, message: "Subject is required." });
        }
        if (!cleanMessage || cleanMessage.length < 10) {
            return res.status(400).json({ success: false, message: "Message must be at least 10 characters." });
        }

        let cleanRating = null;
        if (rating !== null && rating !== undefined && rating !== "") {
            const parsedRating = parseInt(rating, 10);
            if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
                return res.status(400).json({ success: false, message: "Rating must be between 1 and 5." });
            }
            cleanRating = parsedRating;
        }

         // Alamin kung org ba o adopter ang nag-submit, para tama ang submitted_by/organization_id
         const [orgRows] = await pool.query(
            `SELECT organization_id FROM organizations WHERE account_id = ? LIMIT 1`,
            [accountId]
        );

        const isOrganization = orgRows.length > 0;
        const submittedBy = isOrganization ? "organization" : "user";
        const organizationId = isOrganization ? orgRows[0].organization_id : null;

        const [result] = await pool.query(
            `INSERT INTO feedback (account_id, submitted_by, organization_id, feedback_type, subject, message, rating, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [accountId, submittedBy, organizationId, feedback_type, cleanSubject, cleanMessage, cleanRating]
        );

        await logActivity(accountId, "feedback_submitted", "feedback", result.insertId, feedback_type);

        await notifyAllAdmins(
            "New Feedback Received",
            `A new "${feedback_type}" feedback was submitted by ${isOrganization ? "an organization" : "an adopter"}: "${cleanSubject}"`,
            "feedback_new",
            "/admin/feedback"
        );

        res.json({ success: true, message: "Thanks! Your feedback has been sent to the Pawpon team." });
    } catch (err) {
        console.error("Submit Feedback Error:", err);
        res.status(500).json({ success: false, message: "Something went wrong while sending your feedback." });
    }
};

/**
 * GET /api/user/kamustahan-due
 * Returns Kamustahan updates that are due today or overdue for the logged-in adopter.
 */
exports.getKamustahanDue = async (req, res) => {
    const accountId = req.session?.accountId;
    if (!accountId) return res.status(401).json({ success: false, message: "Unauthorized" });

    try {
        const [dueUpdates] = await pool.query(`
            SELECT ku.update_id, ku.animal_id, ku.scheduled_date, a.name AS pet_name
            FROM kamustahan_updates ku
            JOIN animals a ON a.animal_id = ku.animal_id
            WHERE ku.adopter_id = (SELECT adopter_id FROM adopters WHERE account_id = ?)
              AND ku.status = 'For Update'
              AND ku.scheduled_date IS NOT NULL
              AND ku.scheduled_date <= CURDATE()
            ORDER BY ku.scheduled_date ASC
        `, [accountId]);

        res.json({ success: true, dueUpdates });
    } catch (err) {
        console.error("Get Kamustahan Due Error:", err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
};
