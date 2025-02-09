const pool = require('../config/db');

// Function to create class
exports.createClass = async (req, res) => {
    const { user_id, role, school_code: userSchoolCode } = req.user; // Extract from JWT
    const { session_id, name, promote_to, school_code } = req.body;

    const finalSchoolCode = role === 'super_admin' ? school_code : userSchoolCode;

    if (!finalSchoolCode) {
        return res.status(403).json({ message: 'Unauthorized: School code required for class creation' });
    }

    const client = await pool.connect();
    try {
        // Insert class data
        const result = await client.query(
            `INSERT INTO classes (school_code, session_id, name, promote_to)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [finalSchoolCode, session_id, name, promote_to]
        );

        res.status(201).json({ message: 'Class created successfully', class: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    } finally {
        client.release();
    }
};

exports.getClasses = async (req, res) => {
    const { role, school_code: userSchoolCode } = req.user; // Extract school_code from JWT
    const { session_id } = req.body; // Extract session_id from the request body

    // Get school_code from JWT for school admins or from request query for super admins
    const finalSchoolCode = role === 'super_admin' ? req.query.school_code : userSchoolCode;

    if (!finalSchoolCode || !session_id) {
        return res.status(403).json({ message: 'Unauthorized: School code and session ID required to fetch classes' });
    }

    const client = await pool.connect();
    try {
        // Query to get all classes for the specific school and session
        const result = await client.query(
            `SELECT id, session_id, name, promote_to 
             FROM classes 
             WHERE school_code = $1 AND session_id = $2`,
            [finalSchoolCode, session_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'No classes found for this school in the given session' });
        }

        res.status(200).json({ classes: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    } finally {
        client.release();
    }
};
