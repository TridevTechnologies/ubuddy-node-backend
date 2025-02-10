const express = require("express");
const router = express.Router();
const classSubjectController = require("../controllers/classSubjectController");
const { authenticate } = require("../middleware/authMiddleware");

router.post("/create", authenticate , classSubjectController.createClassSubjects);
router.get("/", authenticate ,classSubjectController.getClassSubjects);

module.exports = router;
