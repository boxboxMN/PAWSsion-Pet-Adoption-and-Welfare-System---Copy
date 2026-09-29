const pool = require("../config/database");
const { generateEmbedding } = require("../services/embeddingService");
const { logActivity } = require("./adminController");
const { createNotification, notifyAllAdmins } = require("./adminController");

// ==========================================
// PET MANAGEMENT CONTROLLERS
// ==========================================

// ==========================================
// RECYCLE BIN: Auto-purge pets na sobra na sa 30 araw
// ==========================================
async function purgeExpiredTrash(organizationId) {
    // Kunin muna ang mga animal_id na lalampas na sa 30-day window para malinis din ang kanilang medical history
    const [expired] = await pool.query(
        `SELECT animal_id FROM animals 
         WHERE organization_id = ? 
           AND deleted_at IS NOT NULL 
           AND deleted_at < (NOW() - INTERVAL 30 DAY)`,
        [organizationId]
    );

    if (!expired.length) return;

    const ids = expired.map(r => r.animal_id);

    await pool.query(
        `DELETE FROM animal_medical_history WHERE animal_id IN (?)`,
        [ids]
    );
    await pool.query(
        `DELETE FROM animals WHERE animal_id IN (?)`,
        [ids]
    );
}

exports.addPet = async (req, res) => {
    try {
        const {
            name,
            species,
            gender,
            age,
            pet_description,
            health_status,
            vaccination_status,
            adoption_status,
            medical_history
        } = req.body;

        if (!name || !species || !gender || !age) {
            return res.status(400).json({
                success: false,
                message: "Please fill out all required fields (Pet Name, Species, Gender, Age Group)."
            });
        }

        // ==========================================
        // GET LOGGED-IN ORGANIZATION
        // ==========================================

        const [org] = await pool.query(
            `
            SELECT organization_id
            FROM organizations
            WHERE account_id = ?
            `,
            [req.session.accountId]
        );

        console.log("Organization Query Result:", org);

        if (!org.length) {
            return res.status(404).json({
                success: false,
                message: "Organization not found"
            });
        }

        const organization_id = org[0].organization_id;

        // ==========================================
        // IMAGE
        // ==========================================

        let image_path = null;

        if (req.file) {
            image_path = req.file.filename;
        }

        // ==========================================
        // INSERT PET
        // ==========================================

        const [result] = await pool.query(
            `
            INSERT INTO animals
            (
                organization_id,
                name,
                species,
                gender,
                age,
                pet_description,
                health_status,
                vaccination_status,
                adoption_status,
                image_path
            )
            VALUES (?,?,?,?,?,?,?,?,?,?)
            `,
            [
                organization_id,
                name,
                species,
                gender,
                age,
                pet_description || null,
                health_status || "Healthy",
                vaccination_status || "Unknown",
                adoption_status || "Available",
                image_path
            ]
        );

        console.log("Insert Result:", result);

        const animal_id = result.insertId;

        // ==========================================
        // SAVE ADOPTER DETAILS IF ADOPTED
        // ==========================================

        if (adoption_status === "Adopted" && req.body.adopter_full_name) {

            const phPhoneRegex = /^09\d{9}$/;

            const contactNum = req.body.adopter_contact_number
                ? req.body.adopter_contact_number.trim()
                : "";

            const emergencyNum = req.body.adopter_emergency_phone
                ? req.body.adopter_emergency_phone.trim()
                : "";

            if (!phPhoneRegex.test(contactNum)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid Contact Number. It must be an 11-digit Philippine mobile number starting with 09."
                });
            }

            if (!phPhoneRegex.test(emergencyNum)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid Emergency Phone Number. It must be an 11-digit Philippine mobile number starting with 09."
                });
            }


            // Built snapshot object para sa direct admin entry
            const snapshotData = {
                full_name: req.body.adopter_full_name || null,
                contact_number: req.body.adopter_contact_number || null,
                email: req.body.adopter_email || null,
                full_address: req.body.adopter_full_address || null,
                civil_status: req.body.adopter_civil_status || null,
                age: req.body.adopter_age || null,
                occupation: req.body.adopter_occupation || null
            };

            await pool.query(
                `
                INSERT INTO user_adoption_applications
                (
                    adopter_id,
                    organization_id,
                    animal_id,
                    applicant_snapshot,
                    adoption_intent,
                    emergency_name,
                    emergency_phone,
                    emergency_relation,
                    document_path,
                    status,
                    created_at,
                    updated_at
                )
                VALUES (
                    NULL,
                    ?, ?, ?, ?,
                    ?, ?, ?,
                    NULL,
                    'Approved',
                    NOW(),
                    NOW()
                )
                `,
                [
                    organization_id,
                    animal_id,
                    JSON.stringify(snapshotData),
                    (req.body.adopter_adoption_intent && req.body.adopter_adoption_intent.trim() !== "") ? req.body.adopter_adoption_intent.trim() : null,
                    req.body.adopter_emergency_name || null,
                    req.body.adopter_emergency_phone || null,
                    req.body.adopter_emergency_relation || null
                ]
            );
        }
        // ==========================================
        // GENERATE EMBEDDING
        // ==========================================
        try {
            console.log("Generating embedding...");
            const embedding = await generateEmbedding(
                pet_description || ""
            );
            console.log("Embedding generated.");
            await pool.query(
                `
                INSERT INTO animal_embeddings
                (
                    animal_id,
                    embedding
                )
                VALUES (?, ?)
                `,
                [
                    animal_id,
                    JSON.stringify(embedding)
                ]
            );
            console.log("Embedding saved.");
        } catch (embedErr) {
            console.warn(
                "⚠️ Embedding service offline or skipped:",
                embedErr.message
            );
        }
        // ==========================================
        // MEDICAL HISTORY
        // ==========================================
        const medicalHistory = medical_history
            ? JSON.parse(medical_history)
            : [];
        for (const medical of medicalHistory) {
            await pool.query(
                `
                INSERT INTO animal_medical_history
                (
                    animal_id,
                    treatment,
                    administered_date,
                    administered_by
                )
                VALUES (?, ?, ?, ?)
                `,
                [
                    animal_id,
                    medical.treatment,
                    medical.administered_date,
                    medical.administered_by
                ]
            );
        }
        // ==========================================
        // SUCCESS
        // ==========================================
        //log activity
        await logActivity(req.session.accountId, "pet_created", "pet", animal_id, name);
        
        res.json({
            success: true,
            message: "Pet added successfully"
        });
    } catch (error) {
        console.error("========== PET INSERT ERROR ==========");
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message ||
                "Failed to add pet. Please make sure all required fields are complete."
        });
    }
};
// ==========================================
// GET PETS
// =========================================
exports.getPets = async (req, res) => {
    try {
        const [org] = await pool.query(
            `
            SELECT organization_id
            FROM organizations
            WHERE account_id = ?
            `,
            [req.session.accountId]
        );
        if (!org.length) {
            return res.json({
                success: false,
                message: "Organization not found"
            });
        }
        const organization_id = org[0].organization_id;

        // I-clear muna ang mga trash entries na sobra na sa 30 araw
        await purgeExpiredTrash(organization_id);

        const [pets] = await pool.query(
            `
            SELECT *
            FROM animals
            WHERE organization_id = ?
             AND deleted_at IS NULL
            ORDER BY animal_id DESC
            `,
            [organization_id]
        );
        res.json({
            success: true,
            pets
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: "Unable to load pets."
        });
    }
};

