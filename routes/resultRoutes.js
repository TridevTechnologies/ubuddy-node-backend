// routes/resultRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { getSubjectsForResultEntry, submitResults, getResult } = require('../controllers/resultController');

router.get('/subjects', authenticate, getSubjectsForResultEntry);
router.post('/', authenticate, submitResults);
router.get('/', authenticate, getResult);

module.exports = router;
