const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { createOrUpdateGradingScale, createExamTerm } = require('../controllers/gradingController');

router.post('/grading-scales', authenticate, createOrUpdateGradingScale);
router.post('/exam-terms', authenticate, createExamTerm);

module.exports = router;