// ==========================================
// GET PET DETAILS
// ==========================================
exports.getPetDetails = async (req, res) => {
    try {
        const [org] = await pool.query(
            `
            SELECT organization_id
            FROM organizations
            WHERE account_id = ?
            `,
            [req.session.accountId]
        );

        if (!org.length) {
            return res.json({
                success: false,
                message: "Organization not found."
            });
        }

        const organization_id = org[0].organization_id;

        const [rows] = await pool.query(
            `
            SELECT *
            FROM animals
            WHERE animal_id = ?
              AND organization_id = ?
            `,
            [
                req.params.id,
                organization_id
            ]
        );
        if (!rows.length) {
            return res.json({
                success: false,
                message: "Pet not found or unauthorized access."
            });
        }
        // =========================================
        // MEDICAL HISTORY
        // ==========================================
        const [medical] = await pool.query(
            `
            SELECT
                medical_id,
                animal_id,
                treatment,
                DATE_FORMAT(
                    administered_date,
                    '%Y-%m-%d'
                ) AS administered_date,
                administered_by
            FROM animal_medical_history
            WHERE animal_id = ?
            ORDER BY administered_date DESC
            `,
            [req.params.id]
        );
        rows[0].medical_history = medical;
        res.json({
            success: true,
            pet: rows[0]
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};
// ==========================================
// UPDATE PET
// ==========================================
exports.updatePet = async (req, res) => {
    try {
        const id = req.params.id;
        const {
            name,
            species,
            gender,
            age,
            pet_description,
            health_status,
            vaccination_status,
            adoption_status,
            medical_history
        } = req.body;
        // ==========================================
        // GET LOGGED-IN ORGANIZATION
        // ==========================================
        const [organizations] = await pool.query(
            `
            SELECT organization_id
            FROM organizations
            WHERE account_id = ?
            `,
            [req.session.accountId]
        );
        if (!organizations.length) {
            return res.status(403).json({
                success: false,
                message: "Organization not found."
            });
        }
        const organizationId =
            organizations[0].organization_id;
        // ==========================================
        // UPDATE PET
        // ==========================================
        let updateSQL = `
            UPDATE animals
            SET
                name = ?,
                species = ?,
                gender = ?,
                age = ?,
                pet_description = ?,
                health_status = ?,
                vaccination_status = ?,
                adoption_status = ?
        `;
        const values = [
            name,
            species,
            gender,
            age,
            pet_description || null,
            health_status,
            vaccination_status,
            adoption_status
        ];
        // ==========================================
        // UPDATE IMAGE ONLY IF NEW IMAGE EXISTS
        // ==========================================
        if (req.file) {
            updateSQL += `,
                image_path = ?
            `;
            values.push(req.file.filename);
        }
        updateSQL += `
            WHERE animal_id = ?
              AND organization_id = ?
        `;
        values.push(id);
        values.push(organizationId);
        const [result] = await pool.query(
            updateSQL,
            values
        );
        // ==========================================
        // CHECK PET
        // ==========================================
        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Pet not found or does not belong to your organization."
            });
        }

         // ==========================================
        // SAVE ADOPTER DETAILS IF ADOPTED
        // ==========================================
        if (adoption_status === "Adopted" && req.body.adopter_full_name) {

            const phPhoneRegex = /^09\d{9}$/;

            const contactNum = req.body.adopter_contact_number
                ? req.body.adopter_contact_number.trim()
                : "";

            const emergencyNum = req.body.adopter_emergency_phone
                ? req.body.adopter_emergency_phone.trim()
                : "";

            if (!phPhoneRegex.test(contactNum)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid Contact Number. It must be an 11-digit Philippine mobile number starting with 09."
                });
            }

            if (!phPhoneRegex.test(emergencyNum)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid Emergency Phone Number. It must be an 11-digit Philippine mobile number starting with 09."
                });
            }

            const adoptionIntentValue = (req.body.adopter_adoption_intent && req.body.adopter_adoption_intent.trim() !== "") 
            ? req.body.adopter_adoption_intent.trim() 
            : null;

            // Check muna kung may existing manual application record na para sa pet na ito
            const [existingSnapshot] = await pool.query(
                `SELECT application_id FROM user_adoption_applications WHERE animal_id = ? AND adopter_id IS NULL LIMIT 1`,
                [id]
            );

            const snapshotData = {
                full_name: req.body.adopter_full_name || null,
                contact_number: req.body.adopter_contact_number || null,
                email: req.body.adopter_email || null,
                full_address: req.body.adopter_full_address || null,
                civil_status: req.body.adopter_civil_status || null,
                age: req.body.adopter_age || null,
                occupation: req.body.adopter_occupation || null
            };

            if (existingSnapshot.length) {
                // May existing manual record na — I-update na lang ito
                await pool.query(
                    `
                    UPDATE user_adoption_applications
                    SET
                        applicant_snapshot = ?,
                        adoption_intent = ?,
                        emergency_name = ?,
                        emergency_phone = ?,
                        emergency_relation = ?,
                        status = 'Approved',
                        updated_at = NOW()
                    WHERE application_id = ?
                    `,
                    [
                        JSON.stringify(snapshotData),
                        adoptionIntentValue,
                        req.body.adopter_emergency_name || null,
                        req.body.adopter_emergency_phone || null,
                        req.body.adopter_emergency_relation || null,
                        existingSnapshot[0].application_id
                    ]
                );
            } else {
                // Walang existing record — gumawa ng bago
                await pool.query(
                    `
                    INSERT INTO user_adoption_applications
                    (
                        adopter_id,
                        organization_id,
                        animal_id,
                        applicant_snapshot,
                        adoption_intent,
                        emergency_name,
                        emergency_phone,
                        emergency_relation,
                        document_path,
                        status,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        NULL,
                        ?, ?, ?, ?,
                        ?, ?, ?,
                        NULL,
                        'Approved',
                        NOW(),
                        NOW()
                    )
                    `,
                    [
                        organizationId,
                        id,
                        JSON.stringify(snapshotData),
                        adoptionIntentValue,
                        req.body.adopter_emergency_name || null,
                        req.body.adopter_emergency_phone || null,
                        req.body.adopter_emergency_relation || null
                    ]
                );
            }
        }

        // ==========================================
        // UPDATE EMBEDDING
        // ==========================================
        try {
            const { embedding } = await generateEmbedding(
                pet_description || ""
            );
            await pool.query(
                `
                INSERT INTO animal_embeddings
                (
                    animal_id,
                    embedding
                )
                VALUES (?, ?)

                ON DUPLICATE KEY UPDATE
                    embedding = VALUES(embedding),
                    updated_at = CURRENT_TIMESTAMP
                `,
                [
                    id,
                    JSON.stringify(embedding)
                ]
            );

        } catch (embedErr) {

            console.warn(
                "⚠️ Embedding service offline or skipped:",
                embedErr.message
            );
        }

        // ==========================================
        // UPDATE MEDICAL HISTORY
        // ==========================================

        const medical = medical_history
            ? JSON.parse(medical_history)
            : [];

        await pool.query(
            `
            DELETE FROM animal_medical_history
            WHERE animal_id = ?
            `,
            [id]
        );

        for (const m of medical) {
            await pool.query(
                `
                INSERT INTO animal_medical_history
                (
                    animal_id,
                    treatment,
                    administered_date,
                    administered_by
                )
                VALUES (?, ?, ?, ?)
                `,
                [
                    id,
                    m.treatment,
                    m.administered_date,
                    m.administered_by
                ]
            );
        }
        // ==========================================
        // SUCCESS
        // ==========================================
        await logActivity(req.session.accountId, "pet_updated", "pet", id);

        res.json({
            success: true,
            message: "Pet updated successfully."
        });

    } catch (err) {

        console.error("UPDATE PET ERROR:", err);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};
