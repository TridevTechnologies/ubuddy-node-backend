const pool = require("../config/db");

// Fetch subjects for result entry (unchanged if still using subject list logic)
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
    const school_code = req.user.school_code;

    // Validate input
    if (!enrollment_id || !exam_term_id || !subject_results) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (!Array.isArray(subject_results)) {
      return res.status(400).json({ message: "subject_results must be an array" });
    }

    // Get enrollment details
    const enrollmentRes = await client.query(
      `SELECT se.class_id, se.session_id, s.school_code 
       FROM student_enrollments se
       JOIN students s ON se.student_id = s.student_id
       WHERE se.enrollment_id = $1`,
      [enrollment_id]
    );
    if (enrollmentRes.rowCount === 0) {
      return res.status(404).json({ message: "Enrollment not found" });
    }
    const { class_id, session_id, school_code: verified_school_code } = enrollmentRes.rows[0];
    if (verified_school_code !== school_code) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    // Get exam term details: marks_scheme, max_theory, max_practical
    const termRes = await client.query(
      `SELECT marks_scheme, theory_marks AS max_theory, practical_marks AS max_practical 
       FROM exam_terms 
       WHERE id = $1`,
      [exam_term_id]
    );
    if (termRes.rowCount === 0) {
      return res.status(404).json({ message: "Exam term not found" });
    }
    const { marks_scheme, max_theory, max_practical } = termRes.rows[0];

    await client.query('BEGIN');

    // Loop through each subject result
    for (const subj of subject_results) {
      const { subject_id, theory_marks, practical_marks, is_absent } = subj;
      const absent = !!is_absent; // Ensure boolean value

      let finalTheory = 0, finalPractical = null, finalTotal = 0;

      if (absent) {
        // When absent, all marks are set to 0
        finalTheory = 0;
        finalPractical = marks_scheme === 'dual' ? 0 : null;
        finalTotal = 0;
      } else {
        if (marks_scheme === 'single') {
          if (theory_marks === undefined || theory_marks === null) {
            throw new Error(`Theory marks are required for subject ${subject_id} in single scheme`);
          }
          const parsedTheory = parseFloat(theory_marks);
          if (isNaN(parsedTheory)) {
            throw new Error(`Invalid theory marks for subject ${subject_id}`);
          }
          if (parsedTheory > max_theory) {
            throw new Error(`Theory marks for subject ${subject_id} cannot exceed maximum of ${max_theory}`);
          }
          finalTheory = parsedTheory;
          finalPractical = null;
          finalTotal = parsedTheory;
        } else if (marks_scheme === 'dual') {
          if (
            theory_marks === undefined || theory_marks === null ||
            practical_marks === undefined || practical_marks === null
          ) {
            throw new Error(`Both theory and practical marks are required for subject ${subject_id} in dual scheme`);
          }
          const parsedTheory = parseFloat(theory_marks);
          const parsedPractical = parseFloat(practical_marks);
          if (isNaN(parsedTheory) || isNaN(parsedPractical)) {
            throw new Error(`Invalid marks for subject ${subject_id}`);
          }
          if (parsedTheory > max_theory) {
            throw new Error(`Theory marks for subject ${subject_id} cannot exceed maximum of ${max_theory}`);
          }
          if (parsedPractical > max_practical) {
            throw new Error(`Practical marks for subject ${subject_id} cannot exceed maximum of ${max_practical}`);
          }
          finalTheory = parsedTheory;
          finalPractical = parsedPractical;
          finalTotal = parsedTheory + parsedPractical;
        } else {
          throw new Error("Invalid marks scheme in exam term");
        }
      }

      // UPSERT into results table with new columns
      const upsertQuery = `
        INSERT INTO results (
          school_code, enrollment_id, session_id, class_id,
          exam_term_id, subject_id, theory_marks, practical_marks, total_marks, is_absent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (enrollment_id, exam_term_id, subject_id)
        DO UPDATE SET
          theory_marks = EXCLUDED.theory_marks,
          practical_marks = EXCLUDED.practical_marks,
          total_marks = EXCLUDED.total_marks,
          is_absent = EXCLUDED.is_absent,
          updated_at = NOW()
      `;
      await client.query(upsertQuery, [
        school_code,
        enrollment_id,
        session_id,
        class_id,
        exam_term_id,
        subject_id,
        finalTheory,
        finalPractical,
        finalTotal,
        absent
      ]);
    }

    await client.query('COMMIT');
    res.status(201).json({ message: "Results updated successfully" });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Result submission error:", error);
    res.status(500).json({ message: error.message || "Internal server error" });
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
    
    // Fetch result rows for this enrollment and exam term.
    const query = `
      SELECT r.subject_id, r.theory_marks, r.practical_marks, r.total_marks, r.is_absent, s.name, s.code
      FROM results r
      JOIN subjects s ON r.subject_id = s.id
      WHERE r.enrollment_id = $1 AND r.exam_term_id = $2
    `;
    const result = await client.query(query, [enrollment_id, exam_term_id]);
    
    // Sum up the total obtained marks from the results.
    let totalObtained = 0;
    result.rows.forEach(row => {
      totalObtained += parseFloat(row.total_marks);
    });
    
    // Fetch exam term details to determine maximum possible marks per subject.
    const termRes = await client.query(
      `SELECT marks_scheme, theory_marks AS max_theory, practical_marks AS max_practical 
       FROM exam_terms 
       WHERE id = $1`,
      [exam_term_id]
    );
    if (termRes.rowCount === 0) {
      return res.status(404).json({ message: "Exam term not found" });
    }
    const { marks_scheme, max_theory, max_practical } = termRes.rows[0];
    
    // Calculate total possible marks based on the marks scheme.
    let totalPossible = 0;
    if (marks_scheme === 'single') {
      totalPossible = result.rows.length * max_theory;
    } else if (marks_scheme === 'dual') {
      totalPossible = result.rows.length * (max_theory + max_practical);
    }
    const percentage = totalPossible > 0 ? (totalObtained / totalPossible) * 100 : 0;
    
    // Get enrollment details (for school_code, session_id, class_id)
    const schoolQuery = `
      SELECT s.school_code, se.session_id, se.class_id
      FROM student_enrollments se
      JOIN students s ON se.student_id = s.student_id
      WHERE se.enrollment_id = $1
      LIMIT 1
    `;
    const schoolRes = await client.query(schoolQuery, [enrollment_id]);
    if (schoolRes.rowCount === 0) {
      return res.status(404).json({ message: "Enrollment not found" });
    }
    const { school_code, session_id: sess, class_id } = schoolRes.rows[0];
    
    // Use grading_scales to determine grade.
    const gradingQuery = `
      SELECT grade FROM grading_scales
      WHERE school_code = $1
        AND session_id = $2
        AND min_marks <= $3 AND max_marks >= $3
      LIMIT 1
    `;
    const gradingRes = await client.query(gradingQuery, [school_code, sess, percentage]);
    const grade = gradingRes.rowCount > 0 ? gradingRes.rows[0].grade : "N/A";
    
    res.status(200).json({
      results: result.rows,
      totalObtained,
      totalPossible,
      percentage,
      grade,
      class_id,
      session_id: sess
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
