const express = require('express');
const { createClass, getClasses } = require('../controllers/classController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

// POST route to create class
router.post('/create', authenticate, createClass);

// GET route to fetch classes (changed from POST to GET)
router.get('/all', authenticate, getClasses);

module.exports = router;