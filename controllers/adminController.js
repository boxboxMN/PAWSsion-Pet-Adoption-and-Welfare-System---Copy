
const pool = require("../config/database");
const bcrypt = require("bcrypt");
const { sendMail } = require("../config/email");
//for email validation
const validator = require('validator');

/**
 * Records an admin activity log entry. Never throws — logging failures
 * should never block the actual action from completing.
 */
async function logActivity(accountId, action, targetType, targetId = null, details = null) {
    try {
        await pool.query(
            `INSERT INTO activity_logs (account_id, action, target_type, target_id, details)
             VALUES (?, ?, ?, ?, ?)`,
            [accountId, action, targetType, targetId, details]
        );
    } catch (err) {
        console.error("Log Activity Error:", err);
    }
}
exports.logActivity = logActivity;

/**
 * Creates a notification for one account. Never throws.
 */
async function createNotification(accountId, title, message, type, link = null) {
    try {
        await pool.query(
            `INSERT INTO notifications (account_id, title, message, type, link) VALUES (?, ?, ?, ?, ?)`,
            [accountId, title, message, type, link]
        );
    } catch (err) {
        console.error("Create Notification Error:", err);
    }
}
exports.createNotification = createNotification;

/**
 * Notifies every admin account at once (for admin-wide events).
 */
async function notifyAllAdmins(title, message, type, link = null) {
    try {
        const [admins] = await pool.query(`SELECT account_id FROM accounts WHERE role = 'admin'`);
        for (const admin of admins) {
            await createNotification(admin.account_id, title, message, type, link);
        }
    } catch (err) {
        console.error("Notify All Admins Error:", err);
    }
}
exports.notifyAllAdmins = notifyAllAdmins;

