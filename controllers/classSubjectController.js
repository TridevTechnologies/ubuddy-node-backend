const db = require("../config/db"); // Ensure correct path


exports.createClassSubjects = async (req, res) => {
    try {
      const { class_id, subjects } = req.body;
      // Expect subjects to be an array of objects with keys:
      // subject_id, is_allocated, is_compulsory, is_result_subject, is_daily_schedule, is_timetable
      const { role, school_code: userSchoolCode } = req.user;
  
      if (!class_id || !Array.isArray(subjects)) {
        return res.status(400).json({ message: "Invalid request data" });
      }
  
      let finalSchoolCode;
      if (role === "super_admin") {
        if (!req.body.school_code) {
          return res.status(400).json({ message: "Super Admin must provide a school_code" });
        }
        finalSchoolCode = req.body.school_code;
      } else {
        finalSchoolCode = userSchoolCode;
      }
  
      const client = await db.connect();
      await client.query('BEGIN');
  
      try {
        // Verify the class belongs to the provided school.
        const classCheck = await client.query(
          `SELECT id FROM classes WHERE id = $1 AND school_code = $2`,
          [class_id, finalSchoolCode]
        );
        if (classCheck.rowCount === 0) {
          return res.status(403).json({ message: "Unauthorized: Invalid class" });
        }
  
        // Process each subject from the payload individually.
        for (const subject of subjects) {
          const { subject_id, is_allocated, is_compulsory, is_result_subject, is_daily_schedule, is_timetable } = subject;
  
          if (is_allocated) {
            // Validate that at least one usage flag is true.
            if (!(is_result_subject || is_daily_schedule || is_timetable)) {
              throw new Error(`For subject ${subject_id}, at least one usage flag (timetable, result, daily) must be enabled`);
            }
            // Upsert the record into class_subjects.
            // (If a record exists for the given class_id and subject_id, update its settings;
            // otherwise, insert a new record. The primary key (id) remains unchanged if the record exists.)
            const upsertQuery = `
              INSERT INTO class_subjects (
                class_id, subject_id, is_compulsory, is_result_subject, is_daily_schedule, is_timetable
              )
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (class_id, subject_id)
              DO UPDATE SET
                is_compulsory = EXCLUDED.is_compulsory,
                is_result_subject = EXCLUDED.is_result_subject,
                is_daily_schedule = EXCLUDED.is_daily_schedule,
                is_timetable = EXCLUDED.is_timetable
            `;
            await client.query(upsertQuery, [
              class_id,
              subject_id,
              is_compulsory,
              is_result_subject,
              is_daily_schedule,
              is_timetable
            ]);
          } else {
            // If allocation is turned off, delete the record from class_subjects (if it exists)
            // and delete dependent records in student_additional_subjects that reference that class_subject record.
            // First, delete dependent records from student_additional_subjects.
            await client.query(
              `DELETE FROM student_additional_subjects 
               WHERE subject_id IN (
                 SELECT id FROM class_subjects 
                 WHERE class_id = $1 AND subject_id = $2
               )`,
              [class_id, subject_id]
            );
            // Then, delete the record from class_subjects.
            await client.query(
              `DELETE FROM class_subjects 
               WHERE class_id = $1 AND subject_id = $2`,
              [class_id, subject_id]
            );
          }
        }
  
        await client.query('COMMIT');
        res.status(200).json({ message: 'Class subjects updated successfully' });
      } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating class subjects:', error);
        res.status(500).json({ message: error.message });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error updating class subjects:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  };
  
exports.getClassSubjects = async (req, res) => {
    try {
        const { role, school_code: userSchoolCode } = req.user; // Extract from JWT
        const { school_code, class_id } = req.query;

        let finalSchoolCode;

        if (role === "super_admin") {
            if (!school_code) {
                return res.status(400).json({ message: "Super Admin must provide a school_code" });
            }
            finalSchoolCode = school_code;
        } else {
            if (school_code && school_code !== userSchoolCode) {
                return res.status(403).json({ message: "Unauthorized: Mismatched school code" });
            }
            finalSchoolCode = userSchoolCode;
        }

        if (!finalSchoolCode || !class_id) {
            return res.status(400).json({ message: "Invalid request data" });
        }

        const client = await db.connect();

        try {
            // 🔍 Verify if the class belongs to the same school
            const classCheck = await client.query(
                `SELECT id FROM classes WHERE id = $1 AND school_code = $2`,
                [class_id, finalSchoolCode]
            );

            if (classCheck.rows.length === 0) {
                return res.status(403).json({ message: "Unauthorized: Class does not belong to the school" });
            }

            // 📌 Fetch assigned subjects
            const { rows } = await client.query(
                `SELECT cs.id, cs.class_id, cs.subject_id, 
                        cs.is_compulsory, cs.is_result_subject, cs.is_daily_schedule, cs.is_timetable 
                 FROM class_subjects cs
                 JOIN subjects s ON cs.subject_id = s.id
                 WHERE cs.class_id = $1`,
                [class_id]
            );

            res.status(200).json({ message: "Class subjects retrieved successfully", classSubjects: rows });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Error fetching class subjects:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
