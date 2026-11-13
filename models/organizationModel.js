//SQL queries para sa Organization.
const pool = require('../config/database');

const Organization = {
    // Function para makuha ang buong profile gamit ang account_id galing session
    getProfileByAccountId: async (accountId) => {
        const query = `
            SELECT 
                a.email,
                organization_name, 
                contact_number, 
                organization_type, 
                address, 
                region,
                province,
                city, 
                barangay,
                zip_code,
                description,
                contact_person,
                profile_pic 
            FROM organizations o
            INNER JOIN accounts a
                ON a.account_id = o.account_id
            WHERE a.account_id = ? 
            LIMIT 1
        `;
        const [rows] = await pool.query(query, [accountId]);
        return rows[0]; // Ibabalik ang isang row ng data
    },

    // Get the current password for verification during change password
    getPasswordById: async (accountId) => {
        const query = `SELECT password_hash FROM accounts WHERE account_id = ? LIMIT 1`;
        const [rows] = await pool.query(query, [accountId]);
        console.log("Query result for accountId:", accountId, rows); 
        return rows[0] ? rows[0].password_hash : null;
    },

    //Update new password
    updatePassword: async (accountId, hashedNewPassword) => {
        const query = `UPDATE accounts SET password_hash = ? WHERE account_id = ?`;
        const [result] = await pool.query(query, [hashedNewPassword, accountId]);
        return result.affectedRows > 0;
    },

    // Bagong function para mag-update ng profile details at profile pic
    updateProfile: async (accountId, profileData) => {
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            const { organization_name, contact_number, contact_person, address, region, province, city, barangay, zip_code, description, profile_pic, email } = profileData;
            
            // Confirm that this account belongs to an organization.
            const [orgRows] = await connection.query(
                `SELECT account_id
                FROM organizations
                WHERE account_id = ?
                LIMIT 1
                FOR UPDATE`,
                [accountId]
            );

            if (orgRows.length === 0) {
                throw new Error("Organization not found.");
            }

            // Get the current account email.
            const [accounts] = await connection.query(
                `SELECT email
                FROM accounts
                WHERE account_id = ?
                LIMIT 1
                FOR UPDATE`,
                [accountId]
            );

            if (accounts.length === 0) {
                throw new Error("Account not found.");
            }

            const currentEmail = String(accounts[0].email || "")
                .trim()
                .toLowerCase();

            const newEmail = String(email || currentEmail)
                .trim()
                .toLowerCase();

            const emailChanged = newEmail !== currentEmail;

            // Check whether the new email is already registered to another account.
            if (emailChanged) {
                const [duplicates] = await connection.query(
                    `SELECT account_id
                    FROM accounts
                    WHERE LOWER(email) = LOWER(?)
                    AND account_id != ?
                    LIMIT 1`,
                    [newEmail, accountId]
                );

                if (duplicates.length > 0) {
                    throw new Error("EMAIL_ALREADY_EXISTS");
                }
            }

            // Require a valid, verified, unexpired OTP for email changes.
            if (emailChanged) {
                const [otpRows] = await connection.query(
                    `SELECT id
                    FROM profile_email_change_otps
                    WHERE account_id = ?
                    AND email = ?
                    AND verified_at IS NOT NULL
                    AND expires_at > NOW()
                    AND attempts < 5
                    ORDER BY id DESC
                    LIMIT 1
                    FOR UPDATE`,
                    [accountId, newEmail]
                );

                if (otpRows.length === 0) {
                    throw new Error("EMAIL_VERIFICATION_REQUIRED");
                }

                await connection.query(
                    `UPDATE accounts
                    SET email = ?
                    WHERE account_id = ?`,
                    [newEmail, accountId]
                );

                await connection.query(
                    `DELETE FROM profile_email_change_otps
                    WHERE account_id = ? AND email = ?`,
                    [accountId, newEmail]
                );
            }

            // Dynamic query: I-update lang ang profile_pic kung may bagong file na in-upload
            let query = `
                UPDATE organizations 
                SET 
                    organization_name = ?, 
                    contact_number = ?, 
                    contact_person = ?, 
                    address = ?, 
                    region = ?,
                    province = ?, 
                    city = ?, 
                    barangay = ?,
                    zip_code = ?,
                    description = ?
            `;
            
            const params = [organization_name, contact_number, contact_person, address, region, province, city, barangay, zip_code, description];

            if (profile_pic) {
                query += `, profile_pic = ? `;
                params.push(profile_pic);
            }

            query += ` WHERE account_id = ?`;
            params.push(accountId);

            const [result] = await pool.query(query, params);
            // return result.affectedRows > 0;

            await connection.commit();

            return emailChanged || result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            throw error;

        } finally {
            connection.release();
        }
    },

    // Tulong na function: kunin ang tunay na organizations.organization_id gamit ang account_id (galing session)
    getOrganizationIdByAccountId: async (accountId) => {
        const [rows] = await pool.query(
            `SELECT organization_id FROM organizations WHERE account_id = ? LIMIT 1`,
            [accountId]
        );
        if (!rows.length) {
            throw new Error("Organization not found for this account.");
        }
        return rows[0].organization_id;
    },

     // Kunin ang weekly availability ng organization; kung wala pang naka-set, i-seed ng defaults (Mon-Sat 8AM-6PM, Sunday closed)
     getAvailability: async (accountId) => {
        const organizationId = await Organization.getOrganizationIdByAccountId(accountId);

        const [rows] = await pool.query(
            `SELECT day_of_week, is_open, start_time, end_time FROM organization_availability WHERE organization_id = ? ORDER BY day_of_week`,
            [organizationId]
        );

        if (rows.length === 7) return rows;

        // Kulang o walang laman — gumawa ng default na 7 rows (Sun-Sat)
        const defaults = [];
        for (let day = 0; day <= 6; day++) {
            defaults.push({
                organization_id: organizationId,
                day_of_week: day,
                is_open: day === 0 ? 0 : 1, // Closed by default sa Sunday
                start_time: '08:00:00',
                end_time: '18:00:00'
            });
        }

        // I-insert ang defaults papunta sa DB para sa susunod na tawag
        for (const d of defaults) {
            await pool.query(
                `INSERT INTO organization_availability (organization_id, day_of_week, is_open, start_time, end_time) 
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE day_of_week = day_of_week`,
                [d.organization_id, d.day_of_week, d.is_open, d.start_time, d.end_time]
            );
        }

        const [seededRows] = await pool.query(
            `SELECT day_of_week, is_open, start_time, end_time FROM organization_availability WHERE organization_id = ? ORDER BY day_of_week`,
            [organizationId]
        );
        return seededRows;
    },

     // I-save ang bagong weekly availability (array ng 7 entries, isa per day)
     updateAvailability: async (accountId, days) => {
        const organizationId = await Organization.getOrganizationIdByAccountId(accountId);

        for (const d of days) {
            await pool.query(
                `INSERT INTO organization_availability (organization_id, day_of_week, is_open, start_time, end_time)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE 
                    is_open = VALUES(is_open),
                    start_time = VALUES(start_time),
                    end_time = VALUES(end_time)`,
                [organizationId, d.day_of_week, d.is_open ? 1 : 0, d.start_time, d.end_time]
            );
        }
        return true;
    },

     // Kunin ang weekly drop-off hours (para sa in-kind donations); kung wala pang naka-set, i-seed ng defaults
     getDropoffHours: async (accountId) => {
        const organizationId = await Organization.getOrganizationIdByAccountId(accountId);

        const [rows] = await pool.query(
            `SELECT day_of_week, is_open, start_time, end_time FROM organization_dropoff_hours WHERE organization_id = ? ORDER BY day_of_week`,
            [organizationId]
        );

        if (rows.length === 7) return rows;

        const defaults = [];
        for (let day = 0; day <= 6; day++) {
            defaults.push({
                organization_id: organizationId,
                day_of_week: day,
                is_open: day === 0 ? 0 : 1,
                start_time: '08:00:00',
                end_time: '18:00:00'
            });
        }

        for (const d of defaults) {
            await pool.query(
                `INSERT INTO organization_dropoff_hours (organization_id, day_of_week, is_open, start_time, end_time) 
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE day_of_week = day_of_week`,
                [d.organization_id, d.day_of_week, d.is_open, d.start_time, d.end_time]
            );
        }

        const [seededRows] = await pool.query(
            `SELECT day_of_week, is_open, start_time, end_time FROM organization_dropoff_hours WHERE organization_id = ? ORDER BY day_of_week`,
            [organizationId]
        );
        return seededRows;
    },

    // I-save ang bagong weekly drop-off hours (array ng 7 entries, isa per day)
    updateDropoffHours: async (accountId, days) => {
        const organizationId = await Organization.getOrganizationIdByAccountId(accountId);

        for (const d of days) {
            await pool.query(
                `INSERT INTO organization_dropoff_hours (organization_id, day_of_week, is_open, start_time, end_time)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE 
                    is_open = VALUES(is_open),
                    start_time = VALUES(start_time),
                    end_time = VALUES(end_time)`,
                [organizationId, d.day_of_week, d.is_open ? 1 : 0, d.start_time, d.end_time]
            );
        }
        return true;
    }
};

module.exports = Organization;