const express = require("express");
const router = express.Router();
const classSubjectController = require("../controllers/classSubjectController");

router.post("/", classSubjectController.allocateSubjectsToClass);

module.exports = router;
