const pool = require('../config/db');
const bcrypt = require('bcrypt');

// Create School API
exports.createSchool = async (req, res) => {
    const { user_id, role } = req.user; // Extracted from JWT in authMiddleware
    if (role !== 'super_admin') {
        return res.status(403).json({ message: 'Unauthorized: Only Super Admin can create schools' });
    }

    const {
        school_name, school_code, board, medium, contact_number, email,
        address, city, state, pincode, website, dice_code, admin_password
    } = req.body;

    const client = await pool.connect();

    try {
        // Start a transaction
        await client.query('BEGIN');

        // Hash the admin password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(admin_password, salt);

        // Insert School
        const schoolResult = await client.query(
            `INSERT INTO schools (school_name, school_code, board, medium, contact_number, email, address, city, state, pincode, website, dice_code)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING school_code`,  

            [school_name, school_code, board, medium, contact_number, email, address, city, state, pincode, website, dice_code]
        );

        const schoolCode = schoolResult.rows[0].school_code; 

        // Insert School Admin with school_name as name
        await client.query(
            `INSERT INTO users (email, password, role, school_code, name)
             VALUES ($1, $2, 'school_admin', $3, $4)`,
            [email, hashedPassword, schoolCode, school_name]  
        );

        // Commit the transaction
        await client.query('COMMIT');

        res.status(201).json({ message: 'School and Admin Created Successfully', schoolCode });

    } catch (error) {
        // If there's an error, rollback the transaction
        await client.query('ROLLBACK');

        console.error(error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    } finally {
        // Release the client back to the pool
        client.release();
    }
};
exports.getAllSchools = async (req, res) => {
    const { role } = req.user; // Extract user role from JWT

    if (role !== "super_admin") {
        return res.status(403).json({ message: "Unauthorized: Only Super Admin can access this data" });
    }

    const client = await pool.connect();

    try {
        const query = `SELECT school_name, school_code, board, medium, contact_number, email, city, state, website FROM schools`;
        const result = await client.query(query);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "No schools found" });
        }

        res.status(200).json({ schools: result.rows });
    } catch (error) {
        console.error("Error fetching schools:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    } finally {
        client.release();
    }
};
