const pool = require("../config/db");

// controllers/resultController.js
exports.getSubjectsForResultEntry = async (req, res) => {
  const client = await pool.connect();
  try {
    const { enrollment_id } = req.query;
    if (!enrollment_id) {
      return res.status(400).json({ message: "enrollment_id is required" });
    }
    // Get the class_id for this enrollment.
    const enrollmentRes = await client.query(
      "SELECT class_id FROM student_enrollments WHERE enrollment_id = $1",
      [enrollment_id]
    );
    if (enrollmentRes.rowCount === 0) {
      return res.status(404).json({ message: "Enrollment not found" });
    }
    const class_id = enrollmentRes.rows[0].class_id;
    
    // Get compulsory subjects from class_subjects (only those marked is_result_subject = true)
    const compulsoryQuery = `
      SELECT s.id AS subject_id, s.name, s.code, true AS compulsory
      FROM class_subjects cs
      JOIN subjects s ON cs.subject_id = s.id
      WHERE cs.class_id = $1 AND cs.is_compulsory = true AND cs.is_result_subject = true
    `;
    const compulsoryRes = await client.query(compulsoryQuery, [class_id]);

    // Get additional subjects for the enrollment.
    // Join with class_subjects to ensure they are result subjects.
    const additionalQuery = `
      SELECT s.id AS subject_id, s.name, s.code, false AS compulsory
      FROM student_additional_subjects sas
      JOIN subjects s ON sas.subject_id = s.id
      JOIN class_subjects cs ON cs.subject_id = s.id AND cs.class_id = $1
      WHERE sas.enrollment_id = $2 AND cs.is_result_subject = true
    `;
    const additionalRes = await client.query(additionalQuery, [class_id, enrollment_id]);

    const subjects = [...compulsoryRes.rows, ...additionalRes.rows];
    res.status(200).json({ subjects });
  } catch (error) {
    console.error("Error fetching subjects for result entry:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  } finally {
    client.release();
  }
};
exports.submitResults = async (req, res) => {
  const client = await pool.connect();
  try {
    const { enrollment_id, exam_term_id, subject_results } = req.body;
    if (!enrollment_id || !exam_term_id || !subject_results || !Array.isArray(subject_results)) {
      return res.status(400).json({ message: "enrollment_id, exam_term_id, and subject_results (array) are required" });
    }
    
    await client.query('BEGIN');
    
    // Optionally: Check if results already exist for this enrollment & exam term.
    const checkQuery = `SELECT * FROM results WHERE enrollment_id = $1 AND exam_term_id = $2`;
    const checkResult = await client.query(checkQuery, [enrollment_id, exam_term_id]);
    if (checkResult.rowCount > 0) {
      return res.status(400).json({ message: "Results already submitted for this enrollment and exam term" });
    }
    
    // Insert each subject's result.
    for (const subj of subject_results) {
      const { subject_id, marks_obtained, present } = subj;
      // If absent, set marks to 0.
      const marks = present ? marks_obtained : 0;
      const insertQuery = `
        INSERT INTO results (enrollment_id, exam_term_id, subject_id, marks, is_absent)
        VALUES ($1, $2, $3, $4, $5)
      `;
      await client.query(insertQuery, [enrollment_id, exam_term_id, subject_id, marks, present]);
    }
    
    await client.query('COMMIT');
    res.status(201).json({ message: "Results submitted successfully" });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error submitting results:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  } finally {
    client.release();
  }
};
exports.getResult = async (req, res) => {
  const client = await pool.connect();
  try {
    const { enrollment_id, exam_term_id } = req.query;
    if (!enrollment_id || !exam_term_id) {
      return res.status(400).json({ message: "enrollment_id and exam_term_id are required" });
    }
    
    const query = `
      SELECT r.subject_id, r.marks, r.is_absent, s.name, s.code
      FROM results r
      JOIN subjects s ON r.subject_id = s.id
      WHERE r.enrollment_id = $1 AND r.exam_term_id = $2
    `;
    const result = await client.query(query, [enrollment_id, exam_term_id]);
    let totalMarks = 0;
    result.rows.forEach(row => {
      totalMarks += parseFloat(row.marks);
    });
    // For simplicity, assume each subject is out of 100 marks.
    const totalPossible = result.rows.length * 100;
    const percentage = totalPossible > 0 ? (totalMarks / totalPossible) * 100 : 0;
    
    // Convert percentage to a grade using grading_scales.
    // Assume that grading_scales are defined for the school's session.
    const gradingQuery = `
      SELECT grade FROM grading_scales
      WHERE school_code = (
        SELECT school_code FROM students s 
        JOIN student_enrollments se ON s.student_id = se.student_id 
        WHERE se.enrollment_id = $1
      )
      AND session_id = (
        SELECT session_id FROM student_enrollments WHERE enrollment_id = $1
      )
      AND min_marks <= $2 AND max_marks >= $2
      LIMIT 1
    `;
    const gradingRes = await client.query(gradingQuery, [enrollment_id, percentage]);
    const grade = gradingRes.rowCount > 0 ? gradingRes.rows[0].grade : "N/A";
    
    res.status(200).json({
      results: result.rows,
      totalMarks,
      totalPossible,
      percentage,
      grade
    });
  } catch (error) {
    console.error("Error fetching result:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  } finally {
    client.release();
  }
};
