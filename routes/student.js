const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/authMiddleware");
const {
    createStudent,
    updateStudentStatus,
    editStudent,
    updateStudentEnrollment,
    updateStudentBankDetails
} = require("../controllers/studentController");

// Route to create a student (requires authentication)
router.post("/create", authenticate, createStudent);

// Route to update the status of a student (requires authentication)
router.patch("/:id/status", authenticate, updateStudentStatus);

// Route to edit student details (requires authentication)
router.patch("/:id", authenticate, editStudent);

// Route to update student enrollment details (requires authentication)
router.patch("/:id/enrollment", authenticate, updateStudentEnrollment);

// Route to update student bank details (requires authentication)
router.patch("/:id/bank-details", authenticate, updateStudentBankDetails);

module.exports = router;
