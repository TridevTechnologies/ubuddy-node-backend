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
// controllers/resultController.js
exports.submitResults = async (req, res) => {
  const client = await pool.connect();
  try {
    const { enrollment_id, exam_term_id, subject_results } = req.body;
    const school_code = req.user.school_code;
    if (!enrollment_id || !exam_term_id || !subject_results || !Array.isArray(subject_results)) {
      return res.status(400).json({ message: "enrollment_id, exam_term_id, and subject_results (array) are required" });
    }
    
    await client.query('BEGIN');
    
    // Loop through each subject result
    for (const subj of subject_results) {
      const { subject_id, marks_obtained, present } = subj;
      // If absent, marks are automatically 0.
      const marks = present ? marks_obtained : 0;
      
      // Use an UPSERT: if a row exists (for this school, enrollment, subject, exam term), update it; else, insert a new one.
      const upsertQuery = `
        INSERT INTO results (school_code, enrollment_id, exam_term_id, subject_id, marks, is_absent)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (school_code, enrollment_id, subject_id, exam_term_id)
        DO UPDATE SET marks = EXCLUDED.marks, is_absent = EXCLUDED.is_absent, updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `;
      await client.query(upsertQuery, [school_code, enrollment_id, exam_term_id, subject_id, marks, present]);
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

const pool = require("../config/db");

exports.getResult = async (req, res) => {
  const client = await pool.connect();
  try {
    const { enrollment_id, exam_term_id } = req.query;
    if (!enrollment_id || !exam_term_id) {
      return res
        .status(400)
        .json({ message: "enrollment_id and exam_term_id are required" });
    }
    
    // Fetch result rows for this enrollment and exam term.
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
    // Assume each subject is out of 100 marks.
    const totalPossible = result.rows.length * 100;
    const percentage = totalPossible > 0 ? (totalMarks / totalPossible) * 100 : 0;
    
    // Get school_code and session_id from the enrollment record.
    const schoolQuery = `
      SELECT s.school_code, se.session_id
      FROM student_enrollments se
      JOIN students s ON se.student_id = s.student_id
      WHERE se.enrollment_id = $1
      LIMIT 1
    `;
    const schoolRes = await client.query(schoolQuery, [enrollment_id]);
    if (schoolRes.rowCount === 0) {
      return res.status(404).json({ message: "Enrollment not found" });
    }
    const { school_code, session_id } = schoolRes.rows[0];
    
    // Use grading_scales to determine grade.
    const gradingQuery = `
      SELECT grade FROM grading_scales
      WHERE school_code = $1
        AND session_id = $2
        AND min_marks <= $3 AND max_marks >= $3
      LIMIT 1
    `;
    const gradingRes = await client.query(gradingQuery, [school_code, session_id, percentage]);
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

exports.deleteResult = async (req, res) => {
  const client = await pool.connect();
  try {
    const { enrollment_id, subject_id, exam_term_id } = req.body;
    const school_code = req.user.school_code;
    if (!enrollment_id || !subject_id || !exam_term_id) {
      return res.status(400).json({ message: "enrollment_id, subject_id, and exam_term_id are required" });
    }
    const deleteQuery = `
      DELETE FROM results
      WHERE school_code = $1 AND enrollment_id = $2 AND subject_id = $3 AND exam_term_id = $4
    `;
    const deleteResult = await client.query(deleteQuery, [school_code, enrollment_id, subject_id, exam_term_id]);
    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ message: "No result entry found to delete" });
    }
    res.status(200).json({ message: "Result entry deleted successfully" });
  } catch (error) {
    console.error("Error deleting result entry:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  } finally {
    client.release();
  }
};
