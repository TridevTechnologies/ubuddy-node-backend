const pool = require('../config/db');

exports.getActiveSessions = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM sessions WHERE is_active = true'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching active sessions:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