exports.deletePet = async (req, res) => {
    try {
        const { id } = req.params;

        // Get logged-in organization
        const [organizations] = await pool.query(
            "SELECT organization_id FROM organizations WHERE account_id = ?",
            [req.session.accountId]
        );

        if (!organizations.length) {
            return res.status(403).json({
                success: false,
                message: "Organization not found."
            });
        }

        const organizationId = organizations[0].organization_id;

        // Delete medical history
        // await pool.query(
        //     "DELETE FROM animal_medical_history WHERE animal_id = ?",
        //     [id]
        // );

        // // Delete pet (ensure ownership)
        // const [result] = await pool.query(
        //     "DELETE FROM animals WHERE animal_id = ? AND organization_id = ?",
        //     [id, organizationId]
        // );

        // if (result.affectedRows === 0) {
        //     return res.status(404).json({
        //         success: false,
        //         message: "Pet not found or does not belong to your organization."
        //     });
        // }

        // I-move sa Recycle Bin (soft delete) sa halip na tanggalin agad. 
        // Hindi na natin binabago ang animal_medical_history o adoption_status dito
        // para kumpleto pa rin ang record kapag na-restore.
        const [result] = await pool.query(
            `UPDATE animals 
             SET deleted_at = NOW() 
             WHERE animal_id = ? AND organization_id = ? AND deleted_at IS NULL`,
            [id, organizationId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Pet not found or does not belong to your organization."
            });
        }

        await logActivity(req.session.accountId, "pet_deleted", "pet", id);

        res.json({
            success: true,
            message: "Pet moved to Recycle Bin. You can restore it within 30 days."
        });

    } catch (err) {
        console.error("DELETE PET ERROR:", err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// ==========================================
// GET RECYCLE BIN (Deleted Pets)
// ==========================================
exports.getDeletedPets = async (req, res) => {
    try {
        const [org] = await pool.query(
            `SELECT organization_id FROM organizations WHERE account_id = ?`,
            [req.session.accountId]
        );

        if (!org.length) {
            return res.json({ success: false, message: "Organization not found" });
        }

        const organizationId = org[0].organization_id;

        // I-clear muna ang expired trash bago kunin ang listahan
        await purgeExpiredTrash(organizationId);

        const [pets] = await pool.query(
            `SELECT *, 
                    DATEDIFF((deleted_at + INTERVAL 30 DAY), NOW()) AS days_left
             FROM animals
             WHERE organization_id = ?
               AND deleted_at IS NOT NULL
             ORDER BY deleted_at DESC`,
            [organizationId]
        );

        res.json({ success: true, pets });
    } catch (err) {
        console.error("GET DELETED PETS ERROR:", err);
        res.status(500).json({ success: false, message: "Unable to load recycle bin." });
    }
};

// ==========================================
// RESTORE PET FROM RECYCLE BIN
// ==========================================
exports.restorePet = async (req, res) => {
    try {
        const { id } = req.params;

        const [org] = await pool.query(
            `SELECT organization_id FROM organizations WHERE account_id = ?`,
            [req.session.accountId]
        );

        if (!org.length) {
            return res.status(403).json({ success: false, message: "Organization not found." });
        }

        const organizationId = org[0].organization_id;

        const [result] = await pool.query(
            `UPDATE animals 
             SET deleted_at = NULL 
             WHERE animal_id = ? AND organization_id = ? AND deleted_at IS NOT NULL`,
            [id, organizationId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Pet not found in Recycle Bin or does not belong to your organization."
            });
        }

        res.json({ success: true, message: "Pet restored successfully." });
    } catch (err) {
        console.error("RESTORE PET ERROR:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ==========================================
// PERMANENTLY DELETE PET (Recycle Bin only)
// ==========================================
exports.permanentlyDeletePet = async (req, res) => {
    try {
        const { id } = req.params;

        const [org] = await pool.query(
            `SELECT organization_id FROM organizations WHERE account_id = ?`,
            [req.session.accountId]
        );

        if (!org.length) {
            return res.status(403).json({ success: false, message: "Organization not found." });
        }

        const organizationId = org[0].organization_id;

        // SAFETY: puwede lang i-permanent delete kung nasa Recycle Bin na talaga (may deleted_at)
        // Pinipigilan nito ang direct/skip-the-bin na pag-delete kahit sa direktang API call.
        const [pet] = await pool.query(
            `SELECT animal_id FROM animals 
             WHERE animal_id = ? AND organization_id = ? AND deleted_at IS NOT NULL`,
            [id, organizationId]
        );

        if (!pet.length) {
            return res.status(404).json({
                success: false,
                message: "Pet not found in Recycle Bin. Move it to the Recycle Bin first before permanent deletion."
            });
        }

        await pool.query(`DELETE FROM animal_medical_history WHERE animal_id = ?`, [id]);
        await pool.query(`DELETE FROM animals WHERE animal_id = ? AND organization_id = ?`, [id, organizationId]);

        res.json({ success: true, message: "Pet permanently deleted." });
    } catch (err) {
        console.error("PERMANENT DELETE PET ERROR:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getPaymentInfo = async (req, res) => {
    try {

        // =====================================================
        // CHECK SESSION
        // =====================================================

        if (
            !req.session ||
            !req.session.accountId
        ) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized access."
            });
        }

        // =====================================================
        // GET PAYMENT INFORMATION
        // =====================================================

        const [rows] = await pool.query(
            `
            SELECT
                o.organization_id,
                o.organization_name,
                o.contact_number,

                /* GCash */
                p.payment_id,
                p.gcash_name,
                p.gcash_number,
                p.qr_code,

                /* Maya */
                p.maya_name,
                p.maya_number,
                p.maya_qr_code,

                /* Active Payment Method */
                p.payment_method,

                /* In-Kind */
                d.dropoff_location_name,
                d.dropoff_address,
                d.dropoff_hours,
                d.dropoff_notes,
                d.dropoff_image

            FROM organizations o

            LEFT JOIN organization_payment_details p
                ON o.organization_id = p.organization_id

            LEFT JOIN organization_dropoff_details d
                ON o.organization_id = d.organization_id

            WHERE o.account_id = ?

            ORDER BY p.payment_id DESC

            LIMIT 1
            `,
            [
                req.session.accountId
            ]
        );

        // =====================================================
        // CHECK DATA
        // =====================================================

        if (!rows.length) {
            return res.status(404).json({
                success: false,
                message:
                    "Organization details not found."
            });
        }

        const orgData = rows[0];

        // =====================================================
        // NORMALIZE PAYMENT METHOD
        // =====================================================

        let paymentMethod =
            orgData.payment_method
                ? String(
                    orgData.payment_method
                ).toLowerCase().trim()
                : "";

        // Fallback for old records
        if (
            paymentMethod !== "maya" &&
            paymentMethod !== "gcash"
        ) {

            if (
                orgData.maya_name ||
                orgData.maya_number ||
                orgData.maya_qr_code
            ) {
                paymentMethod = "maya";
            } else {
                paymentMethod = "gcash";
            }
        }

        orgData.payment_method =
            paymentMethod;

        // =====================================================
        // FORMAT GCASH QR
        // =====================================================

        if (
            orgData.qr_code &&
            !orgData.qr_code.startsWith("/") &&
            !orgData.qr_code.startsWith("http")
        ) {
            orgData.qr_code =
                `/uploads/qr/${orgData.qr_code}`;
        }

        // =====================================================
        // FORMAT MAYA QR
        // =====================================================

        if (
            orgData.maya_qr_code &&
            !orgData.maya_qr_code.startsWith("/") &&
            !orgData.maya_qr_code.startsWith("http")
        ) {
            orgData.maya_qr_code =
                `/uploads/qr/${orgData.maya_qr_code}`;
        }

        // =====================================================
        // FORMAT DROP-OFF IMAGE
        // =====================================================

        if (
            orgData.dropoff_image &&
            !orgData.dropoff_image.startsWith("/") &&
            !orgData.dropoff_image.startsWith("http")
        ) {
            orgData.dropoff_image =
                `/uploads/qr/${orgData.dropoff_image}`;
        }

        // =====================================================
        // RESPONSE
        // =====================================================

        return res.json({
            success: true,
            data: orgData
        });

    } catch (err) {

        console.error(
            "Get Payment Info Error:",
            err
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to load payment details."
        });
    }
};


exports.updatePaymentInfo = async (req, res) => {
    try {

        // =====================================================
        // CHECK SESSION
        // =====================================================

        if (
            !req.session ||
            !req.session.accountId
        ) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized access."
            });
        }

        // =====================================================
        // GET FORM DATA
        // =====================================================

        const {
            gcash_name,
            gcash_number,

            maya_name,
            maya_number,

            contact_number,

            payment_method,

            // =================================================
            // IN-KIND
            // =================================================
            dropoff_location_name,
            dropoff_address,
            dropoff_hours,
            dropoff_notes,
            active_tab

        } = req.body;

        // =====================================================
        // NORMALIZE PAYMENT METHOD
        // =====================================================

        const selectedPaymentMethod =
            String(
                payment_method || "gcash"
            )
                .toLowerCase()
                .trim() === "maya"
                ? "maya"
                : "gcash";

        // =====================================================
        // GET ORGANIZATION
        // =====================================================

        const [org] = await pool.query(
            `
            SELECT organization_id
            FROM organizations
            WHERE account_id = ?
            LIMIT 1
            `,
            [
                req.session.accountId
            ]
        );

        if (!org.length) {
            return res.status(404).json({
                success: false,
                message: "Organization not found."
            });
        }

        const organization_id =
            org[0].organization_id;

        // =====================================================
        // UPDATE CONTACT NUMBER
        // =====================================================

        await pool.query(
            `
            UPDATE organizations
            SET contact_number = ?
            WHERE organization_id = ?
            `,
            [
                contact_number &&
                String(contact_number).trim()
                    ? String(contact_number).trim()
                    : null,

                organization_id
            ]
        );

        // =====================================================
        // GET EXISTING PAYMENT DATA
        // =====================================================

        const [existingRows] =
            await pool.query(
                `
                SELECT
                    payment_id,

                    gcash_name,
                    gcash_number,
                    qr_code,

                    maya_name,
                    maya_number,
                    maya_qr_code,

                    payment_method

                FROM organization_payment_details

                WHERE organization_id = ?

                ORDER BY payment_id DESC

                LIMIT 1
                `,
                [
                    organization_id
                ]
            );

        const existing =
            existingRows.length
                ? existingRows[0]
                : null;

        // =====================================================
        // GET EXISTING IN-KIND DATA
        // =====================================================

        const [existingDropoffRows] =
            await pool.query(
                `
                SELECT
                    dropoff_location_name,
                    dropoff_address,
                    dropoff_hours,
                    dropoff_notes,
                    dropoff_image

                FROM organization_dropoff_details

                WHERE organization_id = ?

                LIMIT 1
                `,
                [
                    organization_id
                ]
            );

        const existingDropoff =
            existingDropoffRows.length
                ? existingDropoffRows[0]
                : null;

        // =====================================================
        // FILES
        // =====================================================

        let gcashQrFile = null;
        let mayaQrFile = null;
        let dropoffImageFile = null;

        // =====================================================
        // GCASH QR
        // =====================================================

        if (
            req.files &&
            req.files["qr_code"] &&
            req.files["qr_code"].length
        ) {
            gcashQrFile =
                req.files["qr_code"][0].filename;
        }

        // =====================================================
        // MAYA QR
        // =====================================================

        if (
            req.files &&
            req.files["maya_qr_code"] &&
            req.files["maya_qr_code"].length
        ) {
            mayaQrFile =
                req.files["maya_qr_code"][0].filename;
        }

        // =====================================================
        // IN-KIND / LOCATION IMAGE
        // =====================================================

        if (
            req.files &&
            req.files["location_image"] &&
            req.files["location_image"].length
        ) {
            dropoffImageFile =
                req.files["location_image"][0].filename;
        }

        // =====================================================
        // NORMALIZE PAYMENT VALUES
        // =====================================================

        const submittedGcashName =
            gcash_name &&
            String(gcash_name).trim()
                ? String(gcash_name).trim()
                : null;

        const phMobileRegex = /^09\d{9}$/;

        const rawGcashNumber =
            gcash_number ? String(gcash_number).replace(/\D/g, "") : "";

        if (rawGcashNumber && !phMobileRegex.test(rawGcashNumber)) {
            return res.status(400).json({
                success: false,
                message: "Invalid GCash number. It must be exactly 11 digits and start with 09 (e.g., 09123456789)."
            });
        }

        const submittedGcashNumber =
            rawGcashNumber ? rawGcashNumber : null;

        const submittedMayaName =
            maya_name &&
            String(maya_name).trim()
                ? String(maya_name).trim()
                : null;

        const rawMayaNumber =
            maya_number ? String(maya_number).replace(/\D/g, "") : "";

        if (rawMayaNumber && !phMobileRegex.test(rawMayaNumber)) {
            return res.status(400).json({
                success: false,
                message: "Invalid Maya number. It must be exactly 11 digits and start with 09 (e.g., 09123456789)."
            });
        }

        const submittedMayaNumber =
            rawMayaNumber ? rawMayaNumber : null;

        // =====================================================
        // NORMALIZE IN-KIND VALUES
        // =====================================================

        const submittedDropoffLocationName =
            dropoff_location_name !== undefined
            ? String(dropoff_location_name).trim()
            : undefined;

        const submittedDropoffAddress =
            dropoff_address !== undefined
            ? String(dropoff_address).trim()
            : undefined;

        const submittedDropoffHours =
            dropoff_hours !== undefined
            ? String(dropoff_hours).trim()
            : undefined;

        const submittedDropoffNotes =
            dropoff_notes !== undefined
            ? String(dropoff_notes).trim()
            : undefined;

        // =====================================================
        // PREPARE PAYMENT VALUES
        // =====================================================

        let finalGcashName =
            existing
                ? existing.gcash_name
                : null;

        let finalGcashNumber =
            existing
                ? existing.gcash_number
                : null;

        let finalGcashQr =
            existing
                ? existing.qr_code
                : null;

        let finalMayaName =
            existing
                ? existing.maya_name
                : null;

        let finalMayaNumber =
            existing
                ? existing.maya_number
                : null;

        let finalMayaQr =
            existing
                ? existing.maya_qr_code
                : null;

        // =====================================================
        // SAVE GCASH
        // =====================================================

        if (
            selectedPaymentMethod === "gcash"
        ) {

            if (
                submittedGcashName !== null
            ) {
                finalGcashName =
                    submittedGcashName;
            }

            if (
                submittedGcashNumber !== null
            ) {
                finalGcashNumber =
                    submittedGcashNumber;
            }

            if (gcashQrFile) {
                finalGcashQr =
                    gcashQrFile;
            }
        }

        // =====================================================
        // SAVE MAYA
        // =====================================================

        if (
            selectedPaymentMethod === "maya"
        ) {

            if (
                submittedMayaName !== null
            ) {
                finalMayaName =
                    submittedMayaName;
            }

            if (
                submittedMayaNumber !== null
            ) {
                finalMayaNumber =
                    submittedMayaNumber;
            }

            if (mayaQrFile) {
                finalMayaQr =
                    mayaQrFile;
            }
        }

        // =====================================================
        // REQUIRE COMPLETE DETAILS FOR THE ACTIVE PAYMENT METHOD
        // =====================================================

        const missingFields = [];

        if (selectedPaymentMethod === "gcash") {
            if (!finalGcashName) missingFields.push("GCash Account Name");
            if (!finalGcashNumber) missingFields.push("GCash Number");
            if (!finalGcashQr) missingFields.push("GCash QR Code Image");
        } else {
            if (!finalMayaName) missingFields.push("Maya Account Name");
            if (!finalMayaNumber) missingFields.push("Maya Number");
            if (!finalMayaQr) missingFields.push("Maya QR Code Image");
        }

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Incomplete ${selectedPaymentMethod === "maya" ? "Maya" : "GCash"} details. Missing: ${missingFields.join(", ")}. All fields, including the QR code image, are required for your active payment method.`
            });
        }

        // =====================================================
        // INSERT / UPDATE PAYMENT DETAILS
        // =====================================================

        await pool.query(
            `
            INSERT INTO organization_payment_details
            (
                organization_id,

                gcash_name,
                gcash_number,
                qr_code,

                maya_name,
                maya_number,
                maya_qr_code,

                payment_method
            )

            VALUES
            (
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?
            )

            ON DUPLICATE KEY UPDATE

                gcash_name =
                    VALUES(gcash_name),

                gcash_number =
                    VALUES(gcash_number),

                qr_code =
                    VALUES(qr_code),

                maya_name =
                    VALUES(maya_name),

                maya_number =
                    VALUES(maya_number),

                maya_qr_code =
                    VALUES(maya_qr_code),

                payment_method =
                    VALUES(payment_method)
            `,
            [
                organization_id,

                finalGcashName,
                finalGcashNumber,
                finalGcashQr,

                finalMayaName,
                finalMayaNumber,
                finalMayaQr,

                selectedPaymentMethod
            ]
        );

        // =====================================================
        // PREPARE IN-KIND VALUES
        // =====================================================

        let finalDropoffLocationName =
            existingDropoff
                ? existingDropoff.dropoff_location_name
                : null;

        let finalDropoffAddress =
            existingDropoff
                ? existingDropoff.dropoff_address
                : null;

        let finalDropoffHours =
            existingDropoff
                ? existingDropoff.dropoff_hours
                : null;

        let finalDropoffNotes =
            existingDropoff
                ? existingDropoff.dropoff_notes
                : null;

        let finalDropoffImage =
            existingDropoff
                ? existingDropoff.dropoff_image
                : null;

        // =====================================================
        // UPDATE ONLY WHAT WAS SUBMITTED
        // =====================================================

        if (
            submittedDropoffLocationName !== undefined
        ) {
            finalDropoffLocationName =
                submittedDropoffLocationName;
        }

        if (
            submittedDropoffAddress !== undefined
        ) {
            finalDropoffAddress =
                submittedDropoffAddress;
        }

        if (
            submittedDropoffHours !== undefined
        ) {
            finalDropoffHours =
                submittedDropoffHours;
        }

        if (
            submittedDropoffNotes !== undefined
        ) {
            finalDropoffNotes =
                submittedDropoffNotes;
        }

        if (dropoffImageFile) {
            finalDropoffImage =
                dropoffImageFile;
        }

         // =====================================================
        // Kung may laman ang alinman sa In-Kind fields,
        // dapat kumpleto lahat maliban sa Notes
        // =====================================================

        const anyInkindProvided =
            !!finalDropoffLocationName ||
            !!finalDropoffAddress ||
            !!finalDropoffHours ||
            !!finalDropoffImage;

        if (active_tab === "inkind" && anyInkindProvided) {
            const missingInkind = [];
            if (!finalDropoffLocationName) missingInkind.push("Location Name");
            if (!finalDropoffAddress) missingInkind.push("Complete Address");
            if (!finalDropoffHours) missingInkind.push("Drop-Off Days & Hours");
            if (!finalDropoffImage) missingInkind.push("Drop-Off Location Photo");

            if (missingInkind.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `In-Kind Drop-Off setup is incomplete. Missing: ${missingInkind.join(", ")}.`
                });
            }
        }

        // =====================================================
        // SAVE IN-KIND / DROP-OFF DETAILS
        // =====================================================

        await pool.query(
            `
            INSERT INTO organization_dropoff_details
            (
                organization_id,
                dropoff_location_name,
                dropoff_address,
                dropoff_hours,
                dropoff_notes,
                dropoff_image
            )

            VALUES
            (
                ?,
                ?,
                ?,
                ?,
                ?,
                ?
            )

            ON DUPLICATE KEY UPDATE

                dropoff_location_name =
                    VALUES(dropoff_location_name),

                dropoff_address =
                    VALUES(dropoff_address),

                dropoff_hours =
                    VALUES(dropoff_hours),

                dropoff_notes =
                    VALUES(dropoff_notes),

                dropoff_image =
                    COALESCE(
                        VALUES(dropoff_image),
                        dropoff_image
                    ),

                updated_at =
                    CURRENT_TIMESTAMP
            `,
            [
                organization_id,
                finalDropoffLocationName,
                finalDropoffAddress,
                finalDropoffHours,
                finalDropoffNotes,
                finalDropoffImage
            ]
        );

        // =====================================================
        // SUCCESS
        // =====================================================

        return res.json({
            success: true,

            message:
                "Donation settings updated successfully!",

            payment_method:
                selectedPaymentMethod,

            data: {
                gcash_name:
                    finalGcashName,

                gcash_number:
                    finalGcashNumber,

                maya_name:
                    finalMayaName,

                maya_number:
                    finalMayaNumber,

                payment_method:
                    selectedPaymentMethod,

                dropoff_location_name:
                    finalDropoffLocationName,

                dropoff_address:
                    finalDropoffAddress,

                dropoff_hours:
                    finalDropoffHours,

                dropoff_notes:
                    finalDropoffNotes,

                dropoff_image:
                    finalDropoffImage
            }
        });

    } catch (err) {

        console.error(
            "Update Payment Info Error:",
            err
        );

        return res.status(500).json({
            success: false,

            message:
                "Server error: " +
                err.message
        });
    }
};
// ==========================================
// DONATION CONTROLLERS
// ==========================================

exports.getDonations = async (req, res) => {
    try {
        if (!req.session || !req.session.accountId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized access."
            });
        }

        // 1. Get organization_id using session account ID
        const [org] = await pool.query(
            `SELECT organization_id FROM organizations WHERE account_id = ?`,
            [req.session.accountId]
        );

        if (!org.length) {
            return res.status(404).json({
                success: false,
                message: "Organization not found."
            });
        }

        const organization_id = org[0].organization_id;

        // 2. Fetch all cash donations for this organization (Idinagdag ang payment_method)
        const [donations] = await pool.query(
            `
            SELECT 
                cash_donation_id,
                donor_name,
                donor_email,
                gcash_account_name,
                reference_number,
                amount,
                receipt_path,
                payment_method,
                status,
                created_at
            FROM cash_donations
            WHERE organization_id = ?
            ORDER BY created_at DESC
            `,
            [organization_id]
        );

        // 3. Calculate Total Approved Amount Metric
        const [totalMetric] = await pool.query(
            `
            SELECT COALESCE(SUM(amount), 0) AS total_amount 
            FROM cash_donations 
            WHERE organization_id = ? AND status = 'Approved'
            `,
            [organization_id]
        );

        res.json({
            success: true,
            totalDonations: totalMetric[0].total_amount,
            donations
        });

    } catch (err) {
        console.error("Get Donations Error:", err);
        res.status(500).json({
            success: false,
            message: "Unable to load donations list."
        });
    }
};

// ==========================================
// UPDATE DONATION STATUS & REASON
// ==========================================

exports.updateDonationStatus = async (req, res) => {
    try {
        if (!req.session || !req.session.accountId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized access. Please log in again."
            });
        }

        const donationId = req.params.id;
        const { status, reason } = req.body;

        // 1. Fetch organization ID using the logged-in session account_id
        const [orgs] = await pool.query(
            `SELECT organization_id FROM organizations WHERE account_id = ?`,
            [req.session.accountId]
        );

        if (!orgs || orgs.length === 0) {
            console.error(`No organization linked to account_id: ${req.session.accountId}`);
            return res.status(404).json({
                success: false,
                message: "Organization not found for this account."
            });
        }

        const organizationId = orgs[0].organization_id;

        // 2. Perform the update on cash_donations
        const [result] = await pool.query(
            `
            UPDATE cash_donations
            SET status = ?, rejection_reason = ?
            WHERE cash_donation_id = ? AND organization_id = ?
            `,
            [status, reason || null, donationId, organizationId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Donation record not found or does not belong to your organization."
            });
        }
        // 3. Fetch donor's account_id for notification
        const [[donorInfo]] = await pool.query(
            `SELECT adopter_id FROM cash_donations WHERE cash_donation_id = ?`,
            [donationId]
        );

        if (donorInfo) {
            await createNotification(
                donorInfo.account_id,
                "Donation Status Updated",
                `Your cash donation status is now "${status}".`,
                "donation_status",
                "/donation"
            );
        }
    
        await logActivity(req.session.accountId, "donation_status_updated", "cash_donation", donationId, `Status: ${status}`);

        return res.json({
            success: true,
            message: `Donation status updated to '${status}' successfully.`
        });

    } catch (err) {
        console.error("Update Donation Status Error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to update donation status: " + err.message
        });
    }
};

// ==========================================
// IN-KIND DONATION CONTROLLERS
// ==========================================

exports.addInKindDonation = async (req, res) => {
    try {
        if (!req.session || !req.session.accountId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized access. Please log in."
            });
        }

        const { donor_name, donor_email, item_type, item_description, quantity, estimated_value } = req.body;

        // 1. Kunin ang organization_id gamit ang logged-in account
        const [org] = await pool.query(
            `SELECT organization_id FROM organizations WHERE account_id = ?`,
            [req.session.accountId]
        );

        if (!org.length) {
            return res.status(404).json({
                success: false,
                message: "Organization not found."
            });
        }

        const organization_id = org[0].organization_id;

        // 2. Kunin ang proof of donation / receipt image kung may file upload
        let proof_path = req.file ? req.file.filename : null;

        // 3. I-save sa database
        const [result] = await pool.query(
            `
            INSERT INTO inkind_donations 
            (
                organization_id, 
                donor_name, 
                donor_email, 
                item_type, 
                item_description, 
                quantity, 
                estimated_value, 
                proof_path, 
                status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
            `,
            [
                organization_id,
                donor_name,
                donor_email || null,
                item_type,
                item_description || null,
                quantity || 1,
                estimated_value || null,
                proof_path
            ]
        );

        res.json({
            success: true,
            message: "In-kind donation saved successfully!",
            donationId: result.insertId
        });

    } catch (err) {
        console.error("Add In-Kind Donation Error:", err);
        res.status(500).json({
            success: false,
            message: "An unexpected error occurred while saving: " + err.message
        });
    }
};
exports.getInKindDonations = async (req, res) => {
    try {
        if (!req.session || !req.session.accountId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized access."
            });
        }

        const [org] = await pool.query(
            `SELECT organization_id FROM organizations WHERE account_id = ?`,
            [req.session.accountId]
        );

        if (!org.length) {
            return res.status(404).json({
                success: false,
                message: "Organization not found."
            });
        }

        const organization_id = org[0].organization_id;

        // 1. Fetch lahat ng in-kind donations para lumabas pa rin sa management table
        const [donations] = await pool.query(
            `
            SELECT * FROM inkind_donations
            WHERE organization_id = ?
            ORDER BY created_at DESC
            `,
            [organization_id]
        );

        // 2. APPROVED lang ang bibilangin (Hindi na kasama ang Pending at Rejected)
        const [countMetric] = await pool.query(
            `
            SELECT COUNT(*) AS total_inkind 
            FROM inkind_donations 
            WHERE organization_id = ? AND status = 'Approved'
            `,
            [organization_id]
        );

        res.json({
            success: true,
            totalInKind: countMetric[0].total_inkind,
            donations
        });

    } catch (err) {
        console.error("Get In-Kind Donations Error:", err);
        res.status(500).json({
            success: false,
            message: "Unable to load in-kind donations."
        });
    }
};

// ==========================================
// UPDATE IN-KIND DONATION STATUS
// ==========================================
exports.updateInKindDonationStatus = async (req, res) => {
    try {
        if (!req.session || !req.session.accountId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized access."
            });
        }

        const donationId = req.params.id;
        const { status, reason } = req.body;

        const [org] = await pool.query(
            `SELECT organization_id FROM organizations WHERE account_id = ?`,
            [req.session.accountId]
        );

        if (!org.length) {
            return res.status(404).json({
                success: false,
                message: "Organization not found."
            });
        }

        const organization_id = org[0].organization_id;

        const [result] = await pool.query(
            `
            UPDATE inkind_donations
            SET status = ?, rejection_reason = ?
            WHERE inkind_donation_id = ? AND organization_id = ?
            `,
            [status, reason || null, donationId, organization_id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "In-kind donation record not found."
            });
        }

        const [[donorInfo]] = await pool.query(
            `SELECT adopter_id FROM cash_donations WHERE cash_donation_id = ?`,
            [donationId]
        );
        if (donorInfo) {
            await createNotification(
                donorInfo.account_id,
                "Donation Status Updated",
                `Your cash donation status is now "${status}".`,
                "donation_status",
                "/donation"
            );
        }
        await logActivity(req.session.accountId, "donation_status_updated", "inkind_donation", donationId, `Status: ${status}`);

        res.json({
            success: true,
            message: `In-kind donation status updated to '${status}' successfully.`
        });

    } catch (err) {
        console.error("Update In-Kind Donation Status Error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to update in-kind donation status: " + err.message
        });
    }
};

// ==========================================
// DROPOFF DETAILS CONTROLLERS
// ==========================================

exports.getDropoffInfo = async (req, res) => {
    try {
        if (!req.session || !req.session.accountId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized access."
            });
        }

        const [org] = await pool.query(
            `SELECT organization_id FROM organizations WHERE account_id = ?`,
            [req.session.accountId]
        );

        if (!org.length) {
            return res.status(404).json({
                success: false,
                message: "Organization not found."
            });
        }

        const organization_id = org[0].organization_id;

        const [rows] = await pool.query(
            `SELECT * FROM organization_dropoff_details WHERE organization_id = ?`,
            [organization_id]
        );

        const dropoffData = rows[0] || {};

        // Format Dropoff Image URL kung mayroon
        if (dropoffData.dropoff_image && !dropoffData.dropoff_image.startsWith('/') && !dropoffData.dropoff_image.startsWith('http')) {
            dropoffData.dropoff_image = `/uploads/dropoff/${dropoffData.dropoff_image}`;
        }

        res.json({
            success: true,
            data: dropoffData
        });

    } catch (error) {
        console.error("Get Dropoff Error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch dropoff details." });
    }
};

exports.updateDropoffInfo = async (req, res) => {
    try {
        if (!req.session || !req.session.accountId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized access."
            });
        }

        const { dropoff_address, dropoff_hours, dropoff_notes } = req.body;

        const [org] = await pool.query(
            `SELECT organization_id FROM organizations WHERE account_id = ?`,
            [req.session.accountId]
        );

        if (!org.length) {
            return res.status(404).json({
                success: false,
                message: "Organization not found."
            });
        }

        const organization_id = org[0].organization_id;
        const dropoff_image = req.file ? req.file.filename : null;

        // Upsert sa organization_dropoff_details table
        await pool.query(
            `
            INSERT INTO organization_dropoff_details 
            (organization_id, dropoff_address, dropoff_hours, dropoff_notes, dropoff_image)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                dropoff_address = VALUES(dropoff_address),
                dropoff_hours = VALUES(dropoff_hours),
                dropoff_notes = VALUES(dropoff_notes),
                dropoff_image = COALESCE(VALUES(dropoff_image), dropoff_image)
            `,
            [
                organization_id,
                dropoff_address || null,
                dropoff_hours || null,
                dropoff_notes || null,
                dropoff_image
            ]
        );

        res.json({
            success: true,
            message: "Drop-off details updated successfully!"
        });

    } catch (error) {
        console.error("Update Dropoff Error:", error);
        res.status(500).json({ success: false, message: "Failed to update dropoff details." });
    }
};

// DASHBOARD STATS
exports.getDashboardStats = async (req, res) => {
    try {
        
        // CHECK LOGIN
        const accountId = req.session?.accountId;
        if (!accountId) {
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }

        // GET LOGGED-IN ORGANIZATION
        const [org] = await pool.query(
            `SELECT organization_id FROM organizations WHERE account_id = ? LIMIT 1`,
            [accountId]
        );
        if (!org.length) {
            return res.status(404).json({ success: false, message: "Organization not found." });
        }
        const organizationId = org[0].organization_id;

        // TOTAL PETS
        const [[petStats]] = await pool.query(
            `SELECT COUNT(*) AS totalPets FROM animals WHERE organization_id = ?`,
            [organizationId]
        );

        // PENDING ADOPTIONS
        const [[pendingStats]] = await pool.query(
            `
            SELECT COUNT(*) AS pendingAdoptions
            FROM user_adoption_applications app
            INNER JOIN animals animal ON app.animal_id = animal.animal_id
            WHERE animal.organization_id = ? AND app.status IN ('Under Review', 'Interview Scheduled')
            `,
            [organizationId]
        );

        // ADOPTED PETS
        const [[adoptedStats]] = await pool.query(
            `
            SELECT COUNT(DISTINCT app.animal_id) AS adoptedPets
            FROM user_adoption_applications app
            INNER JOIN animals animal ON app.animal_id = animal.animal_id
            WHERE animal.organization_id = ? AND app.status = 'Approved'
            `,
            [organizationId]
        );

        // CASH DONATIONS
        const [[cash]] = await pool.query(
            `SELECT IFNULL(SUM(amount), 0) AS cashTotal FROM cash_donations WHERE organization_id = ? AND status = 'Approved'`,
            [organizationId]
        );

        // IN-KIND DONATIONS
        const [[inkind]] = await pool.query(
            `SELECT COUNT(*) AS inkindTotal FROM inkind_donations WHERE organization_id = ? AND status = 'Approved'`,
            [organizationId]
        );

        // SEND DASHBOARD DATA
        res.json({
            success: true,
            stats: {
                totalPets: Number(petStats.totalPets || 0),
                pendingAdoptions: Number(pendingStats.pendingAdoptions || 0),
                adoptedPets: Number(adoptedStats.adoptedPets || 0),
                cashDonations: Number(cash.cashTotal || 0),
                inkindDonations: Number(inkind.inkindTotal || 0)
            }
        });

    } catch (err) {
        console.error("Dashboard stats error:", err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// RECENT ADOPTION APPLICATIONS
exports.getRecentApplications = async (req, res) => {
    try {
        // CHECK LOGIN
        const accountId = req.session?.accountId;

        if (!accountId) {
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }

        // GET LOGGED-IN ORGANIZATION
        const [org] = await pool.query(
            `SELECT organization_id FROM organizations WHERE account_id = ? LIMIT 1`,
            [accountId]
        );

        if (!org.length) {
            return res.status(404).json({ success: false, message: "Organization not found." });
        }

        const organizationId = org[0].organization_id;

        // GET RECENT APPLICATIONS
        const [applications] = await pool.query(
            `
            SELECT app.application_id, app.animal_id, app.adopter_id, app.applicant_snapshot, app.status, app.created_at, animal.name AS pet_name
            FROM user_adoption_applications app
            INNER JOIN animals animal ON app.animal_id = animal.animal_id
            WHERE animal.organization_id = ?
            ORDER BY app.created_at DESC
            LIMIT 4
            `,
            [organizationId]
        );

        // MAP FUNCTION: Parse JSON snapshot para mabasa ng Dashboard UI
        const formattedApplications = applications.map(app => {
            let snapshot = {};
            try {
                snapshot = typeof app.applicant_snapshot === 'string' 
                    ? JSON.parse(app.applicant_snapshot) 
                    : (app.applicant_snapshot || {});
            } catch (e) {
                console.error("JSON parse error:", e);
            }

            return {
                application_id: app.application_id,
                animal_id: app.animal_id,
                adopter_id: app.adopter_id,
                full_name: snapshot.full_name || 'N/A',
                email: snapshot.email || 'N/A',
                contact_number: snapshot.contact_number || 'N/A',
                status: app.status,
                created_at: app.created_at,
                pet_name: app.pet_name
            };
        });

        // ACTION REQUIRED
        const [[actionRequired]] = await pool.query(
            `
            SELECT COUNT(*) AS count
            FROM user_adoption_applications app
            INNER JOIN animals animal ON app.animal_id = animal.animal_id
            WHERE animal.organization_id = ? AND app.status IN ('Under Review', 'Interview Scheduled')
            `,
            [organizationId]
        );

        res.json({
            success: true,
            applications: formattedApplications,
            actionRequired: Number(actionRequired.count || 0)
        });

    } catch (err) {
        console.error("Recent applications error:", err);

        res.status(500).json({
            success: false,
            message: "Failed to load recent applications.",
            details: err.message
        });
    }
};
// =====================================================
// NEWLY ADDED PETS
// =====================================================
exports.getNewestPets = async (req, res) => {
    try {
        const [org] = await pool.query(
            `SELECT organization_id FROM organizations WHERE account_id = ?`,
            [req.session.accountId]
        );

        if (!org.length) {
            return res.json([]);
        }

        const organizationId = org[0].organization_id;

        const [pets] = await pool.query(
            `SELECT animal_id, name, species, age, image_path FROM animals WHERE organization_id = ? ORDER BY created_at DESC LIMIT 4`,
            [organizationId]
        );

        res.json(pets);

    } catch (err) {
        console.error(err);

        res.status(500).json({ error: "Failed to load newest pets." });
    }
};

// ORGANIZATION ANALYTICS
exports.getAnalyticsData = async (req, res) => {
    try {
        // =====================================================
        // CHECK LOGIN
        // =====================================================
        const accountId = req.session?.accountId;

        if (!accountId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized."
            });
        }

        // =====================================================
        // GET LOGGED-IN ORGANIZATION
        // =====================================================
        const [orgRows] = await pool.query(
            `
            SELECT
                organization_id,
                organization_name
            FROM organizations
            WHERE account_id = ?
            LIMIT 1
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
        const organizationName = orgRows[0].organization_name;

        // =====================================================
        // GET FILTER VALUES FIRST
        // =====================================================
        const period = ["day", "month", "year"].includes(req.query.period)
            ? req.query.period
            : "month";

        const requestedDate = req.query.date;

        // =====================================================
        // CREATE DATE RANGE
        // =====================================================
        let startDate;
        let endDate;
        let displayDate;

        if (period === "day") {
            // Expected: 2026-08-07
            const dateValue = requestedDate || new Date().toISOString().slice(0, 10);

            startDate = `${dateValue} 00:00:00`;

            const [year, month, day] = dateValue.split("-").map(Number);
            const nextDay = new Date(year, month - 1, day + 1);

            endDate =
                `${nextDay.getFullYear()}-` +
                `${String(nextDay.getMonth() + 1).padStart(2, "0")}-` +
                `${String(nextDay.getDate()).padStart(2, "0")} 00:00:00`;

            displayDate = dateValue;

        } else if (period === "year") {
            // Expected: 2026 or 2026-01-01
            const year = String(
                requestedDate || new Date().getFullYear()
            ).substring(0, 4);

            startDate = `${year}-01-01 00:00:00`;
            endDate = `${Number(year) + 1}-01-01 00:00:00`;

            displayDate = year;

        } else {
            // =================================================
            // MONTH
            // Expected: 2026-08
            // =================================================
            const monthValue =
                requestedDate ||
                new Date().toISOString().slice(0, 7);

            const [year, month] = monthValue
                .substring(0, 7)
                .split("-")
                .map(Number);

            startDate =
                `${year}-${String(month).padStart(2, "0")}-01 00:00:00`;

            const nextMonth = new Date(year, month, 1);

            endDate =
                `${nextMonth.getFullYear()}-` +
                `${String(nextMonth.getMonth() + 1).padStart(2, "0")}-` +
                `01 00:00:00`;

            displayDate =
                `${year}-${String(month).padStart(2, "0")}`;
        }

        // =====================================================
        // PET SUMMARY
        // CURRENT PET STATUS
        // Based on animals table
        // =====================================================
        const [[petSummary]] = await pool.query(
            `
            SELECT
                COUNT(*) AS totalPets,

                SUM(
                    CASE
                        WHEN adoption_status = 'Available'
                        THEN 1 ELSE 0
                    END
                ) AS availablePets,

                SUM(
                    CASE
                        WHEN adoption_status = 'Pending'
                        THEN 1 ELSE 0
                    END
                ) AS pendingPets,

                SUM(
                    CASE
                        WHEN adoption_status = 'Adopted'
                        THEN 1 ELSE 0
                    END
                ) AS adoptedPets,

                SUM(
                    CASE
                        WHEN adoption_status = 'Archived'
                        THEN 1 ELSE 0
                    END
                ) AS archivedPets

            FROM animals
            WHERE organization_id = ?
            `,
            [organizationId]
        );

        // =====================================================
        // AVAILABLE PETS BY SPECIES
        // Based on animals.species
        // =====================================================
        const [availablePetsBySpecies] = await pool.query(
            `
            SELECT
                species,
                COUNT(*) AS total
            FROM animals
            WHERE organization_id = ?
              AND adoption_status = 'Available'
            GROUP BY species
            ORDER BY species
            `,
            [organizationId]
        );

        // =====================================================
        // APPROVED ADOPTIONS
        // Based on:
        // user_adoption_applications.status = Approved
        // animals.organization_id
        // =====================================================
        let adoptionGroupFormat;

        if (period === "day") {
            adoptionGroupFormat = "%H:00";
        } else if (period === "year") {
            adoptionGroupFormat = "%Y-%m";
        } else {
            adoptionGroupFormat = "%Y-%m-%d";
        }

        const [adoptionChart] = await pool.query(
            `
            SELECT
                DATE_FORMAT(app.created_at, ?) AS label,
                COUNT(*) AS total
            FROM user_adoption_applications app

            INNER JOIN animals animal
                ON app.animal_id = animal.animal_id

            WHERE animal.organization_id = ?
              AND app.status = 'Approved'
              AND app.created_at >= ?
              AND app.created_at < ?

            GROUP BY label
            ORDER BY MIN(app.created_at)
            `,
            [
                adoptionGroupFormat,
                organizationId,
                startDate,
                endDate
            ]
        );

        // =====================================================
        // CASH DONATIONS
        // Based on:
        // cash_donations.status = Approved
        // cash_donations.amount
        // =====================================================
        let cashGroupFormat;

        if (period === "day") {
            cashGroupFormat = "%H:00";
        } else if (period === "year") {
            cashGroupFormat = "%Y-%m";
        } else {
            cashGroupFormat = "%Y-%m-%d";
        }

        const [[cashSummary]] = await pool.query(
            `
            SELECT
                COUNT(*) AS donationCount,
                COALESCE(SUM(amount), 0) AS totalAmount
            FROM cash_donations
            WHERE organization_id = ?
              AND status = 'Approved'
              AND created_at >= ?
              AND created_at < ?
            `,
            [
                organizationId,
                startDate,
                endDate
            ]
        );

        const [cashChart] = await pool.query(
            `
            SELECT
                DATE_FORMAT(created_at, ?) AS label,
                COALESCE(SUM(amount), 0) AS total
            FROM cash_donations
            WHERE organization_id = ?
              AND status = 'Approved'
              AND created_at >= ?
              AND created_at < ?
            GROUP BY label
            ORDER BY MIN(created_at)
            `,
            [
                cashGroupFormat,
                organizationId,
                startDate,
                endDate
            ]
        );

        // =====================================================
        // IN-KIND DONATIONS
        // Based on:
        // inkind_donations.status = Approved
        // inkind_donations.quantity
        // =====================================================
        const [[inKindSummary]] = await pool.query(
            `
            SELECT
                COUNT(*) AS donationRecords,
                COALESCE(SUM(quantity), 0) AS totalQuantity
            FROM inkind_donations
            WHERE organization_id = ?
              AND status = 'Approved'
              AND created_at >= ?
              AND created_at < ?
            `,
            [
                organizationId,
                startDate,
                endDate
            ]
        );

        const [inKindChart] = await pool.query(
            `
            SELECT
                DATE_FORMAT(created_at, ?) AS label,
                COALESCE(SUM(quantity), 0) AS quantity
            FROM inkind_donations
            WHERE organization_id = ?
              AND status = 'Approved'
              AND created_at >= ?
              AND created_at < ?
            GROUP BY label
            ORDER BY MIN(created_at)
            `,
            [
                cashGroupFormat,
                organizationId,
                startDate,
                endDate
            ]
        );

        // =====================================================
        // IN-KIND BY ITEM
        // =====================================================
        const [inKindItems] = await pool.query(
            `
            SELECT
                item_name AS label,
                SUM(quantity) AS quantity
            FROM inkind_donations
            WHERE organization_id = ?
              AND status = 'Approved'
              AND created_at >= ?
              AND created_at < ?
            GROUP BY item_name
            ORDER BY quantity DESC
            `,
            [
                organizationId,
                startDate,
                endDate
            ]
        );

        // =====================================================
        // FORMAT RESPONSE
        // =====================================================
        res.json({
            success: true,
            organization: {
                id: organizationId,
                name: organizationName
            },

            period: period,
            date: displayDate,
            range: {
                start: startDate,
                end: endDate
            },
            
            pets: {
                total: Number(petSummary.totalPets || 0),
                available: Number(petSummary.availablePets || 0),
                pending: Number(petSummary.pendingPets || 0),
                adopted: Number(petSummary.adoptedPets || 0),
                archived: Number(petSummary.archivedPets || 0)
            },
            availableBySpecies: availablePetsBySpecies.map(row => ({
                species: row.species,
                total: Number(row.total || 0)
            })),
            adoptions: {
                total: adoptionChart.reduce(
                    (sum, row) => sum + Number(row.total || 0),
                    0
                ),
                chart: adoptionChart.map(row => ({
                    label: row.label,
                    total: Number(row.total || 0)
                }))
            },
            cash: {
                total: Number(cashSummary.totalAmount || 0),
                count: Number(cashSummary.donationCount || 0),
                chart: cashChart.map(row => ({
                    label: row.label,
                    total: Number(row.total || 0)
                }))
            },
            inKind: {
                totalQuantity: Number(inKindSummary.totalQuantity || 0),
                records: Number(inKindSummary.donationRecords || 0),
                chart: inKindChart.map(row => ({
                    label: row.label,
                    quantity: Number(row.quantity || 0)
                })),
                items: inKindItems.map(row => ({
                    label: row.label,
                    quantity: Number(row.quantity || 0)
                }))
            }
        });

    } catch (err) {
        console.error("Analytics error:", err);

        res.status(500).json({
            success: false,
            message: "Failed to load analytics.",
            details: err.message
        });
    }
};

