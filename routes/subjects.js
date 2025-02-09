const express = require("express");
const router = express.Router();
const subjectController = require("../controllers/subjectController");

router.post("/create", subjectController.createSubjects);

router.get("/", subjectController.getSubjects);
module.exports = router;
