const express = require("express");
const path = require("path");
const pool = require("../config/database");
const { uploadPet, uploadQR, uploadDropoff } = require('../config/upload');
// const { logActivity } = require("../controllers/adminController");
const { logActivity, createNotification } = require("../controllers/adminController");

// Controller functions
const { 
    addPet, 
    updatePet, 
    deletePet,
    archivePet, 
    getPets,
    getDeletedPets,
    restorePet,
    permanentlyDeletePet, 
    getPetDetails,
    getApplicationByAnimalId,
    getDonations, 
    getDashboardStats,
    getPaymentInfo,
    updateDonationStatus, 
    updatePaymentInfo,
    addInKindDonation, 
    getInKindDonations,
    updateInKindDonationStatus,
    getDropoffInfo,    
    updateDropoffInfo,
    getNewestPets,
    getRecentApplications,
    getAnalyticsData,
    getKamustahanUpdates,
    schedulePetUpdate,
    archiveKamustahanUpdate
} = require("../controllers/orgController");

const router = express.Router();

async function checkOrganizationApproval(req, res, next) {
    if (!req.session.accountId) {
        return res.redirect("/auth/login");
    }

    try {
        const [rows] = await pool.query(
            `SELECT status, role FROM accounts WHERE account_id = ?`,
            [req.session.accountId]
        );

        if (!rows.length || rows[0].role !== "organization") {
            // ✅ Redirect sa tamang dashboard base sa role
            if (req.session.role === "adopter") {
                return res.redirect("/dashboard");
            }
            if (req.session.role === "admin") {
                return res.redirect("/admin/dashboard");
            }
            return res.redirect("/auth/login");
        }

        if (rows[0].status === "pending") {
            if (req.path !== "/pending") {
                return res.redirect("/org/pending");
            }
        }
        next();
    } catch (error) {
        console.error("Middleware Approval Check Error:", error);
        res.status(500).send("Server Error");
    }
}

router.use(checkOrganizationApproval);

// 1. UNANG ROUTE: /pending
router.get("/pending", (req, res) => {
    if (!req.session.accountId) {
        return res.redirect("/auth/login");
    }
    res.sendFile(
        path.join(__dirname, "../public/organization/orgPending.html")
    );
});

router.get("/dashboard/stats", getDashboardStats);
router.get("/dashboard/recent-applications", getRecentApplications);
router.get("/pets/newest", getNewestPets);
router.get("/analytics/data", getAnalyticsData);
router.get("/kamustahan-updates", getKamustahanUpdates);

router.post('/kamustahan-schedule', schedulePetUpdate);
router.post('/kamustahan-archive', archiveKamustahanUpdate);

// 3. PAGES ROUTES
router.get("/dashboard", (req, res) => {
    res.sendFile(
        path.join(__dirname, "../public/organization/dashboard.html")
    );
});

router.get("/pets", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/organization/pets.html"));
});

router.get("/adoption", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/organization/adoption.html"));
});

router.get("/donation", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/organization/donation.html"));
});

router.get("/kamustahan", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/organization/kamustahan.html"));
});

router.get("/analytics", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/organization/analytics.html"));
});

router.get("/settings", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/organization/settings.html"));
});

router.get("/support", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/organization/support.html"));
});

router.get("/profile", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/organization/profile.html"));
});

// 4. PET & DONATION API ROUTES
router.post("/pets/add", uploadPet.single("image"), addPet);
router.put("/pets/update/:id", uploadPet.single("image"), updatePet);
router.delete("/pets/delete/:id", deletePet);
router.get("/pets/list", getPets);
router.get("/pets/trash", getDeletedPets);
router.post("/pets/restore/:id", restorePet);
router.delete("/pets/permanent/:id", permanentlyDeletePet);
router.get("/pets/:id", getPetDetails);
// Corrected donations route (serves GET /org/donations)
router.get("/donations", getDonations);
// 5. PAYMENT & QR ROUTES
router.get(
    "/payment-info",
    getPaymentInfo
);

