
const pool = require("../config/database");
const { logActivity } = require("./adminController");
const { createNotification } = require("./adminController");
const { uploadToCloudinary } = require("../services/cloudinaryUpload");

/**
 * 
 */
exports.getOrganizations = async (req, res) => {
    try {
        const [organizations] = await pool.query(`
            SELECT
                o.*,
                accounts.email,
                p.gcash_name,
                p.gcash_number,
                p.qr_code,
                p.maya_name,
                p.maya_number,
                p.maya_qr_code,
                p.payment_method,
                d.dropoff_location_name,
                d.dropoff_address,
                d.dropoff_hours,
                d.dropoff_notes,
                d.dropoff_image
            FROM organizations o
            JOIN accounts ON o.account_id = accounts.account_id
            INNER JOIN organization_payment_details p ON o.organization_id = p.organization_id
                LEFT JOIN organization_dropoff_details d ON o.organization_id = d.organization_id
    WHERE o.verification_status = 'Approved'
      AND (
          (p.gcash_number IS NOT NULL AND TRIM(p.gcash_number) != '') OR 
          (p.maya_number IS NOT NULL AND TRIM(p.maya_number) != '')
      )
`);
        const formattedOrgs = organizations.map(org => {
            const normalizeQrCode = imagePath => {
                if (typeof imagePath !== 'string') {
                    return '';
                }

                const image = imagePath.trim();
                if (!image || image === 'null' || image === 'undefined') {
                    return '';
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

                const localPath = image.replace(/\\/g, '/');
                if (localPath.startsWith('/')) {
                    return localPath;
                }
                if (localPath.startsWith('uploads/')) {
                    return `/${localPath}`;
                }
                return `/uploads/qr/${encodeURIComponent(localPath)}`;
            };

            const profilePic = (org.profile_pic && org.profile_pic.trim() !== '')
                ? (org.profile_pic.startsWith('/') ? org.profile_pic : `/uploads/${org.profile_pic}`)
                : '/uploads/default-org.png';

            const qrCode = normalizeQrCode(org.qr_code);

            const mayaQrCode = normalizeQrCode(org.maya_qr_code);

            let dropoffImg = (org.dropoff_image && org.dropoff_image.trim() !== '') ? org.dropoff_image.trim() : '';

            if (dropoffImg && !dropoffImg.startsWith('/') && !dropoffImg.startsWith('http')) {
                if (dropoffImg.startsWith('qr-')) {
                    dropoffImg = `/uploads/qr/${dropoffImg}`;
                } else {
                    dropoffImg = `/uploads/${dropoffImg}`;
                }
            }

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

/**
 * Pag-submit ng Cash Donation mula sa Landing Page
 */
exports.submitCashDonation = async (req, res) => {
    const accountId = req.session?.accountId || null;

    let {
        organization_id,
        donor_name,
        gcash_account_name,
        reference_number,
        amount,
        payment_method,
        is_anonymous
    } = req.body;

    //  Handle anonymous flag
    const anonymous =
        is_anonymous === true ||
        is_anonymous === 'true' ||
        is_anonymous === 'on' ||
        is_anonymous === '1';

    //  Kapag anonymous, i-force ang donor_name sa "Anonymous Donor"
    if (anonymous) {
        donor_name = "Anonymous Donor";
        gcash_account_name = "Anonymous Donor";
    } else {
        // Kung hindi anonymous, siguraduhing may pangalan
        donor_name = (donor_name || '').trim();
        if (!donor_name) {
            return res.status(400).json({
                success: false,
                error: "Please enter your name or check 'Donate Anonymously'."
            });
        }
    }

    // Validation
    if (!organization_id || !reference_number || !amount) {
        return res.status(400).json({
            success: false,
            error: "Please fill in all required fields."
        });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({
            success: false,
            error: "Donation amount must be greater than zero."
        });
    }

    const cleanRefNum = reference_number.trim();
    const refRegex = /^(?=.*[0-9])[a-zA-Z0-9]{10,15}$/;
    if (!refRegex.test(cleanRefNum)) {
        return res.status(400).json({
            success: false,
            error: "Please enter a valid reference number (10-15 alphanumeric characters including a digit)."
        });
    }

    if (!req.file) {
        return res.status(400).json({
            success: false,
            error: "Please upload your proof of payment (Receipt)."
        });
    }

    try {
        // Check duplicate reference number
        const [existingRef] = await pool.query(
            `SELECT cash_donation_id FROM cash_donations WHERE reference_number = ? LIMIT 1`,
            [cleanRefNum]
        );

        if (existingRef.length > 0) {
            return res.status(400).json({
                success: false,
                error: "This reference number has already been submitted."
            });
        }

        // Check payment method availability
        const [paymentRows] = await pool.query(
            `SELECT gcash_number, maya_number, payment_method FROM organization_payment_details WHERE organization_id = ?`,
            [organization_id]
        );

        const selectedMethod = (payment_method ? payment_method.trim() : 'gcash').toLowerCase();

        if (selectedMethod !== 'gcash' && selectedMethod !== 'maya') {
            return res.status(400).json({
                success: false,
                error: "Invalid payment method. Must be GCash or Maya."
            });
        }

        if (selectedMethod === 'maya') {
            if (!paymentRows.length || !paymentRows[0].maya_number) {
                return res.status(400).json({
                    success: false,
                    error: "Maya payment details are not set for this organization."
                });
            }
        } else {
            if (!paymentRows.length || !paymentRows[0].gcash_number) {
                return res.status(400).json({
                    success: false,
                    error: "GCash payment details are not set for this organization."
                });
            }
        }

        // Upload receipt to Cloudinary
        const receipt_path = await uploadToCloudinary(
            req.file,
            "pawpon/donation-receipts"
        );

        let adopter_id = null;
        if (accountId) {
            const [adopterRows] = await pool.query(
                `SELECT adopter_id FROM adopters WHERE account_id = ?`,
                [accountId]
            );
            if (adopterRows.length > 0) adopter_id = adopterRows[0].adopter_id;
        }
        // Email
        const finalEmail = (req.body.donor_email || '').trim();

        const [result] = await pool.query(
            `INSERT INTO cash_donations 
            (adopter_id, organization_id, donor_name, donor_email, gcash_account_name, reference_number, amount, receipt_path, payment_method, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', NOW())`,
            [
                adopter_id,
                organization_id,
                donor_name,                                 
                finalEmail,
                gcash_account_name || donor_name,            
                cleanRefNum,
                parsedAmount,
                receipt_path,
                selectedMethod
            ]
        );

        if (accountId) {
            await logActivity(
                accountId,
                "donation_submitted",
                "cash_donation",
                result.insertId,
                `₱${parsedAmount}`
            );
        }

        // Notify organization
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
        return res.status(500).json({
            success: false,
            error: "Database error while processing donation: " + error.message
        });
    }
};
/**
 * Pag-submit ng In-Kind Donation mula sa Landing Page 
 * Sine-save sa `inkind_donations` table.
 */
exports.submitInKindDonation = async (req, res) => {
    const accountId = req.session?.accountId || null;

    let {
        organization_id,
        donor_name,
        donor_email,
        item_name,
        quantity,
        unit,
        contact_info,
        dropoff_method,
        is_anonymous
    } = req.body;

    // ⭐ Anonymous 
    const anonymous =
        is_anonymous === true ||
        is_anonymous === 'true' ||
        is_anonymous === 'on' ||
        is_anonymous === '1';

    if (anonymous) {
        donor_name = "Anonymous Donor";
    } else {
        donor_name = (donor_name || '').trim();
        if (!donor_name) {
            return res.status(400).json({
                success: false,
                error: "Please enter your name or check 'Donate Anonymously'."
            });
        }
    }

       // ---------- Validation ----------
    if (!organization_id) {
        return res.status(400).json({
            success: false,
            error: "Please select an organization."
        });
    }

    // ⭐ STEP 1: Define & check cleanItemName FIRST
    const cleanItemName = (item_name || '').trim();
    if (!cleanItemName) {
        return res.status(400).json({
            success: false,
            error: "Please enter the item you wish to donate."
        });
    }

    // ⭐ STEP 2: THEN validate its format
    const itemNameLooksValid = (() => {
        const v = cleanItemName;
        if (v.length < 3) return false;
        if (!/[a-zA-Z]/.test(v)) return false;
        if (!/[aeiouAEIOU]/.test(v)) return false;
        if (/(.)\1{3,}/i.test(v)) return false;
        if (/[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]{5,}/.test(v)) return false;
        if (/(asdf|sdfg|dfgh|fghj|ghjk|hjkl|qwer|wert|erty|rtyu|tyui|yuiop|zxcv|xcvb|cvbn|vbnm)/i
                .test(v.replace(/\s+/g, ''))) return false;

        const words = v.split(/[\s\-',.()\/&+]+/).filter(Boolean);
        for (const w of words) {
            const letters = w.replace(/[^a-zA-Z]/g, '');
            if (letters.length >= 3 && !/[aeiouAEIOU]/.test(letters)) return false;
        }
        return true;
    })();

    if (!itemNameLooksValid) {
        return res.status(400).json({
            success: false,
            error: "Please enter a valid item name."
        });
    }

    const parsedQty = parseInt(quantity, 10);
    if (isNaN(parsedQty) || parsedQty <= 0) {
        return res.status(400).json({
            success: false,
            error: "Quantity must be a positive number."
        });
    }

  
    let finalEmail = (donor_email || '').trim();
    if (!finalEmail && contact_info && /@/.test(contact_info)) {
        finalEmail = contact_info.trim();
    }
    

    const finalUnit = (unit || 'pcs').trim() || 'pcs';

    try {
        // Kunin ang adopter_id kung naka-login
        let adopter_id = null;
        if (accountId) {
            const [adopterRows] = await pool.query(
                `SELECT adopter_id FROM adopters WHERE account_id = ?`,
                [accountId]
            );
            if (adopterRows.length > 0) adopter_id = adopterRows[0].adopter_id;
        }

        // ---------- INSERT ----------
        const [result] = await pool.query(
            `INSERT INTO inkind_donations
                (adopter_id, organization_id, donor_name, donor_email,
                 item_name, quantity, unit, location_image_path, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'Pending', NOW())`,
            [
                adopter_id,
                organization_id,
                donor_name,
                finalEmail,
                cleanItemName,
                parsedQty,
                finalUnit
            ]
        );

        // Log activity (kung naka-login)
        if (accountId) {
            await logActivity(
                accountId,
                "donation_submitted",
                "inkind_donation",
                result.insertId,
                `${parsedQty} ${finalUnit} of ${cleanItemName}`
            );
        }

        // Notify organization
        const [[orgAccount]] = await pool.query(
            `SELECT account_id FROM organizations WHERE organization_id = ?`,
            [organization_id]
        );

        if (orgAccount) {
            await createNotification(
                orgAccount.account_id,
                "New In-Kind Donation",
                `${donor_name} pledged ${parsedQty} ${finalUnit} of ${cleanItemName}.`,
                "donation_submitted",
                "/org/donation"
            );
        }

        return res.json({
            success: true,
            message: "Thank you! Your in-kind donation pledge has been submitted and is pending verification.",
            donationId: result.insertId
        });

    } catch (error) {
        console.error("Submit In-Kind Donation Error:", error);
        return res.status(500).json({
            success: false,
            error: "Database error while processing in-kind donation: " + error.message
        });
    }
};
// ==========================================
// PUBLIC STATS — for landing page live counters
// Only APPROVED records are counted.
// ==========================================
exports.getPublicStats = async (req, res) => {
    try {
        // 1. Approved cash donations: count + total amount
        const [[cashStats]] = await pool.query(`
            SELECT 
                COUNT(*) AS total_count,
                COALESCE(SUM(amount), 0) AS total_amount
            FROM cash_donations
            WHERE status = 'Approved'
        `);

        // 2. Approved in-kind donations: count only
        const [[inkindStats]] = await pool.query(`
            SELECT COUNT(*) AS total_count
            FROM inkind_donations
            WHERE status = 'Approved'
        `);

        // 3. Adopted pets — count DISTINCT animals from approved applications
        const [[adoptionStats]] = await pool.query(`
            SELECT COUNT(DISTINCT animal_id) AS total_count
            FROM user_adoption_applications
            WHERE status = 'Approved'
        `);

        res.json({
            success: true,
            stats: {
                totalCashDonations: Number(cashStats.total_count) || 0,
                totalInKindDonations: Number(inkindStats.total_count) || 0,
                totalDonatedAmount: Number(cashStats.total_amount) || 0,
                totalAdoptedPets: Number(adoptionStats.total_count) || 0
            }
        });
    } catch (err) {
        console.error("Get Public Stats Error:", err);
        res.status(500).json({ success: false, message: "Failed to load stats." });
    }
};