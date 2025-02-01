const express = require('express');
const { createSchool } = require('../controllers/schoolController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/create', authenticate, createSchool); // Super Admin Creates School

module.exports = router;