router.post(
    "/payment-info",
    uploadQR.fields([
        {
            name: "qr_code",
            maxCount: 1
        },
        {
            name: "maya_qr_code",
            maxCount: 1
        },
        {
            name: "location_image",
            maxCount: 1
        }
    ]),
    updatePaymentInfo
);
router.put("/donations/:id/status", updateDonationStatus);
// In-Kind Donations Routes
router.get("/donations/in-kind", getInKindDonations);
router.post("/donations/in-kind", uploadQR.single("proof"), addInKindDonation);
router.put("/donations/in-kind/:id/status", updateInKindDonationStatus);
// POST: Save or Update Drop-off Details
router.post("/dropoff-info", uploadDropoff.single("dropoff_image"), async (req, res) => {
  try {
    const organizationId = req.session.accountId;
    const { 
      dropoff_location_name, 
      dropoff_address, 
      dropoff_hours, 
      dropoff_notes 
    } = req.body;

    const dropoff_image = req.file ? `/uploads/${req.file.filename}` : null;

    const query = `
      INSERT INTO organization_dropoff_details 
        (organization_id, dropoff_location_name, dropoff_address, dropoff_hours, dropoff_notes, dropoff_image)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        dropoff_location_name = VALUES(dropoff_location_name),
        dropoff_address = VALUES(dropoff_address),
        dropoff_hours = VALUES(dropoff_hours),
        dropoff_notes = VALUES(dropoff_notes),
        dropoff_image = COALESCE(VALUES(dropoff_image), dropoff_image),
        updated_at = CURRENT_TIMESTAMP
    `;

    await db.execute(query, [
      organizationId,
      dropoff_location_name || null,
      dropoff_address,
      dropoff_hours || null,
      dropoff_notes || null,
      dropoff_image
    ]);

    res.json({ success: true, message: "Settings saved successfully!" });
  } catch (error) {
    console.error("Database save error:", error);
    res.status(500).json({ success: false, error: "Failed to save settings." });
  }
});

