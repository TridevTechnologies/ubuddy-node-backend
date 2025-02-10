const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/authMiddleware");
const {
    createStudent,
    updateStudentStatus,
    editStudent,
    updateStudentEnrollment,
    updateStudentBankDetails,
    getAllStudents,
    getFullStudentDetails,
    getRollNumber,
    updateRollNumber,
    updateClass,
    getSection,
    updateSection,
    
} = require("../controllers/studentController");
const { getClasses } = require("../controllers/classController");

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

router.get("/:id", authenticate, getFullStudentDetails);

router.get("/", authenticate, getAllStudents);

router.get("/roll-number", authenticate , getRollNumber);
router.put("/roll-number/update", authenticate , updateRollNumber);

router.get("/class",authenticate , getClasses);
router.put("/class/update", authenticate , updateClass);

router.get("/section", authenticate , getSection);
router.put("/section/update", authenticate , updateSection);



module.exports = router;

