const express = require('express');
const router = express.Router();
const { getActiveSessions } = require('../controllers/sessionController');

router.get('/active', getActiveSessions);

module.exports = router;