// GET: Fetch Drop-off Details
router.get("/dropoff-info", async (req, res) => {
  try {
    const organizationId = req.session.accountId;
    const [rows] = await db.execute(
      "SELECT * FROM organization_dropoff_details WHERE organization_id = ? LIMIT 1",
      [organizationId]
    );

    res.json({ success: true, data: rows[0] || null });
  } catch (error) {
    console.error("Database fetch error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch settings." });
  }
});
// GET Single Application Details Endpoint (Protected by Organization)
router.get('/applications/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const accountId = req.session?.accountId;

        if (!accountId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        // Kunin ang organization_id ng naka-login na account
        const [orgRows] = await pool.query(
            `SELECT organization_id FROM organizations WHERE account_id = ?`,
            [accountId]
        );

        if (!orgRows.length) {
            return res.status(404).json({ message: "Organization not found" });
        }

        const orgId = orgRows[0].organization_id;

        const query = `
        SELECT 
            app.application_id,
            app.animal_id,
            app.adopter_id,
            app.applicant_snapshot,
            app.adoption_intent,
            app.emergency_name,
            app.emergency_phone,
            app.emergency_relation,
            app.document_path,
            app.status,
            app.decline_reason,
            CASE WHEN app.status = 'Under Review' THEN NULL ELSE i.interview_date END AS interview_date,
            CASE WHEN app.status = 'Under Review' THEN NULL ELSE i.interview_time END AS interview_time,
            CASE WHEN app.status = 'Under Review' THEN NULL ELSE i.interview_method END AS interview_method,
            CASE WHEN app.status = 'Under Review' THEN NULL ELSE i.interview_location_link END AS interview_location_link,
            CASE WHEN app.status = 'Under Review' THEN NULL ELSE i.meetup_location END AS meetup_location,
            CASE WHEN app.status = 'Under Review' THEN NULL ELSE i.requested_interview_date END AS requested_interview_date,
            CASE WHEN app.status = 'Under Review' THEN NULL ELSE i.requested_interview_time END AS requested_interview_time,
            CASE WHEN app.status = 'Under Review' THEN NULL ELSE i.reschedule_reason END AS reschedule_reason,
            CASE WHEN app.status = 'Under Review' THEN NULL ELSE i.resched_status END AS resched_status,
            CASE WHEN app.status = 'Under Review' THEN 0 ELSE COALESCE(i.org_reschedule_count, 0) END AS org_reschedule_count,
            DATE_FORMAT(app.created_at, '%b %d, %Y • %h:%i %p') AS applied_date,
            p.name AS pet_name
            FROM user_adoption_applications app
            INNER JOIN animals p ON app.animal_id = p.animal_id
            LEFT JOIN application_interviews i 
                ON i.application_id = app.application_id
                AND i.interview_id = (
                    SELECT MAX(i2.interview_id) 
                    FROM application_interviews i2 
                    WHERE i2.application_id = app.application_id
                )
            WHERE app.application_id = ? AND p.organization_id = ?
    `;
    
    const [rows] = await pool.query(query, [id, orgId]);
    
    if (!rows || rows.length === 0) {
        return res.status(404).json({ message: "Application not found or unauthorized access." });
    }

    const appData = rows[0];

    // Safely parse JSON applicant_snapshot
    let snapshot = {};
    try {
        snapshot = typeof appData.applicant_snapshot === 'string'
            ? JSON.parse(appData.applicant_snapshot)
            : (appData.applicant_snapshot || {});
    } catch (e) {
        console.error("JSON parse error:", e);
    }

    // Merge parsed snapshot details with the main response object
    const responseData = {
        ...appData,
        full_name: snapshot.full_name || 'N/A',
        contact_number: snapshot.contact_number || 'N/A',
        email: snapshot.email || 'N/A',
        full_address: snapshot.full_address || 'N/A',
        civil_status: snapshot.civil_status || 'N/A',
        age: snapshot.age || 'N/A',
        occupation: snapshot.occupation || 'N/A'
    };
    
    res.json(responseData);

    } catch (err) {
        console.error("❌ SQL Error:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// PATCH Update Application Status (Decline, Approve, Schedule Interview)
router.patch('/applications/:id/status', async (req, res) => {
    // Gumamit ng connection mula sa pool para sa Transaction
    const connection = await pool.getConnection();

    try {
        const { id } = req.params;
        const { status, decline_reason, meetup_location } = req.body;

        const validStatuses = ['Under Review', 'Interview Scheduled', 'Approved', 'Declined'];

        if (!status || !validStatuses.includes(status)) {
            connection.release();
            return res.status(400).json({ 
                success: false,
                message: `Invalid status selected. Allowed: ${validStatuses.join(', ')}` 
            });
        }

        // BAGONG VALIDATION: Siguraduhing may laman ang decline reason kapag 'Declined'
        if (status === 'Declined' && (!decline_reason || decline_reason.trim() === '')) {
            connection.release();
            return res.status(400).json({
                success: false,
                message: "A decline reason is required when declining an application."
            });
        }

        // VALIDATION: Siguraduhing may laman ang meet-up location kapag 'Approved'
        if (status === 'Approved' && (!meetup_location || meetup_location.trim() === '')) {
            connection.release();
            return res.status(400).json({
                success: false,
                message: "A meet-up location is required when approving an application."
            });
        }

        await connection.beginTransaction();

        // Get the animal_id of the pet from the application 
        const [appRows] = await connection.query(
            `SELECT animal_id FROM user_adoption_applications WHERE application_id = ?`,
            [id]
        );

        if (appRows.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({ 
                success: false, 
                message: "Application not found." 
            });
        }

        const animalId = appRows[0].animal_id;
        const reasonValue = (status === 'Declined') ? (decline_reason || null) : null;

        // Update Application Status
        const updateQuery = `
            UPDATE user_adoption_applications 
            SET 
                status = ?, 
                decline_reason = ?, 
                updated_at = NOW() 
            WHERE application_id = ?
        `;

        const [result] = await connection.query(updateQuery, [status, reasonValue, id]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({ 
                success: false, 
                message: "No changes were saved." 
            });
        }

        // If approved, change the status of the pet from "animals" table, and matanggal sa Adoption Hub
        if (status === 'Approved') {
            // I-save ang meet-up location sa application_interviews (may existing row na dapat
            // dahil kinakailangan munang mag-interview bago maka-approve)
            await connection.query(
                `UPDATE application_interviews 
                 SET meetup_location = ? 
                 WHERE application_id = ? 
                 ORDER BY application_id DESC 
                 LIMIT 1`,
                [meetup_location.trim(), id]
            );

            await connection.query(
                `UPDATE animals SET adoption_status = 'Adopted' WHERE animal_id = ?`,
                [animalId]
            );

            await connection.query(`
                INSERT INTO kamustahan_updates (organization_id, animal_id, adopter_id, status, created_at)
                SELECT p.organization_id, app.animal_id, app.adopter_id, 'For Update', NOW()
                FROM user_adoption_applications app
                JOIN animals p ON app.animal_id = p.animal_id
                WHERE app.application_id = ?
                ON DUPLICATE KEY UPDATE status = 'For Update'
            `, [id]);

            // =========================================================================
            // BAGONG DAGDAG: Automatic na i-decline ang ibang aplikante para sa parehong pet
            // =========================================================================
            const [declineResult] = await connection.query(`
                UPDATE user_adoption_applications app
                JOIN animals a ON app.animal_id = a.animal_id
                SET 
                    app.status = 'Declined', 
                    app.decline_reason = 'The pet has already been adopted by another applicant.', 
                    app.updated_at = NOW() 
                WHERE a.name = (SELECT name FROM animals WHERE animal_id = ?)
                  AND app.application_id != ? 
                  AND app.status IN ('Under Review', 'Interview Scheduled')
            `, [animalId, id]);

            console.log(`💡 Automatic Decline Executed: ${declineResult.affectedRows} other application(s) for the same pet name were declined.`);
        }

        // save the changes in the db
        await connection.commit();
        connection.release();

        await logActivity(
            req.session?.accountId,
            status === "Approved" ? "application_approved" : status === "Declined" ? "application_declined" : "application_status_updated",
            "application",
            id,
            status === "Declined" ? decline_reason : null
        );

        const [[applicantAccount]] = await pool.query(
            `SELECT acc.account_id
             FROM user_adoption_applications app
             JOIN adopters ad ON app.adopter_id = ad.adopter_id
             JOIN accounts acc ON ad.account_id = acc.account_id
             WHERE app.application_id = ?`,
            [id]
        );

        if (applicantAccount) {
            await createNotification(
                applicantAccount.account_id,
                status === "Approved" ? "Application Approved!" : status === "Declined" ? "Application Declined" : "Application Status Updated",
                status === "Declined"
                    ? `Your application was declined. ${decline_reason || ""}`.trim()
                    : `Your application status is now "${status}".`,
                "application_status",
                "/application"
            );
        }

        res.json({
            success: true,
            message: `Application status successfully updated to "${status}".`,
            status: status
        });

   } catch (err) {
    console.error("========================================");
    console.error("❌ FINISH INTERVIEW / STATUS UPDATE ERROR");
    console.error("Message:", err.message);
    console.error("Code:", err.code);
    console.error("Errno:", err.errno);
    console.error("SQL State:", err.sqlState);
    console.error("SQL Message:", err.sqlMessage);
    console.error("Stack:", err.stack);
    console.error("========================================");

    try {
        await connection.rollback();
    } catch (rollbackError) {
        console.error("Rollback Error:", rollbackError);
    }

    connection.release();

    return res.status(500).json({  
        success: false,  
        message: "Failed to update application status due to a database error.", 
        details: err.message  
    }); 
}
});

// POST: Save/Schedule Interview
router.post('/applications/:id/schedule', async (req, res) => {
    try {
        const { id } = req.params;
        let { interview_date, interview_time, interview_method, interview_location_link, override_reason } = req.body;

        if (!interview_date || !interview_time) {
            return res.status(400).json({ success: false, error: "Interview date and time are required." });
        }

      
        const selectedDateTime = new Date(`${interview_date}T${interview_time}:00`);
        const now = new Date();

        if (selectedDateTime <= now) {
            return res.status(400).json({ 
                success: false, 
                error: "Invalid schedule. You cannot set an interview date and time in the past." 
            });
        }

        // Siguraduhing lowercase 'virtual' o 'onsite' para tumugma sa ENUM ng interview_method
        const cleanMethod = (interview_method && interview_method.toLowerCase() === 'onsite') ? 'onsite' : 'virtual';
        const urlCheckRegex = /https?:\/\/|www\./i;
        
       
        if (cleanMethod === 'onsite') {
            if (urlCheckRegex.test(interview_location_link)) {
                return res.status(400).json({
                    success: false,
                    error: "On-site interviews cannot accept links or URLs as a venue address."
                });
            }
        } else {
            const gmeetRegex = /^https?:\/\/(www\.)?meet\.google\.com\/[a-z0-9]{3,4}-[a-z0-9]{3,4}-[a-z0-9]{3,4}(\?.*)?$/i;
            if (!gmeetRegex.test(interview_location_link)) {
                return res.status(400).json({
                    success: false,
                    error: "Virtual interviews require a valid Google Meet link."
                });
            }
        }

        // =========================================================================
        // Reschedule limit check (server-side source of truth)
        // =========================================================================
        const [existingRows] = await pool.query(
            `SELECT interview_date, org_reschedule_count 
             FROM application_interviews 
             WHERE application_id = ? 
             ORDER BY interview_id DESC 
             LIMIT 1`,
            [id]
        );

        const existing = existingRows[0] || null;
        const isReschedule = !!(existing && existing.interview_date); // may existing schedule na = reschedule ito, hindi first-time
        const currentCount = existing ? (existing.org_reschedule_count || 0) : 0;

        if (isReschedule && currentCount >= 3 && !(override_reason && override_reason.trim())) {
            return res.status(409).json({
                success: false,
                code: 'RESCHEDULE_LIMIT_EXCEEDED',
                reschedule_count: currentCount,
                message: `This application has already been rescheduled ${currentCount} times. Please state why you need to reschedule again.`
            });
        }
        
        // 1. Update main application status
        await pool.query(
            `UPDATE user_adoption_applications SET status = 'Interview Scheduled', updated_at = NOW() WHERE application_id = ?`,
            [id]
        );

        // 2. Upsert (Insert or Update) into application_interviews
        //    org_reschedule_count += 1 lang kapag reschedule ito (may existing schedule na dati)
        const scheduleQuery = `
            INSERT INTO application_interviews 
                (application_id, interview_date, interview_time, interview_method, interview_location_link, resched_status, org_reschedule_count)
            VALUES (?, ?, ?, ?, ?, 'Approved', 0)
            ON DUPLICATE KEY UPDATE 
                interview_date = VALUES(interview_date),
                interview_time = VALUES(interview_time),
                interview_method = VALUES(interview_method),
                interview_location_link = VALUES(interview_location_link),
                resched_status = 'Approved',
                org_reschedule_count = org_reschedule_count + ?
        `;

        await pool.query(scheduleQuery, [
            id,
            interview_date,
            interview_time,
            cleanMethod,
            interview_location_link,
            isReschedule ? 1 : 0
        ]);

        await logActivity(
            req.session?.accountId,
            isReschedule ? "interview_rescheduled" : "interview_scheduled",
            "interview",
            req.params.id,
            `${interview_date} ${interview_time}`
        );

        const [[interviewApplicant]] = await pool.query(
            `SELECT acc.account_id
             FROM user_adoption_applications app
             JOIN adopters ad ON app.adopter_id = ad.adopter_id
             JOIN accounts acc ON ad.account_id = acc.account_id
             WHERE app.application_id = ?`,
            [id]
        );

        if (interviewApplicant) {
            await createNotification(
                interviewApplicant.account_id,
                isReschedule ? "Interview Rescheduled" : "Interview Scheduled",
                `Your interview is set for ${interview_date} at ${interview_time}.`,
                isReschedule ? "interview_rescheduled" : "interview_scheduled",
                "/application"
            );
        }

        return res.json({ success: true, message: "Interview scheduled!" });
    } catch (err) {
        console.error("❌ Schedule Error:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

//para magconnect kapag pinagclick ang action sa adoption to org_app-details
router.get("/adoption-details", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/organization/org_application-details.html"));
});

// APPROVE RESCHEDULE REQUEST
router.patch('/applications/:id/approve-reschedule', async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Kunin ang requested date at time
        const [rows] = await pool.query(
            `SELECT requested_interview_date, requested_interview_time FROM application_interviews WHERE application_id = ?`,
            [id]
        );

        if (!rows.length || !rows[0].requested_interview_date) {
            return res.status(400).json({ success: false, message: "No reschedule request found." });
        }

        const reqDate = rows[0].requested_interview_date;
        const reqTime = rows[0].requested_interview_time;

        // 2. I-update ang main interview_date at interview_time tapos i-clear ang request columns
        await pool.query(
            `UPDATE application_interviews 
             SET 
                 interview_date = ?, 
                 interview_time = ?, 
                 resched_status = 'Approved',
                 updated_at = NOW()
             WHERE application_id = ?`,
            [reqDate, reqTime, id]
        );

        await logActivity(req.session?.accountId, "reschedule_request_approved", "interview", req.params.id);

        const [[approvedApplicant]] = await pool.query(
            `SELECT acc.account_id
             FROM user_adoption_applications app
             JOIN adopters ad ON app.adopter_id = ad.adopter_id
             JOIN accounts acc ON ad.account_id = acc.account_id
             WHERE app.application_id = ?`,
            [id]
        );

        if (approvedApplicant) {
            await createNotification(
                approvedApplicant.account_id,
                "Reschedule Approved",
                `Your requested interview time on ${reqDate} at ${reqTime} has been confirmed.`,
                "interview_rescheduled",
                "/application"
            );
        }

        res.json({ success: true, message: "Interview schedule updated to the requested time!" });
    } catch (err) {
        console.error("Approve Reschedule Error:", err);
        res.status(500).json({ success: false, message: "Server error." });
    }
});

// REJECT RESCHEDULE REQUEST
router.patch('/applications/:id/reject-reschedule', async (req, res) => {
    try {
        const { id } = req.params;

        await pool.query(
            `UPDATE application_interviews 
             SET 
                 requested_interview_date = NULL, 
                 requested_interview_time = NULL, 
                 reschedule_reason = NULL, 
                 resched_status = 'Rejected',
                 updated_at = NOW()
             WHERE application_id = ?`,
            [id]
        );
        await logActivity(req.session?.accountId, "reschedule_request_rejected", "interview", req.params.id);

        const [[rejectedApplicant]] = await pool.query(
            `SELECT acc.account_id
             FROM user_adoption_applications app
             JOIN adopters ad ON app.adopter_id = ad.adopter_id
             JOIN accounts acc ON ad.account_id = acc.account_id
             WHERE app.application_id = ?`,
            [id]
        );

        if (rejectedApplicant) {
            await createNotification(
                rejectedApplicant.account_id,
                "Reschedule Request Declined",
                "Your requested interview time was not approved. Your original schedule remains in place.",
                "interview_rescheduled",
                "/application"
            );
        }

        res.json({ success: true, message: "Reschedule request rejected. Original schedule kept." });
    } catch (err) {
        console.error("Reject Reschedule Error:", err);
        res.status(500).json({ success: false, message: "Server error." });
    }
});

// Export Applications Summary API
router.get("/applications/export/summary", async (req, res) => {
    try {
        const accountId = req.session?.accountId;
        if (!accountId) {
            return res.status(401).json({ error: "Unauthorized access." });
        }

        const [orgRows] = await pool.query(
            `SELECT organization_id FROM organizations WHERE account_id = ?`,
            [accountId]
        );

        if (!orgRows.length) {
            return res.status(404).json({ error: "Organization not found." });
        }

        const orgId = orgRows[0].organization_id;

        const query = `
            SELECT 
                app.application_id,
                app.applicant_snapshot,
                p.name AS pet_name,
                p.species AS pet_species,
                app.status,
                DATE_FORMAT(app.created_at, '%Y-%m-%d %h:%i %p') AS applied_at
            FROM user_adoption_applications app
            INNER JOIN animals p ON app.animal_id = p.animal_id
            WHERE p.organization_id = ?
            ORDER BY app.created_at DESC;
        `;

        const [rows] = await pool.query(query, [orgId]);

        // Construct CSV
        let csv = "Application ID,Applicant Name,Email,Contact Number,Pet Name,Species,Status,Applied At\n";
        rows.forEach(r => {
            let snapshot = {};
            try {
                snapshot = typeof r.applicant_snapshot === 'string'
                    ? JSON.parse(r.applicant_snapshot)
                    : (r.applicant_snapshot || {});
            } catch (e) {
                console.error("CSV JSON parse error:", e);
            }

            const name = snapshot.full_name || 'N/A';
            const email = snapshot.email || 'N/A';
            const contact = snapshot.contact_number || 'N/A';

            csv += `"${r.application_id}","${name}","${email}","${contact}","${r.pet_name}","${r.pet_species}","${r.status}","${r.applied_at}"\n`;
        });

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename=Adoption_Summary_${Date.now()}.csv`);
        return res.status(200).send("\uFEFF" + csv);

    } catch (error) {
        console.error("Export Error:", error);
        res.status(500).json({ error: "Failed to generate export." });
    }
});

// Add Archive Route
router.patch("/pets/archive/:id", archivePet);

router.get("/pets/:animalId/application", getApplicationByAnimalId);
router.get('/donations/export', async (req, res) => {
    try {
        const format = req.query.format; // excel or pdf
        const type = req.query.type;     // month or year
        const date = req.query.date;     // 2026-08 or 2026
        const tab = req.query.tab || 'cash'; // 'cash' o 'inkind'

        // --------------------------------------------
        // CHECK LOGIN
        // --------------------------------------------
        const accountId = req.session?.accountId;

        if (!accountId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Please login first."
            });
        }

        // --------------------------------------------
        // GET ORGANIZATION INFO
        // --------------------------------------------
        const [orgRows] = await pool.query(
            `
            SELECT organization_id
            FROM organizations
            WHERE account_id = ?
            `,
            [accountId]
        );

        if (!orgRows.length) {
            return res.status(404).json({
                success: false,
                message: "Organization not found."
            });
        }

        const organizationId = orgRows[0].organization_id;
        const organizationName = "PAWSSION Organization";

        // --------------------------------------------
        // BUILD QUERY DYNAMICALLY BASED ON TAB
        // --------------------------------------------
        let query = "";
        const queryParams = [organizationId];

        if (tab === 'inkind') {
            query = `
                SELECT
                    inkind_donation_id AS donation_id,
                    donor_name,
                    item_name,
                    quantity,
                    unit,
                    'In-Kind' AS donation_type,
                    status,
                    created_at
                FROM inkind_donations
                WHERE organization_id = ?
                  AND status = 'Approved'
            `;
        } else {
            query = `
                SELECT
                    cash_donation_id AS donation_id,
                    donor_name,
                    amount,
                    'Cash' AS donation_type,
                    status,
                    created_at
                FROM cash_donations
                WHERE organization_id = ?
                  AND status = 'Approved'
            `;
        }

        // --------------------------------------------
        // DATE FILTER
        // --------------------------------------------
        if (type === 'month' && date) {
            query += ` AND DATE_FORMAT(created_at, '%Y-%m') = ? `;
            queryParams.push(date);
        } else if (type === 'year' && date) {
            query += ` AND YEAR(created_at) = ? `;
            queryParams.push(date);
        }

        query += ` ORDER BY created_at DESC `;

        // --------------------------------------------
        // GET DATA
        // --------------------------------------------
        const [rows] = await pool.query(query, queryParams);

        if (!rows.length) {
            return res.status(404).json({
                success: false,
                message: `No verified/approved ${tab} donations found for the selected period.`
            });
        }

        // ============================================
        // EXCEL / CSV EXPORT (Professional Structured)
        // ============================================
        if (format === 'excel') {
            let csv = "";
            
            csv += `"${organizationName} - Verified ${tab === 'inkind' ? 'In-Kind' : 'Cash'} Donations Report"\n`;
            csv += `"Period: ${date || 'All-Time'} | Generated: ${new Date().toLocaleDateString()}"\n\n`;

            if (tab === 'inkind') {
                csv += "Donation ID,Donor Name,Item Name,Quantity,Unit,Type,Status,Date\n";
            } else {
                csv += "Donation ID,Donor Name,Amount (PHP),Type,Status,Date\n";
            }

            const escapeCSV = (value) => {
                return `"${String(value ?? '').replace(/"/g, '""')}"`;
            };

            rows.forEach(row => {
                const formattedDate = row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : '';
                if (tab === 'inkind') {
                    csv += [
                        escapeCSV(row.donation_id),
                        escapeCSV(row.donor_name),
                        escapeCSV(row.item_name),
                        escapeCSV(row.quantity),
                        escapeCSV(row.unit),
                        escapeCSV(row.donation_type),
                        escapeCSV(row.status),
                        escapeCSV(formattedDate)
                    ].join(',') + '\n';
                } else {
                    csv += [
                        escapeCSV(row.donation_id),
                        escapeCSV(row.donor_name),
                        escapeCSV(Number(row.amount || 0).toFixed(2)),
                        escapeCSV(row.donation_type),
                        escapeCSV(row.status),
                        escapeCSV(formattedDate)
                    ].join(',') + '\n';
                }
            });

            res.setHeader("Content-Type", "text/csv; charset=utf-8");
            res.setHeader("Content-Disposition", `attachment; filename="${tab}_donations_report_${date || 'all'}.csv"`);
            return res.status(200).send("\uFEFF" + csv);
        }

        // ============================================
        // PDF EXPORT (Professional Layout with PDFKit)
        // ============================================
        if (format === 'pdf') {
            let PDFDocument;

            try {
                PDFDocument = require('pdfkit');
            } catch (pdfError) {
                return res.status(500).json({
                    success: false,
                    message: "PDF export package missing. Run: npm install pdfkit"
                });
            }

            const doc = new PDFDocument({ margin: 36, size: 'A4' });
            const filename = `${tab}_donations_report_${date || 'all'}.pdf`;

            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
            doc.pipe(res);

            // --- PROFESSIONAL PDF HEADER ---
            doc.fontSize(16).font('Helvetica-Bold').fillColor('#1E293B').text(organizationName, { align: 'center' });
            doc.moveDown(0.2);
            doc.fontSize(12).font('Helvetica-Bold').fillColor('#475569').text(`Verified ${tab === 'inkind' ? 'In-Kind' : 'Cash'} Donations Summary Report`, { align: 'center' });
            doc.moveDown(0.2);
            doc.fontSize(9).font('Helvetica').fillColor('#64748B').text(`Period: ${date || 'All-Time'}  |  Status: Approved  |  Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
            doc.moveDown(1);

            // Divider Line
            doc.strokeColor('#CBD5E1').lineWidth(1).moveTo(36, doc.y).lineTo(559, doc.y).stroke();
            doc.moveDown(1);

            // --- TABLE CONFIGURATION ---
            let y = doc.y;
            const drawTableHeaders = () => {
                doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(8);
                if (tab === 'inkind') {
                    doc.text('ID', 36, y, { width: 30 });
                    doc.text('Donor Name', 70, y, { width: 110 });
                    doc.text('Item Name', 185, y, { width: 110 });
                    doc.text('Qty / Unit', 300, y, { width: 70 });
                    doc.text('Type', 375, y, { width: 55 });
                    doc.text('Status', 435, y, { width: 55 });
                    doc.text('Date', 495, y, { width: 64 });
                } else {
                    doc.text('ID', 36, y, { width: 35 });
                    doc.text('Donor Name', 85, y, { width: 140 });
                    doc.text('Amount (PHP)', 240, y, { width: 90 });
                    doc.text('Type', 345, y, { width: 60 });
                    doc.text('Status', 420, y, { width: 65 });
                    doc.text('Date', 495, y, { width: 64 });
                }
                
                doc.strokeColor('#94A3B8').lineWidth(0.8).moveTo(36, y + 12).lineTo(559, y + 12).stroke();
                y += 18;
            };

            drawTableHeaders();

            // --- TABLE ROWS ---
            doc.font('Helvetica').fontSize(8).fillColor('#334155');
            let totalAmountOrItems = 0;

            rows.forEach((row) => {
                if (y > 740) {
                    doc.addPage();
                    y = 40;
                    drawTableHeaders();
                    doc.font('Helvetica').fontSize(8).fillColor('#334155');
                }

                const donationId = String(row.donation_id ?? '');
                const donorName = String(row.donor_name ?? 'Anonymous');
                const donationType = String(row.donation_type ?? '');
                const status = String(row.status ?? '');
                const createdAt = row.created_at ? new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '';

                if (tab === 'inkind') {
                    const itemName = String(row.item_name ?? '');
                    const qtyUnit = `${row.quantity ?? 0} ${row.unit ?? ''}`;

                    doc.text(donationId, 36, y, { width: 30 });
                    doc.text(donorName, 70, y, { width: 110, lineBreak: false });
                    doc.text(itemName, 185, y, { width: 110, lineBreak: false });
                    doc.text(qtyUnit, 300, y, { width: 70 });
                    doc.text(donationType, 375, y, { width: 55 });
                    doc.text(status, 435, y, { width: 55 });
                    doc.text(createdAt, 495, y, { width: 64 });
                } else {
                    const amountVal = Number(row.amount || 0);
                    totalAmountOrItems += amountVal;
                    const formattedAmount = `PHP ${amountVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

                    doc.text(donationId, 36, y, { width: 35 });
                    doc.text(donorName, 85, y, { width: 140, lineBreak: false });
                    doc.text(formattedAmount, 240, y, { width: 90 });
                    doc.text(donationType, 345, y, { width: 60 });
                    doc.text(status, 420, y, { width: 65 });
                    doc.text(createdAt, 495, y, { width: 64 });
                }

                y += 20;
            });

            // --- FOOTER / SUMMARY SECTION ---
            doc.moveDown(1);
            if (y > 720) { doc.addPage(); y = 50; }
            
            doc.strokeColor('#CBD5E1').lineWidth(1).moveTo(36, y).lineTo(559, y).stroke();
            y += 10;

            doc.font('Helvetica-Bold').fontSize(9).fillColor('#0F172A');
            doc.text(`Total Records: ${rows.length}`, 36, y);

            if (tab === 'cash') {
                doc.text(`Total Cash Accumulated: PHP ${totalAmountOrItems.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 300, y, { align: 'right', width: 259 });
            }

            doc.end();
            return;
        }

        return res.status(400).json({ success: false, message: "Invalid export format selected." });

    } catch (error) {
        console.error("❌ Professional Donation Export Error:", error);
        return res.status(500).json({ success: false, message: "Failed to generate professional export.", details: error.message });
    }
});

// Palitan ang 'upload.single' ng 'uploadDropoff.single' 
// Siguraduhin na ang string na ipapasa ('donation_image') ay tugma sa pangalan ng input field sa FormData sa frontend.
router.post('/donation-settings/inkind', uploadDropoff.single('donation_image'), async (req, res) => {
    try {
        const locationName = req.body.location_name;
        // Kunin ang file path kung merong in-upload na bagong image
        const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

        let query = "UPDATE inkind_settings SET location_name = ?";
        let params = [locationName];

        if (imagePath) {
            query += ", image_path = ?";
            params.push(imagePath);
        }
        
        query += " WHERE id = 1"; // o kung anomang identifier ng settings niyo

        // Ginamit na natin ang 'pool' na promise-based sa halip na 'db' na gumagamit ng callback
        const [result] = await pool.query(query, params);

        if (result.affectedRows === 0) {
           return res.status(404).json({ success: false, message: 'Settings record not found' });
        }

        res.json({ success: true, message: 'Saved successfully!' });

    } catch (error) { 
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});
module.exports = router;