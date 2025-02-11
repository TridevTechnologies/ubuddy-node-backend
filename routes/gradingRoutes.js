// routes/gradingRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const {
  createOrUpdateGradingScale,
  createExamTerm,
  getGradingScales,
  deleteGradingScale,
  getExamTerms,
  deleteExamTerm
} = require('../controllers/gradingController');

router.post('/grading-scales', authenticate, createOrUpdateGradingScale);
router.get('/grading-scales', authenticate, getGradingScales);
router.delete('/grading-scales/:id', authenticate, deleteGradingScale);

router.post('/exam-terms', authenticate, createExamTerm);
router.get('/exam-terms', authenticate, getExamTerms);
router.delete('/exam-terms/:id', authenticate, deleteExamTerm);

module.exports = router;
