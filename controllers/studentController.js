const pool = require("../config/db");
const moment = require("moment");

// Create Student API (Updated with Default Status)
exports.createStudent = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const school_code = req.user.role === "super_admin" ? req.body.school_code : req.user.school_code;
        if (!school_code) {
            return res.status(400).json({ message: "School code is required" });
        }

        const {
            first_name, middle_name, last_name, date_of_birth, gender, aadhar_number,
            sssmid, family_sssmid, apaar_id, pen, primary_contact, current_address,
            permanent_address, session_id, class_id, section_id, roll_number,
            admission_type, admission_date, previous_class, previous_school,
            family_details, bank_details
        } = req.body;

        // Validate date of birth (should be a valid date)
        if (!moment(date_of_birth, "YYYY-MM-DD", true).isValid()) {
            return res.status(400).json({ message: "Invalid date of birth format" });
        }

        // Validate primary_contact (should be numeric)
        if (!/^\d+$/.test(primary_contact)) {
            return res.status(400).json({ message: "Primary contact must be numeric" });
        }

        const studentQuery = `
            INSERT INTO students (
                school_code, first_name, middle_name, last_name, date_of_birth, gender,
                aadhar_number, sssmid, family_sssmid, apaar_id, pen, primary_contact,
                current_address, permanent_address, status
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, 'active')
            RETURNING student_id`;

        const studentResult = await client.query(studentQuery, [
            school_code, first_name, middle_name, last_name, date_of_birth, gender,
            aadhar_number, sssmid, family_sssmid, apaar_id, pen, primary_contact,
            current_address, permanent_address
        ]);
        const student_id = studentResult.rows[0].student_id;

        // Insert into student_enrollments table
        const enrollmentQuery = `
            INSERT INTO student_enrollments (
                student_id, session_id, class_id, section_id, roll_number, admission_type,
                admission_date, previous_class, previous_school
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`;
        await client.query(enrollmentQuery, [
            student_id, session_id, class_id, section_id, roll_number, admission_type,
            admission_date, previous_class, previous_school
        ]);

        // Insert family details
        if (Array.isArray(family_details)) {
            for (const family of family_details) {
                const familyQuery = `
                    INSERT INTO family_details (student_id, relation, name, aadhar_number, occupation, annual_income)
                    VALUES ($1, $2, $3, $4, $5, $6)`;
                await client.query(familyQuery, [
                    student_id, family.relation, family.name, family.aadhar_number,
                    family.occupation, family.annual_income
                ]);
            }
        }

        // Insert bank details
        if (bank_details) {
            const bankQuery = `
                INSERT INTO bank_details (student_id, account_holder, account_number, ifsc_code)
                VALUES ($1, $2, $3, $4)`;
            await client.query(bankQuery, [
                student_id, bank_details.account_holder, bank_details.account_number, bank_details.ifsc_code
            ]);
        }

        await client.query("COMMIT");
        res.status(201).json({ message: "Student created successfully", student_id });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error creating student:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    } finally {
        client.release();
    }
};

