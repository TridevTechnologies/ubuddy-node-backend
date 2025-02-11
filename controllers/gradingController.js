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
// controllers/gradingController.js
exports.getGradingScales = async (req, res) => {
  const client = await pool.connect();
  try {
    const { session_id } = req.query;
    const school_code = req.user.school_code;
    if (!session_id) {
      return res.status(400).json({ message: "Missing required field: session_id" });
    }
    const query = `
      SELECT * 
      FROM grading_scales 
      WHERE school_code = $1 AND session_id = $2
      ORDER BY min_marks ASC
    `;
    const result = await client.query(query, [school_code, session_id]);
    res.status(200).json({ grading_scales: result.rows });
  } catch (error) {
    console.error("Error fetching grading scales:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  } finally {
    client.release();
  }
};

exports.deleteGradingScale = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const school_code = req.user.school_code;
    // Check that the grading scale exists for this school
    const checkQuery = "SELECT * FROM grading_scales WHERE id = $1 AND school_code = $2";
    const checkResult = await client.query(checkQuery, [id, school_code]);
    if (checkResult.rowCount === 0) {
      return res.status(404).json({ message: "Grading scale not found" });
    }
    const deleteQuery = "DELETE FROM grading_scales WHERE id = $1";
    await client.query(deleteQuery, [id]);
    res.status(200).json({ message: "Grading scale deleted successfully" });
  } catch (error) {
    console.error("Error deleting grading scale:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  } finally {
    client.release();
  }
};
exports.getExamTerms = async (req, res) => {
  const client = await pool.connect();
  try {
    const { session_id } = req.query;
    const school_code = req.user.school_code;
    if (!session_id) {
      return res.status(400).json({ message: "Missing required field: session_id" });
    }
    const query = `
      SELECT * 
      FROM exam_terms 
      WHERE school_code = $1 AND session_id = $2
      ORDER BY id ASC
    `;
    const result = await client.query(query, [school_code, session_id]);
    res.status(200).json({ exam_terms: result.rows });
  } catch (error) {
    console.error("Error fetching exam terms:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  } finally {
    client.release();
  }
};
exports.deleteExamTerm = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const school_code = req.user.school_code;
    const checkQuery = "SELECT * FROM exam_terms WHERE id = $1 AND school_code = $2";
    const checkResult = await client.query(checkQuery, [id, school_code]);
    if (checkResult.rowCount === 0) {
      return res.status(404).json({ message: "Exam term not found" });
    }
    const deleteQuery = "DELETE FROM exam_terms WHERE id = $1";
    await client.query(deleteQuery, [id]);
    res.status(200).json({ message: "Exam term deleted successfully" });
  } catch (error) {
    console.error("Error deleting exam term:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  } finally {
    client.release();
  }
};
