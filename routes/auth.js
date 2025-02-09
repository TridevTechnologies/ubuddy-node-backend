const express = require('express');
const { login } = require('../controllers/authController');

const router = express.Router();

router.post('/login', login); // Super Admin & School Admin Login

module.exports = router;