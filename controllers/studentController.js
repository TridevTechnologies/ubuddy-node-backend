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
  // Fetch the currently assigned roll number for a student
exports.getRollNumber = async (req, res) => {
    const client = await pool.connect();
    try {
      const { student_id } = req.params; // e.g., GET /api/student-enrollments/:student_id/roll-number
      const query = 'SELECT roll_number FROM student_enrollments WHERE student_id = $1';
      const result = await client.query(query, [student_id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ message: 'Enrollment not found for this student' });
      }
      res.status(200).json({ roll_number: result.rows[0].roll_number });
    } catch (error) {
      console.error("Error fetching roll number:", error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    } finally {
      client.release();
    }
  };
  
  // Update (or assign) the roll number for a student
  exports.updateRollNumber = async (req, res) => {
    const client = await pool.connect();
    try {
      const { student_id } = req.params; // e.g., PUT /api/student-enrollments/:student_id/roll-number
      const { roll_number } = req.body;
      if (!roll_number) {
        return res.status(400).json({ message: 'Roll number is required' });
      }
      await client.query('BEGIN');
      // Check if the enrollment record exists
      const selectQuery = 'SELECT roll_number FROM student_enrollments WHERE student_id = $1';
      const selectResult = await client.query(selectQuery, [student_id]);
      if (selectResult.rowCount === 0) {
        return res.status(404).json({ message: 'Enrollment not found for this student' });
      }
      // Update the roll number regardless of its previous value
      const updateQuery = 'UPDATE student_enrollments SET roll_number = $1 WHERE student_id = $2';
      await client.query(updateQuery, [roll_number, student_id]);
      await client.query('COMMIT');
      res.status(200).json({ message: 'Roll number updated successfully', roll_number });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error("Error updating roll number:", error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    } finally {
      client.release();
    }
  };

  exports.updateClass = async (req, res) => {
    const client = await pool.connect();
    try {
      const { student_id } = req.params; // e.g., PUT /api/student-enrollments/:student_id/class
      const { class_id } = req.body;
      if (!class_id) {
        return res.status(400).json({ message: 'Class ID is required' });
      }
      await client.query('BEGIN');
      const selectQuery = 'SELECT class_id FROM student_enrollments WHERE student_id = $1';
      const selectResult = await client.query(selectQuery, [student_id]);
      if (selectResult.rowCount === 0) {
        return res.status(404).json({ message: 'Enrollment not found for this student' });
      }
      const updateQuery = 'UPDATE student_enrollments SET class_id = $1 WHERE student_id = $2';
      await client.query(updateQuery, [class_id, student_id]);
      await client.query('COMMIT');
      res.status(200).json({ message: 'Class updated successfully', class_id });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error("Error updating class:", error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    } finally {
      client.release();
    }
  };

  exports.getClass = async (req, res) => {
    const client = await pool.connect();
    try {
      const { student_id } = req.params; // e.g., GET /api/student-enrollments/:student_id/class
  
      // First, get the class_id for the student from the enrollment record
      const enrollmentQuery = 'SELECT class_id FROM student_enrollments WHERE student_id = $1';
      const enrollmentResult = await client.query(enrollmentQuery, [student_id]);
      if (enrollmentResult.rowCount === 0) {
        return res.status(404).json({ message: 'Enrollment not found for this student' });
      }
  
      const class_id = enrollmentResult.rows[0].class_id;
      
      // If there is no class assigned, return accordingly
      if (!class_id) {
        return res.status(200).json({ message: 'No class assigned', class_id: null, class_name: null });
      }
  
      // Now, retrieve the class name from the classes table using the class_id
      const classQuery = 'SELECT name FROM classes WHERE id = $1';
      const classResult = await client.query(classQuery, [class_id]);
      if (classResult.rowCount === 0) {
        return res.status(404).json({ message: 'Class not found for the given class_id' });
      }
  
      const class_name = classResult.rows[0].name;
  
      res.status(200).json({ class_id, class_name });
    } catch (error) {
      console.error("Error fetching class:", error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    } finally {
      client.release();
    }
  };

  exports.updateSection = async (req, res) => {
    const client = await pool.connect();
    try {
      const { student_id } = req.params; // e.g., PUT /api/student-enrollments/:student_id/section
      const { section_id } = req.body;
      if (!section_id) {
        return res.status(400).json({ message: 'Section ID is required' });
      }
      await client.query('BEGIN');
      const selectQuery = 'SELECT section_id FROM student_enrollments WHERE student_id = $1';
      const selectResult = await client.query(selectQuery, [student_id]);
      if (selectResult.rowCount === 0) {
        return res.status(404).json({ message: 'Enrollment not found for this student' });
      }
      const updateQuery = 'UPDATE student_enrollments SET section_id = $1 WHERE student_id = $2';
      await client.query(updateQuery, [section_id, student_id]);
      await client.query('COMMIT');
      res.status(200).json({ message: 'Section updated successfully', section_id });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error("Error updating section:", error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    } finally {
      client.release();
    }
  };

  exports.getSection = async (req, res) => {
    const client = await pool.connect();
    try {
      const { student_id } = req.params; // e.g., GET /api/student-enrollments/:student_id/section
  
      // First, get the section_id for the student from the enrollment record
      const enrollmentQuery = 'SELECT section_id FROM student_enrollments WHERE student_id = $1';
      const enrollmentResult = await client.query(enrollmentQuery, [student_id]);
      if (enrollmentResult.rowCount === 0) {
        return res.status(404).json({ message: 'Enrollment not found for this student' });
      }
  
      const section_id = enrollmentResult.rows[0].section_id;
      
      // If there is no section assigned, return accordingly
      if (!section_id) {
        return res.status(200).json({ message: 'No section assigned', section_id: null, section_name: null });
      }
  
      // Retrieve the section name from the sections table using the section_id
      const sectionQuery = 'SELECT name FROM sections WHERE id = $1';
      const sectionResult = await client.query(sectionQuery, [section_id]);
      if (sectionResult.rowCount === 0) {
        return res.status(404).json({ message: 'Section not found for the given section_id' });
      }
  
      const section_name = sectionResult.rows[0].name;
  
      res.status(200).json({ section_id, section_name });
    } catch (error) {
      console.error("Error fetching section:", error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    } finally {
      client.release();
    }
  };
  exports.getAllEnrolledStudents = async (req, res) => {
    const client = await pool.connect();
    try {
        const { school_code } = req.user;

        // Ensure the school_code exists
        if (!school_code) {
            return res.status(400).json({ message: "Invalid school_code" });
        }

        // Your query to fetch student details
        const query = `
            SELECT 
                s.student_id,
                s.first_name,
                s.last_name,
                s.status,
                se.roll_number,
                c.name AS class_name
            FROM student_enrollments se
            JOIN students s ON se.student_id = s.student_id
            JOIN classes c ON se.class_id = c.id
            WHERE s.school_code = $1
        `;

        console.log("Executing Query:", query, "With school_code:", school_code);

        // Execute the query with school_code as parameter
        const result = await client.query(query, [school_code]);

        // Return the result
        res.status(200).json({ students: result.rows });
    } catch (error) {
        console.error("Error fetching student enrollment details:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    } finally {
        client.release(); // Ensure client release
    }
};