// ==========================================
// ARCHIVE / UNARCHIVE PET CONTROLLER
// ==========================================
exports.archivePet = async (req, res) => {
    try {
        const id = req.params.id;
        const { status, prevStatus} = req.body; // 'Archived' o 'Restore' / 'Available'[cite: 70]

        // 1. Check organization ownership
        const [org] = await pool.query(
            `SELECT organization_id FROM organizations WHERE account_id = ?`,
            [req.session.accountId]
        );

        if (!org.length) {
            return res.status(403).json({
                success: false,
                message: "Organization not found."
            });
        }

        const organizationId = org[0].organization_id;

        if (status === 'Archived') {
            // KAPAG I-AARCHIVE
            await pool.query(
                `UPDATE animals SET adoption_status = 'Archived' WHERE animal_id = ? AND organization_id = ?`,
                [id, organizationId]
            );

            await logActivity(req.session.accountId, "pet_archived", "pet", id);

            return res.json({
                success: true,
                message: "Pet has been archived successfully."
            });
        } else {
            // KAPAG I-UUNARCHIVE: Aalamin ang dating status mula sa applications table
            const [applications] = await pool.query(
                `SELECT status FROM user_adoption_applications 
                 WHERE animal_id = ? 
                 ORDER BY application_id DESC LIMIT 1`,
                [id]
            );

            let restoredStatus = prevStatus || 'Available';

            // Kung hindi naipasa o 'Archived' ang naipasa, tingnan sa applications table
            if (!prevStatus || prevStatus === 'Archived') {
                const [applications] = await pool.query(
                    `SELECT status FROM user_adoption_applications 
                     WHERE animal_id = ? 
                     ORDER BY application_id DESC LIMIT 1`,
                    [id]
                );

                if (applications.length > 0) {
                    const appStatus = (applications[0].status || '').toLowerCase();

                    // Kung may active application pa -> PENDING
                    if (appStatus.includes('review') || appStatus.includes('interview') || appStatus.includes('scheduled')) {
                        restoredStatus = 'Pending';
                    } else if (appStatus.includes('approved')) {
                        restoredStatus = 'Adopted';
                    }
                }
            }

            // I-UPDATE SA TOTOONG DATING STATUS (Pending o Available)
            await pool.query(
                `UPDATE animals SET adoption_status = ? WHERE animal_id = ? AND organization_id = ?`,
                [restoredStatus, id, organizationId]
            );

            return res.json({
                success: true,
                message: `Pet successfully restored with status: ${restoredStatus}.`
            });
        }

    } catch (err) {
        console.error("ARCHIVE PET ERROR:", err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// ==========================================
// GET APPLICATION ID BY ANIMAL ID
// ==========================================
exports.getApplicationByAnimalId = async (req, res) => {
    try {
        const animalId = req.params.animalId;
        const accountId = req.session?.accountId;

        if (!accountId) {
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }

        // Kunin ang organization_id
        const [org] = await pool.query(
            `SELECT organization_id FROM organizations WHERE account_id = ?`,
            [accountId]
        );

        if (!org.length) {
            return res.status(404).json({ success: false, message: "Organization not found." });
        }

        const organizationId = org[0].organization_id;

        // Kunin ang approved application ng animal na ito
        const [rows] = await pool.query(
            `
            SELECT app.application_id
            FROM user_adoption_applications app
            INNER JOIN animals a ON app.animal_id = a.animal_id
            WHERE app.animal_id = ? AND a.organization_id = ?
            ORDER BY app.application_id DESC
            LIMIT 1
            `,
            [animalId, organizationId]
        );

        if (!rows.length) {
            return res.status(404).json({
                success: false,
                message: "No adoption application found for this pet."
            });
        }

        res.json({
            success: true,
            application_id: rows[0].application_id
        });

    } catch (error) {
        console.error("Get Application By Animal Error:", error);
        res.status(500).json({ success: false, message: "Server error." });
    }
};
exports.getKamustahanUpdates = async (req, res) => {
    try {
        const [org] = await pool.query(
            `SELECT organization_id FROM organizations WHERE account_id = ?`,
            [req.session.accountId]
        );

        if (!org.length) {
            return res.status(404).json({ success: false, message: "Organization not found." });
        }

        const organization_id = org[0].organization_id;

        const [updates] = await pool.query(
            `
            SELECT 
                k.update_id,
                k.status AS update_status,
                k.scheduled_date,
                DATE_FORMAT(k.scheduled_date, '%b %d, %Y') AS formatted_scheduled_date,
                DATE_FORMAT(k.update_date, '%b %d, %Y') AS formatted_date,
                k.is_archived,
                k.update_text, -- <--- IDINAGDAG DITO PARA MA-FETCH ANG ADOPTER MESSAGE
                k.photos AS update_photos,
                p.name AS pet_name,
                p.species,
                p.image_path AS pet_image,
                CONCAT(a.first_name, ' ', a.last_name) AS adopter_name
            FROM kamustahan_updates k
            JOIN animals p ON k.animal_id = p.animal_id
            JOIN adopters a ON k.adopter_id = a.adopter_id
            WHERE k.organization_id = ?
            ORDER BY k.created_at DESC
            `,
            [organization_id]
        );

        res.json({ success: true, updates });
    } catch (err) {
        console.error("Get Kamustahan Updates Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.schedulePetUpdate = async (req, res) => {
    try {
        // ==========================================
        // VALIDATE INPUT
        // ==========================================
        const { update_id, scheduled_date } = req.body;

        if (!update_id || !scheduled_date) {
            return res.status(400).json({
                success: false,
                message: "Update ID and scheduled deadline date are required."
            });
        }

        // Validate date format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(String(scheduled_date).trim())) {
            return res.status(400).json({
                success: false,
                message: "Invalid date format. Please use YYYY-MM-DD."
            });
        }

        const parsedDate = new Date(`${scheduled_date}T00:00:00`);
        if (isNaN(parsedDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Invalid scheduled deadline date."
            });
        }

        // Bawal ang past date
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (parsedDate < today) {
            return res.status(400).json({
                success: false,
                message: "The deadline cannot be a past date."
            });
        }

        // ==========================================
        // VERIFY ORGANIZATION OWNERSHIP
        // ==========================================
        const [org] = await pool.query(
            `SELECT organization_id FROM organizations WHERE account_id = ?`,
            [req.session.accountId]
        );

        if (!org.length) {
            return res.status(403).json({
                success: false,
                message: "Organization not found."
            });
        }

        const organizationId = org[0].organization_id;

        // ==========================================
        // UPDATE (with ownership check)
        // ==========================================
        const [result] = await pool.query(
            `UPDATE kamustahan_updates 
             SET scheduled_date = ?, status = 'For Update' 
             WHERE update_id = ? AND organization_id = ?`,
            [scheduled_date, update_id, organizationId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Update record not found or does not belong to your organization."
            });
        }

        return res.json({
            success: true,
            message: `Deadline set to ${scheduled_date}. The adopter may submit anytime on or before this date.`
        });

    } catch (err) {
        console.error("Schedule Pet Update Error:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};
exports.archiveKamustahanUpdate = async (req, res) => {
    try {
        const { update_id } = req.body;

        // 1. Kunin ang current details ng update para masuri ang status[cite: 21]
        const [updateCheck] = await pool.query(
            `SELECT * FROM kamustahan_updates WHERE update_id = ?`,
            [update_id]
        );

        if (!updateCheck.length) {
            return res.status(404).json({ success: false, message: "Update record not found." });
        }

        const currentUpdate = updateCheck[0];

        // 2. I-check kung ang status ay 'For Update' pa o wala pang update_date (hindi pa na-update)[cite: 21]
        if (currentUpdate.status === 'For Update' || !currentUpdate.update_date) {
            return res.status(400).json({ 
                success: false, 
                message: "Hindi maaring i-archive ang update hangga't hindi pa ito nai-update ng adopter." 
            });
        }

        // 3. Kung na-update na, saka pa lamang i-archive[cite: 21]
        await pool.query(
            `UPDATE kamustahan_updates 
             SET is_archived = 1, status = 'Archived' 
             WHERE update_id = ?`,
            [update_id]
        );

        res.json({ success: true, message: "Matagumpay na na-archive ang update." });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.submitKamustahanUpdate = async (req, res) => {
    try {
        const { update_id, update_text } = req.body;
        
        // 1. Fetch the schedule details of the record
        const [updateRecord] = await pool.query(
            `SELECT scheduled_date, status FROM kamustahan_updates WHERE update_id = ?`,
            [update_id]
        );

        if (!updateRecord.length) {
            return res.status(404).json({ success: false, message: "Update record not found." });
        }

        const scheduledDate = new Date(updateRecord[0].scheduled_date);
        const currentDate = new Date();

        // 2. Set the day limit (Example: 7 days limit from the scheduled date to submit an update)
        const dayLimit = 7; 
        const diffTime = currentDate - scheduledDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > dayLimit) {
            return res.status(400).json({ 
                success: false, 
                message: `The ${dayLimit}-day limit to submit this update has already passed.` 
            });
        }

        // 3. Proceed to save if within the allowed limit
        // ... Your database update query here ...

        res.json({ success: true, message: "Update successfully submitted!" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};