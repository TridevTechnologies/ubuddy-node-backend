const express = require('express');
const { createSchool } = require('../controllers/schoolController');
const { authenticate } = require('../middleware/authMiddleware');
const {getAllSchools} = require('../controllers/schoolController');
const router = express.Router();

router.post('/create', authenticate, createSchool); // Super Admin Creates School
router.get('/all', authenticate, getAllSchools);

module.exports = router;
