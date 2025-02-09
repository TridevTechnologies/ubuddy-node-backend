const express = require("express");
const router = express.Router();
const subjectController = require("../controllers/subjectController");
const { authenticate } = require("../middleware/authMiddleware");

router.post("/create", authenticate, subjectController.createSubjects);
router.get("/", authenticate, subjectController.getSubjects); // New route to fetch subjects

module.exports = router;
