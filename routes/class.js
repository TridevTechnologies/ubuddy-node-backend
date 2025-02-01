const express = require('express');
const { createClass, getClasses } = require('../controllers/classController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

// Post route to create class
router.post('/create', authenticate, createClass);

// Get route to fetch classes for a particular school
router.get('/all', authenticate, getClasses);

module.exports = router;
