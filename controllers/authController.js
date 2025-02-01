const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Login API
exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const user = result.rows[0];

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { user_id: user.user_id, email: user.email, role: user.role, school_code: user.school_code },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ token, user: { user_id: user.user_id, email: user.email, role: user.role , school_code : user.school_code} });

    } catch (error) {
        console.error("Login Error:", error); // Log the error for debugging
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
