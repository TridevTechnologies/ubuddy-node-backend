const express = require("express");
const router = express.Router();
const subjectController = require("../controllers/subjectController");
const { authenticate } = require("../middleware/authMiddleware");
const { assignAdditionalSubject } = require("../controllers/studentController");

router.post("/create", authenticate, subjectController.createSubjects);
router.get("/", authenticate, subjectController.getSubjects); // New route to fetch subjects
router.post("/assign-additional-subject", authenticate, assignAdditionalSubject);
module.exports = router;
