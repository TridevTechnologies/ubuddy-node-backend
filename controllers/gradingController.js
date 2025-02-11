const pool = require("../config/db");

exports.createOrUpdateGradingScale = async (req, res) => {
  const client = await pool.connect();
  try {
      const { session_id, scales } = req.body;
      const school_code = req.user.school_code; // Extract from JWT

      if (!session_id || !scales) {
          return res.status(400).json({ message: "Missing required fields" });
      }

      await client.query("BEGIN");

      // Delete existing scales for this school & session
      await client.query(
          "DELETE FROM grading_scales WHERE school_code = $1 AND session_id = $2",
          [school_code, session_id]
      );

      for (const scale of scales) {
          const { min_marks, max_marks, grade } = scale;
          await client.query(
              "INSERT INTO grading_scales (school_code, session_id, min_marks, max_marks, grade) VALUES ($1, $2, $3, $4, $5)",
              [school_code, session_id, min_marks, max_marks, grade]
          );
      }

      await client.query("COMMIT");
      res.status(201).json({ message: "Grading scales updated" });
  } catch (error) {
      await client.query("ROLLBACK");
      res.status(500).json({ message: "Internal server error", error: error.message });
  } finally {
      client.release();
  }
};

exports.createExamTerm = async (req, res) => {
  const client = await pool.connect();
  try {
      const { session_id, term_name, weightage } = req.body;
      const school_code = req.user.school_code; // Extract from JWT

      if (!session_id || !term_name || weightage == null) {
          return res.status(400).json({ message: "Missing required fields" });
      }

      const insertQuery = `
          INSERT INTO exam_terms (school_code, session_id, term_name, weightage)
          VALUES ($1, $2, $3, $4)
          RETURNING id
      `;

      const result = await client.query(insertQuery, [school_code, session_id, term_name, weightage]);
      res.status(201).json({ message: "Exam term created", exam_term_id: result.rows[0].id });
  } catch (error) {
      res.status(500).json({ message: "Internal server error", error: error.message });
  } finally {
      client.release();
  }
};