// Update Student Status
exports.updateStudentStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const { school_code } = req.user;

    if (!["active", "inactive", "terminated"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
    }

    try {
        const checkStatusQuery = "SELECT status, school_code FROM students WHERE student_id = $1";
        const student = await pool.query(checkStatusQuery, [id]);

        if (student.rows.length === 0) {
            return res.status(404).json({ message: "Student not found" });
        }

        if (student.rows[0].school_code !== school_code) {
            return res.status(403).json({ message: "Unauthorized: You can only update your school's students" });
        }

        const currentStatus = student.rows[0].status;

        if (currentStatus === "terminated") {
            return res.status(400).json({ message: "Cannot change status of a terminated student" });
        }
        if (currentStatus === "active" && status === "terminated") {
            return res.status(400).json({ message: "Student must be inactive before termination" });
        }

        const updateQuery = "UPDATE students SET status = $1 WHERE student_id = $2";
        await pool.query(updateQuery, [status, id]);

        res.json({ message: `Student status updated to ${status}` });
    } catch (error) {
        console.error("Error updating student status:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Edit Student Details
exports.editStudent = async (req, res) => {
    const { student_id, ...fields } = req.body;
    const { school_code } = req.user;

    if (!student_id) {
        return res.status(400).json({ message: "Student ID is required in the request body" });
    }

    const keys = Object.keys(fields);
    if (keys.length === 0) {
        return res.status(400).json({ message: "No fields to update" });
    }

    try {
        const checkStudentQuery = "SELECT school_code FROM students WHERE student_id = $1";
        const student = await pool.query(checkStudentQuery, [student_id]);

        if (student.rows.length === 0) {
            return res.status(404).json({ message: "Student not found" });
        }

        if (student.rows[0].school_code !== school_code) {
            return res.status(403).json({ message: "Unauthorized: You can only update your school's students" });
        }

        const updateQuery = `
            UPDATE students
            SET ${keys.map((key, i) => `${key} = $${i + 1}`).join(", ")}
            WHERE student_id = $${keys.length + 1}
            RETURNING *`;

        const values = [...Object.values(fields), student_id];

        const result = await pool.query(updateQuery, values);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Student not found" });
        }

        res.json({ message: "Student details updated successfully", student: result.rows[0] });
    } catch (error) {
        console.error("Error updating student details:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Update Student Enrollment
exports.updateStudentEnrollment = async (req, res) => {
    const { student_id } = req.body;
    const fields = req.body;
    const { school_code } = req.user;

    if (!student_id) {
        return res.status(400).json({ message: "Student ID is required" });
    }

    try {
        const checkStudentQuery = `
            SELECT s.school_code FROM students s
            JOIN student_enrollments se ON s.student_id = se.student_id
            WHERE s.student_id = $1
        `;
        const student = await pool.query(checkStudentQuery, [student_id]);

        if (student.rows.length === 0 || student.rows[0].school_code !== school_code) {
            return res.status(403).json({ message: "Unauthorized to update this student's enrollment" });
        }

        const keys = Object.keys(fields).filter(key => key !== "student_id");
        if (keys.length === 0) {
            return res.status(400).json({ message: "No fields to update" });
        }

        const updateQuery = `
            UPDATE student_enrollments
            SET ${keys.map((key, i) => `${key} = $${i + 1}`).join(", ")}
            WHERE student_id = $${keys.length + 1}
            RETURNING *
        `;
        const values = [...Object.values(fields).filter(val => val !== student_id), student_id];

        const result = await pool.query(updateQuery, values);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Enrollment record not found" });
        }

        res.json({ message: "Student enrollment updated successfully", enrollment: result.rows[0] });
    } catch (error) {
        console.error("Error updating student enrollment:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Update Student Bank Details
exports.updateStudentBankDetails = async (req, res) => {
    const { student_id } = req.body;
    const fields = req.body;
    const { school_code } = req.user;

    if (!student_id) {
        return res.status(400).json({ message: "Student ID is required" });
    }

    try {
        const checkStudentQuery = `
            SELECT school_code FROM students WHERE student_id = $1
        `;
        const student = await pool.query(checkStudentQuery, [student_id]);

        if (student.rows.length === 0 || student.rows[0].school_code !== school_code) {
            return res.status(403).json({ message: "Unauthorized to update this student's bank details" });
        }

        const keys = Object.keys(fields).filter(key => key !== "student_id");
        if (keys.length === 0) {
            return res.status(400).json({ message: "No fields to update" });
        }

        const updateQuery = `
            UPDATE bank_details
            SET ${keys.map((key, i) => `${key} = $${i + 1}`).join(", ")}
            WHERE student_id = $${keys.length + 1}
            RETURNING *
        `;
        const values = [...Object.values(fields).filter(val => val !== student_id), student_id];

        const result = await pool.query(updateQuery, values);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Bank details not found" });
        }

        res.json({ message: "Student bank details updated successfully", bankDetails: result.rows[0] });
    } catch (error) {
        console.error("Error updating student bank details:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getFullStudentDetails = async (req, res) => {
    // Get school_code from the JWT (req.user)
    const { school_code } = req.user;
    if (!school_code) {
      return res.status(403).json({ message: "Unauthorized: School code missing in token" });
    }
  
    // Get the student_id from route parameters (e.g., GET /students/full/:id)
    const { id } = req.params;
  
    try {
      // Get basic student details from the 'students' table
      const studentQuery = `
        SELECT * FROM students
        WHERE student_id = $1 AND school_code = $2
      `;
      const studentResult = await pool.query(studentQuery, [id, school_code]);
      if (studentResult.rows.length === 0) {
        return res.status(404).json({ message: "Student not found" });
      }
  
      // Get enrollment details from the 'student_enrollments' table
      const enrollmentQuery = `
        SELECT * FROM student_enrollments
        WHERE student_id = $1
      `;
      const enrollmentResult = await pool.query(enrollmentQuery, [id]);
  
      // Get family details from the 'family_details' table
      const familyQuery = `
        SELECT * FROM family_details
        WHERE student_id = $1
      `;
      const familyResult = await pool.query(familyQuery, [id]);
  
      // Get bank details from the 'bank_details' table
      const bankQuery = `
        SELECT * FROM bank_details
        WHERE student_id = $1
      `;
      const bankResult = await pool.query(bankQuery, [id]);
  
      // Combine all details into one response object
      const fullDetails = {
        student: studentResult.rows[0],
        enrollment: enrollmentResult.rows, // In case there is more than one enrollment record
        family_details: familyResult.rows,   // Array of family members
        bank_details: bankResult.rows.length > 0 ? bankResult.rows[0] : null,
      };
  
      return res.status(200).json({ student: fullDetails });
    } catch (error) {
      console.error("Error fetching full student details:", error);
      return res.status(500).json({ message: "Internal server error", error: error.message });
    }
  };
  exports.getAllStudents = async (req, res) => {
    // Get school_code from the JWT (req.user)
    const { school_code } = req.user;
    if (!school_code) {
      return res.status(403).json({ message: "Unauthorized: School code missing in token" });
    }
  
    try {
      const query = `
        SELECT student_id, first_name, last_name, gender, primary_contact 
        FROM students 
        WHERE school_code = $1
      `;
      const result = await pool.query(query, [school_code]);
  
      // Return the list of students (even if empty)
      res.status(200).json({ students: result.rows });
    } catch (error) {
      console.error("Error fetching students:", error);
      res.status(500).json({ message: "Internal server error", error: error.message });
    }
  };