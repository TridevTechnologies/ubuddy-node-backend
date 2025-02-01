const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/authMiddleware");
const { createStudent } = require("../controllers/studentController");

router.post("/create", authenticate, createStudent);

module.exports = router;
