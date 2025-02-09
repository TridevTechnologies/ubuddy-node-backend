const pool = require('../config/db');

exports.createClass = async (req, res) => {
    const { school_code } = req.user; // Directly use school_code from JWT
    const { session_id, name, promote_to } = req.body;

    // Validate required fields
    if (!session_id || !name) {
        return res.status(400).json({ 
            message: 'Missing required fields: session_id and name' 
        });
    }

    const client = await pool.connect();
    try {
        // Verify session exists
        const sessionCheck = await client.query(
            'SELECT id FROM sessions WHERE id = $1 ',
            [session_id]
        );
        
        if (sessionCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Session not found' });
        }

        // Create class
        const result = await client.query(
            `INSERT INTO classes (school_code, session_id, name, promote_to)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [school_code, session_id, name, promote_to || null]
        );

        res.status(201).json({ class: result.rows[0] });
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ 
            message: 'Database operation failed',
            error: error.message,
            detail: error.detail 
        });
    } finally {
        client.release();
    }
};

exports.getClasses = async (req, res) => {
    const { school_code } = req.user;
    const { session_id } = req.query; // Changed from body to query

    if (!session_id) {
        return res.status(400).json({ message: 'Session ID is required' });
    }

    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT id, name, promote_to 
             FROM classes 
             WHERE school_code = $1 AND session_id = $2`,
            [school_code, session_id]
        );

        res.status(200).json({ classes: result.rows });
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ 
            message: 'Database operation failed',
            error: error.message
        });
    } finally {
        client.release();
    }
};