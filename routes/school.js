const express = require("express");
const { authenticate } = require("../middleware/authMiddleware"); // Import the authenticate middleware
const router = express.Router();
const subjectController = require("../controllers/subjectController");

// Post route to create subjects
router.post("/create", authenticate, subjectController.createSubjects);

// Get route to fetch subjects
router.get("/", authenticate, subjectController.getSubjects);

module.exports = router;
