const db = require("../config/db"); // Ensure correct path


exports.createClassSubjects = async (req, res) => {
    const { class_id, subjects } = req.body;
    const client = await db.connect();
  
    try {
      await client.query('BEGIN');
  
      // 1. Get existing class subjects for this class
      const existingQuery = `
        SELECT * FROM class_subjects 
        WHERE class_id = $1
      `;
      const existingRes = await client.query(existingQuery, [class_id]);
      const existingSubjects = existingRes.rows;
  
      // 2. Process deletions and updates
      const payloadSubjectIds = subjects.map(s => s.subject_id);
      
      // Identify subjects to delete
      const subjectsToDelete = existingSubjects.filter(
        es => !payloadSubjectIds.includes(es.subject_id)
      );
  
      // Delete dependent records and class subjects
      for (const subject of subjectsToDelete) {
        // Delete student_additional_subjects first
        await client.query(
          `DELETE FROM student_additional_subjects 
           WHERE subject_id = $1`,
          [subject.id]
        );
        
        // Delete class_subject
        await client.query(
          `DELETE FROM class_subjects 
           WHERE id = $1`,
          [subject.id]
        );
      }
  
      // 3. Upsert remaining subjects
      for (const subject of subjects) {
        const { subject_id, is_compulsory, is_result_subject, is_daily_schedule, is_timetable } = subject;
        
        // Validate at least one usage flag is true
        if (!(is_result_subject || is_daily_schedule || is_timetable)) {
          throw new Error(
            `At least one usage flag (timetable/result/daily) must be enabled for subject ${subject_id}`
          );
        }
  
        // Upsert class subject
        const upsertQuery = `
          INSERT INTO class_subjects (
            class_id, subject_id, is_compulsory, 
            is_result_subject, is_daily_schedule, is_timetable
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (class_id, subject_id)
          DO UPDATE SET
            is_compulsory = EXCLUDED.is_compulsory,
            is_result_subject = EXCLUDED.is_result_subject,
            is_daily_schedule = EXCLUDED.is_daily_schedule,
            is_timetable = EXCLUDED.is_timetable
          RETURNING *
        `;
        await client.query(upsertQuery, [
          class_id,
          subject_id,
          is_compulsory,
          is_result_subject,
          is_daily_schedule,
          is_timetable
        ]);
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
