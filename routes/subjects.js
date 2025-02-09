const express = require("express");
const router = express.Router();
const subjectController = require("../controllers/subjectController");

router.post("/", subjectController.createSubjects);

module.exports = router;