/*** GET /api/notifications */
exports.getNotifications = async (req, res) => {
    try {
        const accountId = req.session?.accountId;
        if (!accountId) return res.status(401).json({ success: false, message: "Unauthorized" });

        if (req.session.role === "adopter") {
            const { checkKamustahanRemindersDue } = require("./userController");
            await checkKamustahanRemindersDue(accountId);
        }

        const [rows] = await pool.query(
            `SELECT notification_id, title, message, type, is_read, link, created_at
             FROM notifications
             WHERE account_id = ?
             ORDER BY created_at DESC
             LIMIT 50`,
            [accountId]
        );

        const [[{ unreadCount }]] = await pool.query(
            `SELECT COUNT(*) AS unreadCount FROM notifications WHERE account_id = ? AND is_read = 0`,
            [accountId]
        );

        res.json({ success: true, notifications: rows, unreadCount });
    } catch (err) {
        console.error("Get Notifications Error:", err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
};

/**
 * PUT /api/notifications/:id/read
 */
exports.markNotificationRead = async (req, res) => {
    try {
        const accountId = req.session?.accountId;
        if (!accountId) return res.status(401).json({ success: false, message: "Unauthorized" });

        await pool.query(
            `UPDATE notifications SET is_read = 1 WHERE notification_id = ? AND account_id = ?`,
            [req.params.id, accountId]
        );

        res.json({ success: true });
    } catch (err) {
        console.error("Mark Notification Read Error:", err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
};

/**
 * PUT /api/notifications/read-all
 */
exports.markAllNotificationsRead = async (req, res) => {
    try {
        const accountId = req.session?.accountId;
        if (!accountId) return res.status(401).json({ success: false, message: "Unauthorized" });

        await pool.query(
            `UPDATE notifications SET is_read = 1 WHERE account_id = ? AND is_read = 0`,
            [accountId]
        );

        res.json({ success: true });
    } catch (err) {
        console.error("Mark All Notifications Read Error:", err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
};

/**
 * DELETE /api/notifications/:id
 */
exports.deleteNotification = async (req, res) => {
    try {
        const accountId = req.session?.accountId;
        if (!accountId) return res.status(401).json({ success: false, message: "Unauthorized" });

        const [result] = await pool.query(
            `DELETE FROM notifications WHERE notification_id = ? AND account_id = ?`,
            [req.params.id, accountId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Notification not found." });
        }

        res.json({ success: true });
    } catch (err) {
        console.error("Delete Notification Error:", err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
};

/**
 * GET ALL PENDING ORGANIZATION REQUESTS
 * GET /admin/api/partner-requests
 */
exports.getPartnerRequests = async (req, res) => {
    try {

        const [rows] = await pool.query(`
            SELECT
                o.organization_id,
                o.organization_name,
                o.organization_type,
                o.contact_person,
                o.contact_number,
                o.address,
                o.city,
                o.province,
                o.description,
                o.verification_status,

                a.account_id,
                a.email,
                a.created_at

            FROM organizations o

            INNER JOIN accounts a
                ON o.account_id = a.account_id

            WHERE o.verification_status = 'Pending'

            ORDER BY a.created_at DESC
        `);

        res.json({
            success: true,
            organizations: rows
        });

    } catch (err) {

        console.error("Partner Requests Error:", err);

        res.status(500).json({
            success: false,
            message: "Failed to load partner requests."
        });

    }
};

/**
 * GET ALL APPROVED ORGANIZATIONS
 * GET /admin/api/organizations
 */
exports.getOrganizations = async (req, res) => {

    try {

        const [rows] = await pool.query(`
            SELECT

                o.organization_id,
                o.organization_name,
                o.organization_type,
                o.contact_person,
                o.contact_number,
                o.address,
                o.city,
                o.province,
                o.description,
                o.verification_status,

                a.account_id,
                a.email,
                a.created_at

            FROM organizations o

            INNER JOIN accounts a
                ON o.account_id = a.account_id

            WHERE o.verification_status='Approved'

            ORDER BY o.organization_name ASC
        `);

        res.json({
            success: true,
            organizations: rows
        });

    } catch (err) {

        console.error("Organizations Error:", err);

        res.status(500).json({
            success: false,
            message: "Unable to load organizations."
        });

    }

};

exports.updateUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const accountId = req.session?.accountId;
        const { status } = req.body; 
        await pool.query("UPDATE accounts SET status = ? WHERE account_id = ?", [status, id]);
        await logActivity(accountId, "user_status_changed", "user", id, `New status: ${status}`);
        
        res.json({ success: true, message: "Account status updated successfully." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to update status." });
    }
};
exports.getCurrentAdmin = async (req, res) => {
    try {
        const accountId = req.session?.accountId; // <--- Alisin ang underscore
        if (!accountId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const [[user]] = await pool.query(`
            SELECT account_id, email, role
            FROM accounts
            WHERE account_id = ?
        `, [accountId]);

        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        user.name = user.role === 'admin' ? "System Administrator" : user.email;

        res.json({ success: true, user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
};

exports.updateAdminProfile = async (req, res) => {
    try {
        const accountId = req.session?.accountId;
        
        if (!accountId) {
            return res.status(401).json({ success: false, message: "Unauthorized. Please log in again." });
        }

        // --- CHECK LOCKOUT (shared with verify-password) ---
        const adminRecord = getAdminAttemptRecord(accountId);
        if (adminRecord.lockedUntil && Date.now() < adminRecord.lockedUntil) {
            const remainingTime = Math.ceil((adminRecord.lockedUntil - Date.now()) / 60000);
            return res.status(429).json({
                success: false,
                message: `Too many failed attempts. Try again in ${remainingTime} minute(s).`
            });
        }

        const { email, currentPassword, password } = req.body;
        const passwordComplexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#]).{8,}$/;
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        // --- Require current password for ANY change to this profile ---
        if (!currentPassword || !currentPassword.trim()) {
            return res.status(400).json({ success: false, message: "Current password is required to save changes." });
        }

        const [[account]] = await pool.query(
            `SELECT password_hash FROM accounts WHERE account_id = ?`,
            [accountId]
        );

        if (!account) {
            return res.status(404).json({ success: false, message: "Account not found." });
        }

        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, account.password_hash);

        if (!isCurrentPasswordValid) {
            adminRecord.attempts -= 1;

            if (adminRecord.attempts <= 0) {
                adminRecord.lockedUntil = Date.now() + 15 * 60 * 1000;
                adminRecord.attempts = 5;
                adminPasswordAttempts.set(accountId, adminRecord);

                await logActivity(accountId, "admin_profile_verify_locked", "admin_profile", accountId, "Locked after 5 failed attempts (via save)");

                return res.status(429).json({
                    success: false,
                    message: "Too many failed attempts. You are locked out from changing your profile for 15 minutes."
                });
            }

            adminPasswordAttempts.set(accountId, adminRecord);

            await logActivity(accountId, "admin_profile_verification_failed", "admin_profile", accountId, `Wrong current password (via save), attempts remaining: ${adminRecord.attempts}`);

            return res.status(401).json({
                success: false,
                message: `Current password is incorrect. You have ${adminRecord.attempts} attempt(s) remaining.`
            });
        }

        // Reset on success
        adminPasswordAttempts.delete(accountId);

        // --- Validate email ---
        if (!email || !emailPattern.test(email.trim())) {
            return res.status(400).json({ success: false, message: "Please enter a valid email address." });
        }

        // 1. Update email
        await pool.query(
            `UPDATE accounts SET email = ?, updated_at = NOW() WHERE account_id = ?`,
            [email.trim(), accountId]
        );

        // 2. I-update ang password_hash kung may inilagay na bago
        if (password && password.trim() !== "") {
            if (!passwordComplexityRegex.test(password)) {
                return res.status(400).json({
                    success: false,
                    message: "New password must be at least 8 characters, with uppercase, lowercase, a number, and a special character."
                });
            }

            const isSameAsCurrent = await bcrypt.compare(password, account.password_hash);
            if (isSameAsCurrent) {
                return res.status(400).json({
                    success: false,
                    message: "New password cannot be the same as your current password."
                });
            }

            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            await pool.query(
                `UPDATE accounts SET password_hash = ?, updated_at = NOW() WHERE account_id = ?`,
                [hashedPassword, accountId]
            );
        }

        await logActivity(accountId, "admin_profile_updated", "admin_profile", accountId, password ? "Email & password changed" : "Email changed");

        res.json({ success: true, message: "Profile updated successfully in the database!" });
    } catch (err) {
        console.error("Database Update Error:", err);
        res.status(500).json({ success: false, message: "Database Error: " + err.message });
    }
};

/**
 * VERIFY ADMIN'S CURRENT PASSWORD (used to unlock the New Password field)
 * POST /admin/profile/verify-password
 */
const adminPasswordAttempts = new Map(); // Map<accountId, { attempts: number, lockedUntil: number|null }>

function getAdminAttemptRecord(accountId) {
    return adminPasswordAttempts.get(accountId) || { attempts: 5, lockedUntil: null };
}

exports.verifyAdminPassword = async (req, res) => {
    try {
        const accountId = req.session?.accountId;
        if (!accountId) return res.status(401).json({ success: false, message: "Unauthorized" });

        const record = getAdminAttemptRecord(accountId);

        if (record.lockedUntil && Date.now() < record.lockedUntil) {
            const remainingTime = Math.ceil((record.lockedUntil - Date.now()) / 60000);
            return res.status(429).json({
                success: false,
                valid: false,
                locked: true,
                message: `Too many failed attempts. Try again in ${remainingTime} minute(s).`
            });
        }

        const { currentPassword } = req.body;
        if (!currentPassword) {
            return res.status(400).json({ success: false, valid: false, message: "Password is required." });
        }

        const [[account]] = await pool.query(
            `SELECT password_hash FROM accounts WHERE account_id = ?`,
            [accountId]
        );

        if (!account) {
            return res.status(404).json({ success: false, valid: false, message: "Account not found." });
        }

        const isValid = await bcrypt.compare(currentPassword, account.password_hash);

        if (!isValid) {
            record.attempts -= 1;

            if (record.attempts <= 0) {
                record.lockedUntil = Date.now() + 15 * 60 * 1000;
                record.attempts = 5;
                adminPasswordAttempts.set(accountId, record);

                await logActivity(accountId, "admin_profile_verify_locked", "admin_profile", accountId, "Locked after 5 failed attempts");

                return res.status(429).json({
                    success: false,
                    valid: false,
                    locked: true,
                    message: "Too many failed attempts. You are locked out from changing password for 15 minutes."
                });
            }

            adminPasswordAttempts.set(accountId, record);

            await logActivity(accountId, "admin_profile_verification_failed", "admin_profile", accountId, `Attempts remaining: ${record.attempts}`);

            return res.json({
                success: true,
                valid: false,
                attemptsLeft: record.attempts,
                message: `Incorrect password. You have ${record.attempts} attempt(s) remaining.`
            });
        }

        // Reset on success
        adminPasswordAttempts.delete(accountId);

        res.json({ success: true, valid: true });
    } catch (err) {
        console.error("Verify Admin Password Error:", err);
        res.status(500).json({ success: false, valid: false, message: "Database Error" });
    }
};

/**
 * GET ALL FEEDBACK (from organizations and adopters)
 * GET /admin/feedback/listORGANIZATION
 */
exports.getFeedback = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                f.feedback_id AS id,
                accounts.email AS sender_email,
                CASE
                    WHEN f.submitted_by = 'organization' THEN 'Organization'
                    WHEN f.submitted_by = 'user' THEN 'Adopter'
                END AS sender_role,
                CASE
                    WHEN f.submitted_by = 'organization' THEN organizations.organization_name
                    WHEN f.submitted_by = 'user' THEN CONCAT(adopters.first_name, ' ', adopters.last_name)
                END AS sender_name,
                CASE
                    WHEN f.submitted_by = 'organization' THEN organizations.profile_pic
                    WHEN f.submitted_by = 'user' THEN adopters.profile_picture
                END AS sender_profile_picture,
                f.feedback_type,
                f.subject,
                f.message,
                f.rating,
                f.status,
                f.previous_status,
                f.created_at AS date
            FROM feedback f
            JOIN accounts ON accounts.account_id = f.account_id
            LEFT JOIN organizations ON organizations.organization_id = f.organization_id
            LEFT JOIN adopters ON adopters.account_id = f.account_id
            ORDER BY f.created_at DESC
        `);

        res.json(rows);
    } catch (err) {
        console.error("Get Feedback Error:", err);
        res.status(500).json({ message: "Database Error" });
    }
};

/**
 * UPDATE FEEDBACK STATUS (resolve / archive)
 * PUT /admin/feedback/:id/status
 */
exports.updateFeedbackStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const accountId = req.session?.accountId;
        const { action } = req.body;

        const validActions = ["resolve", "unresolve", "archive", "unarchive"];
        if (!validActions.includes(action)) {
            return res.status(400).json({ success: false, message: "Invalid action provided." });
        }

        if (action === "archive") {
            const [[current]] = await pool.query(
                `SELECT status FROM feedback WHERE feedback_id = ?`,
                [id]
            );

            if (!current) {
                return res.status(404).json({ success: false, message: "Feedback not found." });
            }

            await pool.query(
                `UPDATE feedback SET previous_status = ?, status = 'archived' WHERE feedback_id = ?`,
                [current.status, id]
            );

            //for logging the archive action
            await logActivity(accountId, "feedback_archived", "feedback", id, `Was: ${current.status}`);

            return res.json({ success: true, status: "archived", previous_status: current.status });
        }

        if (action === "unarchive") {
            const [[current]] = await pool.query(
                `SELECT previous_status FROM feedback WHERE feedback_id = ?`,
                [id]
            );

            if (!current) {
                return res.status(404).json({ success: false, message: "Feedback not found." });
            }

            const restoredStatus = current.previous_status || "pending";

            await pool.query(
                `UPDATE feedback SET status = ?, previous_status = NULL WHERE feedback_id = ?`,
                [restoredStatus, id]
            );

            //for logging the unarchive action
            await logActivity(accountId, "feedback_unarchived", "feedback", id, `Restored to: ${restoredStatus}`);

            return res.json({ success: true, status: restoredStatus, previous_status: null });
        }

            // action === "resolve" or "unresolve"
            const newStatus = action === "resolve" ? "resolved" : "pending";

            // Kunin muna ang orihinal na nagsumite bago i-update, para malaman kung sino ang aabisuhan
            const [[feedbackRow]] = await pool.query(
                `SELECT account_id, subject FROM feedback WHERE feedback_id = ?`,
                [id]
            );

            if (!feedbackRow) {
                return res.status(404).json({ success: false, message: "Feedback not found." });
            }

            const [result] = await pool.query(
                   `UPDATE feedback SET status = ?, previous_status = NULL WHERE feedback_id = ?`,
                   [newStatus, id]
            );

            //for logging the resolve/unresolve action
            await logActivity(accountId, action === "resolve" ? "feedback_resolved" : "feedback_unresolved", "feedback", id);
       
            // if (result.affectedRows === 0) {
            //        return res.status(404).json({ success: false, message: "Feedback not found." });
            // }

              // Abisuhan ang orihinal na nagsumite (user o org) tungkol sa update ng status
              if (feedbackRow.account_id) {
                if (action === "resolve") {
                    await createNotification(
                        feedbackRow.account_id,
                        "Your Feedback Has Been Resolved",
                        `Your feedback "${feedbackRow.subject}" has been marked as resolved by our team. Thank you for helping us improve Pawpon!`,
                        "feedback_resolved",
                        null
                    );
                } else {
                    await createNotification(
                        feedbackRow.account_id,
                        "Your Feedback Has Been Reopened",
                        `Your feedback "${feedbackRow.subject}" has been reopened for further review.`,
                        "feedback_reopened",
                        null
                    );
                }
            }

               res.json({ success: true, status: newStatus, previous_status: null });

    } catch (err) {
        console.error("Update Feedback Status Error:", err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
};

/**
 * GET ALL CONTACT MESSAGES (from the public Contact Us form)
 * GET /admin/contact-messages/list
 */
exports.getContactMessages = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                cm.message_id AS id,
                cm.account_id,
                cm.full_name AS sender_name,
                cm.email AS sender_email,
                'Website Visitor' AS sender_role,
                NULL AS sender_profile_picture,
                cm.subject_category,
                cm.message,
                cm.status,
                cm.previous_status,
                cm.created_at AS date
            FROM contact_messages cm
            ORDER BY cm.created_at DESC
        `);

        res.json(rows);
    } catch (err) {
        console.error("Get Contact Messages Error:", err);
        res.status(500).json({ message: "Database Error" });
    }
};

/**
 * UPDATE CONTACT MESSAGE STATUS (resolve / archive)
 * PUT /admin/contact-messages/:id/status
 */
exports.updateContactMessageStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const accountId = req.session?.accountId;
        const { action } = req.body;

        const validActions = ["resolve", "unresolve", "archive", "unarchive"];
        if (!validActions.includes(action)) {
            return res.status(400).json({ success: false, message: "Invalid action provided." });
        }

        if (action === "archive") {
            const [[current]] = await pool.query(
                `SELECT status FROM contact_messages WHERE message_id = ?`,
                [id]
            );

            if (!current) {
                return res.status(404).json({ success: false, message: "Message not found." });
            }

            await pool.query(
                `UPDATE contact_messages SET previous_status = ?, status = 'archived' WHERE message_id = ?`,
                [current.status, id]
            );

            await logActivity(accountId, "contact_message_archived", "contact_message", id, `Was: ${current.status}`);

            return res.json({ success: true, status: "archived", previous_status: current.status });
        }

        if (action === "unarchive") {
            const [[current]] = await pool.query(
                `SELECT previous_status FROM contact_messages WHERE message_id = ?`,
                [id]
            );

            if (!current) {
                return res.status(404).json({ success: false, message: "Message not found." });
            }

            const restoredStatus = current.previous_status || "pending";

            await pool.query(
                `UPDATE contact_messages SET status = ?, previous_status = NULL WHERE message_id = ?`,
                [restoredStatus, id]
            );

            await logActivity(accountId, "contact_message_unarchived", "contact_message", id, `Restored to: ${restoredStatus}`);

            return res.json({ success: true, status: restoredStatus, previous_status: null });
        }

        // action === "resolve" or "unresolve"
        const newStatus = action === "resolve" ? "resolved" : "pending";

        const [[messageRow]] = await pool.query(
            `SELECT account_id, full_name, email FROM contact_messages WHERE message_id = ?`,
            [id]
        );

        if (!messageRow) {
            return res.status(404).json({ success: false, message: "Message not found." });
        }

        const [result] = await pool.query(
            `UPDATE contact_messages SET status = ?, previous_status = NULL WHERE message_id = ?`,
            [newStatus, id]
        );

        await logActivity(accountId, action === "resolve" ? "contact_message_resolved" : "contact_message_unresolved", "contact_message", id);

        // I-notify lang kung may account_id talaga (baka anonymous ang nag-submit, walang account na aabisuhan)
        if (messageRow.account_id) {
            if (action === "resolve") {
                await createNotification(
                    messageRow.account_id,
                    "Your Message Has Been Resolved",
                    `Your contact message has been marked as resolved by our team.`,
                    "contact_message_resolved",
                    null
                );
            } else {
                await createNotification(
                    messageRow.account_id,
                    "Your Message Has Been Reopened",
                    `Your contact message has been reopened for further review.`,
                    "contact_message_reopened",
                    null
                );
            }
        }

        // Palaging mag-send ng email — gumagana ito kahit walang account_id,
        // dahil ang email address ay direktang galing sa contact form mismo
        if (action === "resolve" && messageRow.email) {
            try {
                await sendMail({
                    from: `"Pawpon Support" <${process.env.EMAIL_USER}>`,
                    to: messageRow.email,
                    subject: "Your Pawpon Message Has Been Resolved",
                    html: `
                        <div style="
                            font-family: Arial, sans-serif;
                            max-width: 600px;
                            margin: auto;
                            padding: 30px;
                            color: #334155;
                        ">
                            <h2 style="color:#1656ff;">
                                Your Message Has Been Resolved
                            </h2>

                            <p>Hi ${messageRow.full_name || "there"},</p>

                            <p>
                                Thanks for reaching out to Pawpon. Our team has reviewed
                                your message and marked it as resolved.
                            </p>

                            <p>
                                If you have any further questions or your concern wasn't
                                fully addressed, feel free to send us another message
                                through our Contact page.
                            </p>

                            <p style="margin-top: 30px;">
                                — The Pawpon Team
                            </p>
                        </div>
                    `
                });
            } catch (mailErr) {
                // Hindi natin dapat ipa-fail ang buong request kung nabigo lang ang email
                console.error("Failed to send resolution email:", mailErr);
            }
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Message not found." });
        }

        res.json({ success: true, status: newStatus, previous_status: null });
    } catch (err) {
        console.error("Update Contact Message Status Error:", err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
};

/**
 * GET SITE CONTACT INFO (public — used by org & user support pages)
 * GET /api/contact-info
 */
exports.getContactInfo = async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT setting_key, setting_value FROM site_settings`);

        const info = {};
        rows.forEach(row => {
            info[row.setting_key] = row.setting_value;
        });

        res.json({ success: true, contactInfo: info });
    } catch (err) {
        console.error("Get Contact Info Error:", err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
};

/**
 * UPDATE SITE CONTACT INFO (admin only)
 * PUT /admin/settings/contact-info
 */
exports.updateContactInfo = async (req, res) => {
    try {
        const accountId = req.session?.accountId;
        if (!accountId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        let { support_email, support_phone, support_hours_days, support_hours_time } = req.body;

        // --- Sanitize ---
        if (support_email) support_email = support_email.trim();
        if (support_phone) support_phone = support_phone.replace(/\D/g, "").slice(0, 11);
        if (support_hours_days) support_hours_days = support_hours_days.trim();
        if (support_hours_time) support_hours_time = support_hours_time.trim();

        // --- Validate ---
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (support_email !== undefined && !emailPattern.test(support_email)) {
            return res.status(400).json({ success: false, message: "Invalid email address." });
        }

        const phPhonePattern = /^09\d{9}$/;
        if (support_phone !== undefined && !phPhonePattern.test(support_phone)) {
            return res.status(400).json({ success: false, message: "Phone number must be 11 digits starting with 09 (PH mobile format)." });
        }

        const validDays = ["Monday – Friday", "Monday – Saturday", "Monday – Sunday", "Saturday – Sunday"];
        if (support_hours_days !== undefined && !validDays.includes(support_hours_days)) {
            return res.status(400).json({ success: false, message: "Invalid support days selection." });
        }

        if (support_hours_time !== undefined && support_hours_time.trim() === "") {
            return res.status(400).json({ success: false, message: "Support time is required." });
        }

        const updates = { support_email, support_phone, support_hours_days, support_hours_time };

        for (const [key, value] of Object.entries(updates)) {
            if (value === undefined) continue;
            await pool.query(
                `UPDATE site_settings SET setting_value = ? WHERE setting_key = ?`,
                [value, key]
            );
        }

        await logActivity(accountId, "contact_info_updated", "contact_info", null);

        res.json({ success: true, message: "Contact info updated successfully!" });
    } catch (err) {
        console.error("Update Contact Info Error:", err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
};

/**
 * GET GUIDE SECTIONS (public — used by support pages, and admin editor)
 * GET /api/guide?audience=organization
 */
exports.getGuideSections = async (req, res) => {
    try {
        const audience = req.query.audience || "organization";

        const [rows] = await pool.query(
            `SELECT section_id, title, badge_color, bullets, display_order
             FROM guide_sections
             WHERE audience = ? AND deleted_at IS NULL
             ORDER BY display_order ASC, section_id ASC`,
            [audience]
        );

        res.json({ success: true, sections: rows });
    } catch (err) {
        console.error("Get Guide Sections Error:", err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
};

/**
 * CREATE GUIDE SECTION (admin only)
 * POST /admin/guide/sections
 */
exports.createGuideSection = async (req, res) => {
    try {
        const accountId = req.session?.accountId;
        if (!accountId) return res.status(401).json({ success: false, message: "Unauthorized" });

        const { audience, title, badge_color, bullets } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: "Title is required." });
        }
        if (!bullets || !bullets.trim()) {
            return res.status(400).json({ success: false, message: "At least one bullet point is required." });
        }

        const [[maxOrder]] = await pool.query(
            `SELECT COALESCE(MAX(display_order), 0) AS maxOrder FROM guide_sections WHERE audience = ?`,
            [audience || "organization"]
        );

        await pool.query(
            `INSERT INTO guide_sections (audience, title, badge_color, bullets, display_order)
             VALUES (?, ?, ?, ?, ?)`,
            [audience || "organization", title.trim(), badge_color || "blue", bullets.trim(), maxOrder.maxOrder + 1]
        );

        // Log the creation of a new guide section
        await logActivity(accountId, "guide_section_created", "guide_section", null, title.trim());

        res.status(201).json({ success: true, message: "Section added." });
    } catch (err) {
        console.error("Create Guide Section Error:", err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
};

/**
 * UPDATE GUIDE SECTION (admin only)
 * PUT /admin/guide/sections/:id
 */
exports.updateGuideSection = async (req, res) => {
    try {
        const accountId = req.session?.accountId;
        if (!accountId) return res.status(401).json({ success: false, message: "Unauthorized" });

        const { id } = req.params;
        const { title, badge_color, bullets, display_order } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: "Title is required." });
        }
        if (!bullets || !bullets.trim()) {
            return res.status(400).json({ success: false, message: "At least one bullet point is required." });
        }

        const [result] = await pool.query(
            `UPDATE guide_sections SET title = ?, badge_color = ?, bullets = ?, display_order = ? WHERE section_id = ?`,
            [title.trim(), badge_color || "blue", bullets.trim(), display_order || 0, id]
        );

        await logActivity(accountId, "guide_section_updated", "guide_section", id, title.trim());

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Section not found." });
        }

        res.json({ success: true, message: "Section updated." });
    } catch (err) {
        console.error("Update Guide Section Error:", err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
};

/**
 * DELETE GUIDE SECTION (admin only)
 * DELETE /admin/guide/sections/:id
 */
exports.deleteGuideSection = async (req, res) => {
    try {
        const accountId = req.session?.accountId;
        if (!accountId) return res.status(401).json({ success: false, message: "Unauthorized" });

        const { id } = req.params;

        const [result] = await pool.query(
            `UPDATE guide_sections SET deleted_at = NOW() WHERE section_id = ? AND deleted_at IS NULL`,
            [id]
        );

        await logActivity(accountId, "guide_section_deleted", "guide_section", id);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Section not found." });
        }

        res.json({ success: true, message: "Section moved to Recycle Bin." });
    } catch (err) {
        console.error("Delete Guide Section Error:", err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
};

/**
 * GET TRASHED GUIDE SECTIONS (admin only)
 * GET /admin/guide/sections/trash?audience=organization
 */
exports.getTrashedGuideSections = async (req, res) => {
    try {
        const accountId = req.session?.accountId;
        if (!accountId) return res.status(401).json({ success: false, message: "Unauthorized" });

        const audience = req.query.audience || "organization";

        await purgeExpiredGuideTrash();

        const [rows] = await pool.query(
            `SELECT section_id, title, badge_color, bullets, deleted_at,
                    DATEDIFF((deleted_at + INTERVAL 30 DAY), NOW()) AS days_left
             FROM guide_sections
             WHERE audience = ? AND deleted_at IS NOT NULL
             ORDER BY deleted_at DESC`,
            [audience]
        );

        res.json({ success: true, sections: rows });
    } catch (err) {
        console.error("Get Trashed Guide Sections Error:", err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
};

/**
 * RESTORE GUIDE SECTION FROM TRASH (admin only)
 * PUT /admin/guide/sections/:id/restore
 */
exports.restoreGuideSection = async (req, res) => {
    try {
        const accountId = req.session?.accountId;
        if (!accountId) return res.status(401).json({ success: false, message: "Unauthorized" });

        const { id } = req.params;

        const [result] = await pool.query(
            `UPDATE guide_sections SET deleted_at = NULL WHERE section_id = ? AND deleted_at IS NOT NULL`,
            [id]
        );

        await logActivity(accountId, "guide_section_restored", "guide_section", id);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Section not found in Recycle Bin." });
        }

        res.json({ success: true, message: "Section restored." });
    } catch (err) {
        console.error("Restore Guide Section Error:", err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
};

/**
 * RECYCLE BIN: Auto-purge guide sections trashed over 30 days
 */
async function purgeExpiredGuideTrash() {
    await pool.query(
        `DELETE FROM guide_sections
         WHERE deleted_at IS NOT NULL
         AND deleted_at < (NOW() - INTERVAL 30 DAY)`
    );
}

/**
 * PERMANENTLY DELETE GUIDE SECTION (admin only)
 * DELETE /admin/guide/sections/:id/permanent
 */
exports.permanentlyDeleteGuideSection = async (req, res) => {
    try {
        const accountId = req.session?.accountId;
        if (!accountId) return res.status(401).json({ success: false, message: "Unauthorized" });

        const { id } = req.params;

        const [result] = await pool.query(
            `DELETE FROM guide_sections WHERE section_id = ? AND deleted_at IS NOT NULL`,
            [id]
        );

        await logActivity(accountId, "guide_section_purged", "guide_section", id);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Section not found in Recycle Bin." });
        }

        res.json({ success: true, message: "Section permanently deleted." });
    } catch (err) {
        console.error("Permanently Delete Guide Section Error:", err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
};

/**
 * REORDER GUIDE SECTIONS (admin only)
 * PUT /admin/guide/sections/reorder
 */
exports.reorderGuideSections = async (req, res) => {
    try {
        const accountId = req.session?.accountId;
        if (!accountId) return res.status(401).json({ success: false, message: "Unauthorized" });

        const { orderedIds } = req.body;

        if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
            return res.status(400).json({ success: false, message: "orderedIds must be a non-empty array." });
        }

        for (let i = 0; i < orderedIds.length; i++) {
            await pool.query(
                `UPDATE guide_sections SET display_order = ? WHERE section_id = ?`,
                [i + 1, orderedIds[i]]
            );
        }

        await logActivity(accountId, "guide_sections_reordered", "guide_section", null, `${orderedIds.length} section(s)`);

        res.json({ success: true, message: "Order updated." });
    } catch (err) {
        console.error("Reorder Guide Sections Error:", err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
};

/**
 * ACTIVITY LOGS: Auto-purge entries older than the retention window
 */
async function purgeExpiredActivityLogs() {
    await pool.query(
        `DELETE FROM activity_logs
         WHERE created_at < (NOW() - INTERVAL 180 DAY)`
         
    );
}

/**
 * GET ACTIVITY LOGS (admin only)
 * GET /admin/logs
 */
exports.getActivityLogs = async (req, res) => {
    try {
        const accountId = req.session?.accountId;
        if (!accountId) return res.status(401).json({ success: false, message: "Unauthorized" });

        await purgeExpiredActivityLogs();
        
        const [rows] = await pool.query(`
            SELECT
                l.log_id,
                l.action,
                l.target_type,
                l.target_id,
                l.details,
                l.created_at,
                a.email AS actor_email,
                a.role AS actor_role
            FROM activity_logs l
            LEFT JOIN accounts a ON a.account_id = l.account_id
            ORDER BY l.created_at DESC
            LIMIT 200
        `);

        res.json({ success: true, logs: rows });
    } catch (err) {
        console.error("Get Activity Logs Error:", err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
};

/**
 * Blocks any request from an account that is currently suspended/banned/disabled.
 * Destroys the session immediately if found, and responds appropriately for
 * page loads vs API/AJAX calls.
 */
exports.checkAccountStatus = async (req, res, next) => {
    const accountId = req.session?.accountId;
    if (!accountId) return next(); // not logged in — let normal auth checks handle it

    try {
        const [[account]] = await pool.query(
            `SELECT status FROM accounts WHERE account_id = ?`,
            [accountId]
        );

        const blockedStatuses = ["suspended", "banned", "disabled"];

        if (account && blockedStatuses.includes(account.status)) {
            const reason = account.status;

            req.session.destroy(() => {
                const wantsJson = req.xhr || req.headers.accept?.includes("application/json");

                if (wantsJson) {
                    return res.status(403).json({
                        success: false,
                        blocked: true,
                        reason,
                        message: `Your account has been ${reason}.`
                    });
                }

                return res.redirect(`/auth/login?reason=${reason}`);
            });
            return; // don't call next() — request stops here
        }

        next();
    } catch (err) {
        console.error("Check Account Status Error:", err);
        next(); // fail open rather than locking everyone out on a DB hiccup
    }
};exports.getSessionStatus = async (req, res) => {
    const accountId = req.session?.accountId;

    if (!accountId) {
        return res.json({ active: false, status: "session_expired" });
    }

    try {
        const [[account]] = await pool.query(
            `SELECT status, current_session_id FROM accounts WHERE account_id = ?`,
            [accountId]
        );

        if (!account) {
            return res.json({ active: false, status: "session_expired" });
        }

        // SAS check
        if (account.current_session_id && account.current_session_id !== req.sessionID) {
            return res.json({
                active: false,
                status: "logged_in_elsewhere"
            });
        }

        const blockedStatuses = ["suspended", "banned", "disabled"];
        const blocked = blockedStatuses.includes(account.status);

        return res.json({
            active: !blocked,
            status: account.status,
            accountId: accountId          // ⭐ IDINAGDAG
        });
    } catch (err) {
        console.error("Get Session Status Error:", err);
        return res.json({ active: true });
    }
};
// ==========================================
// SUBMIT CONTACT MESSAGE (Public — walang kailangang login)
// POST /api/contact-messages
// ==========================================
exports.submitContactMessage = async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        const cleanName = (name || "").trim();
        const cleanEmail = (email || "").trim();
        const cleanMessage = (message || "").trim();
        const validSubjects = ["adoption", "donation", "account", "technical", "feedback", "other"];

        if (!cleanName) {
            return res.status(400).json({ success: false, message: "Full name is required." });
        }
        if (!cleanEmail || !validator.isEmail(cleanEmail)) {
            return res.status(400).json({ success: false, message: "Please enter a valid email address." });
        }
        if (!subject || !validSubjects.includes(subject)) {
            return res.status(400).json({ success: false, message: "Please select a subject." });
        }
        if (!cleanMessage || cleanMessage.length < 10) {
            return res.status(400).json({ success: false, message: "Message must be at least 10 characters." });
        }

        // Kunin ang account_id kung naka-login (opsyonal lang, hindi required)
        const accountId = req.session?.accountId || null;

        const [result] = await pool.query(
            `INSERT INTO contact_messages (account_id, full_name, email, subject_category, message, status)
             VALUES (?, ?, ?, ?, ?, 'pending')`,
            [accountId, cleanName, cleanEmail, subject, cleanMessage]
        );

        await notifyAllAdmins(
            "New Contact Message",
            `${cleanName} sent a message about "${subject}": "${cleanMessage.substring(0, 80)}${cleanMessage.length > 80 ? '...' : ''}"`,
            "contact_message_new",
            "/admin/contact-messages"
        );

        res.json({ success: true, message: "Thanks for reaching out! We'll get back to you soon." });
    } catch (err) {
        console.error("Submit Contact Message Error:", err);
        res.status(500).json({ success: false, message: "Something went wrong. Please try again later." });
    }
};