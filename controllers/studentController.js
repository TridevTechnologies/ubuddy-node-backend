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
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Validate student_id and school_code
    const { student_id } = req.body;
    if (!student_id) {
      return res.status(400).json({ message: "Student ID is required" });
    }

    // Check that the student exists and belongs to the correct school
    const checkStudentQuery = "SELECT school_code FROM students WHERE student_id = $1";
    const studentResult = await client.query(checkStudentQuery, [student_id]);
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ message: "Student not found" });
    }
    if (studentResult.rows[0].school_code !== req.user.school_code) {
      return res.status(403).json({ message: "Unauthorized: You can only update your school's students" });
    }

    // 2. Update the students table (Personal Details)
    // List only the allowed personal fields
    const personalFields = {
      first_name: req.body.first_name,
      middle_name: req.body.middle_name,
      last_name: req.body.last_name,
      date_of_birth: req.body.date_of_birth,
      gender: req.body.gender,
      aadhar_number: req.body.aadhar_number,
      sssmid: req.body.sssmid,
      family_sssmid: req.body.family_sssmid,
      apaar_id: req.body.apaar_id,
      pen: req.body.pen,
      primary_contact: req.body.primary_contact,
      current_address: req.body.current_address,
      permanent_address: req.body.permanent_address
    };

    // Build the update query dynamically for fields provided (non-undefined)
    const personalKeys = Object.keys(personalFields).filter(key => personalFields[key] !== undefined);
    if (personalKeys.length > 0) {
      const updatePersonalQuery = `
        UPDATE students
        SET ${personalKeys.map((key, i) => `${key} = $${i + 1}`).join(", ")}
        WHERE student_id = $${personalKeys.length + 1}
      `;
      const personalValues = [...personalKeys.map(key => personalFields[key]), student_id];
      await client.query(updatePersonalQuery, personalValues);
    }

    // 3. Update the student_enrollments table (Enrollment Details)
    // Allowed enrollment fields:
    const enrollmentFields = {
      session_id: req.body.session_id,
      class_id: req.body.class_id,
      section_id: req.body.section_id,
      roll_number: req.body.roll_number,
      admission_type: req.body.admission_type,
      admission_date: req.body.admission_date,
      previous_class: req.body.previous_class,
      previous_school: req.body.previous_school
    };

    const enrollmentKeys = Object.keys(enrollmentFields).filter(key => enrollmentFields[key] !== undefined);
    if (enrollmentKeys.length > 0) {
      const updateEnrollmentQuery = `
        UPDATE student_enrollments
        SET ${enrollmentKeys.map((key, i) => `${key} = $${i + 1}`).join(", ")}
        WHERE student_id = $${enrollmentKeys.length + 1}
      `;
      const enrollmentValues = [...enrollmentKeys.map(key => enrollmentFields[key]), student_id];
      const enrollmentResult = await client.query(updateEnrollmentQuery, enrollmentValues);

      // If no enrollment record was updated, insert one.
      if (enrollmentResult.rowCount === 0) {
        const insertEnrollmentQuery = `
          INSERT INTO student_enrollments (student_id, ${enrollmentKeys.join(", ")})
          VALUES ($1, ${enrollmentKeys.map((_, i) => "$" + (i + 2)).join(", ")})
        `;
        const insertValues = [student_id, ...enrollmentKeys.map(key => enrollmentFields[key])];
        await client.query(insertEnrollmentQuery, insertValues);
      }
    }

    // 4. Update Family Details
    // For simplicity, we delete all existing family details and then insert the new ones.
    if (Array.isArray(req.body.family_details)) {
      await client.query(`DELETE FROM family_details WHERE student_id = $1`, [student_id]);

      for (const family of req.body.family_details) {
        const familyQuery = `
          INSERT INTO family_details (student_id, relation, name, aadhar_number, occupation, annual_income)
          VALUES ($1, $2, $3, $4, $5, $6)
        `;
        await client.query(familyQuery, [
          student_id,
          family.relation,
          family.name,
          family.aadhar_number,
          family.occupation,
          family.annual_income
        ]);
      }
    }

    // 5. Update Bank Details
    // If bank_details is provided, update if a record exists; otherwise, insert.
    if (req.body.bank_details) {
      const { account_holder, account_number, ifsc_code } = req.body.bank_details;
      const updateBankQuery = `
        UPDATE bank_details
        SET account_holder = $1, account_number = $2, ifsc_code = $3
        WHERE student_id = $4
      `;
      const bankResult = await client.query(updateBankQuery, [account_holder, account_number, ifsc_code, student_id]);
      if (bankResult.rowCount === 0) {
        const insertBankQuery = `
          INSERT INTO bank_details (student_id, account_holder, account_number, ifsc_code)
          VALUES ($1, $2, $3, $4)
        `;
        await client.query(insertBankQuery, [student_id, account_holder, account_number, ifsc_code]);
      }
    }

    await client.query("COMMIT");
    res.json({ message: "Student details updated successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating student details:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  } finally {
    client.release();
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

    // For each enrollment, if class_id or section_id is present, fetch their names.
    for (const enrollment of enrollmentResult.rows) {
      if (enrollment.class_id) {
        const classQuery = `SELECT name FROM classes WHERE id = $1`;
        const classResult = await pool.query(classQuery, [enrollment.class_id]);
        if (classResult.rowCount > 0) {
          enrollment.class_name = classResult.rows[0].name;
        }
      }
      if (enrollment.section_id) {
        const sectionQuery = `SELECT name FROM sections WHERE id = $1`;
        const sectionResult = await pool.query(sectionQuery, [enrollment.section_id]);
        if (sectionResult.rowCount > 0) {
          enrollment.section_name = sectionResult.rows[0].name;
        }
      }
    }

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
      enrollment: enrollmentResult.rows, // enrollment details with class_name and section_name (if available)
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
      school_code = req.user.school_code;
      const { session_id } = req.body; // Get session_id from the request body
      if (!school_code || !session_id) {
        return res.status(400).json({ message: "Invalid school_code or session_id" });
      }
  
      const query = `
        SELECT 
          se.enrollment_id,
          s.student_id,
          s.first_name,
          s.last_name,
          s.status,
          se.roll_number,
          c.name AS class_name,
          se.class_id,
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'subject_id', sub.id,
                'name', sub.name,
                'code', sub.code
              )
            ) FILTER (WHERE sub.id IS NOT NULL),
            '[]'
          ) AS additional_subjects
        FROM student_enrollments se
        JOIN students s ON se.student_id = s.student_id
        JOIN classes c ON se.class_id = c.id
        LEFT JOIN student_additional_subjects sas ON se.enrollment_id = sas.enrollment_id
        LEFT JOIN subjects sub ON sas.subject_id = sub.id
        WHERE s.school_code = $1
          AND se.session_id = $2
        GROUP BY se.enrollment_id, s.student_id, s.first_name, s.last_name, s.status, se.roll_number, c.name, se.class_id
      `;
      console.log("Executing Query:", query, "With school_code:", school_code, "and session_id:", session_id);
      const result = await client.query(query, [school_code, session_id]); // Pass session_id in the query
      res.status(200).json({ students: result.rows });
    } catch (error) {
      console.error("Error fetching student enrollment details:", error);
      res.status(500).json({ message: "Internal server error", error: error.message });
    } finally {
      client.release();
    }
  };
  

// controllers/studentAdditionalSubjects.js
exports.getNonCompulsorySubjects = async (req, res) => {
    const client = await pool.connect();
    try {
      const { class_id } = req.query;
      if (!class_id) {
        return res.status(400).json({ message: "class_id is required" });
      }
      const query = `
        SELECT s.id, s.name, s.code
        FROM class_subjects cs
        JOIN subjects s ON cs.subject_id = s.id
        WHERE cs.class_id = $1 
          AND cs.is_compulsory = false
      `;
      const result = await client.query(query, [class_id]);
      res.status(200).json({ subjects: result.rows });
    } catch (error) {
      console.error("Error fetching non-compulsory subjects:", error);
      res.status(500).json({ message: "Internal server error", error: error.message });
    } finally {
      client.release();
    }
  };

  exports.unassignAdditionalSubject = async (req, res) => {
    const client = await pool.connect();
    try {
      const { enrollment_id, subject_id } = req.body;
      if (!enrollment_id || !subject_id) {
        return res.status(400).json({ message: "enrollment_id and subject_id are required" });
      }
      
      const deleteQuery = `
        DELETE FROM student_additional_subjects
        WHERE enrollment_id = $1 AND subject_id = $2
      `;
      const deleteResult = await client.query(deleteQuery, [enrollment_id, subject_id]);
      if (deleteResult.rowCount === 0) {
        return res.status(404).json({ message: "No such additional subject assigned for this enrollment" });
      }
      
      res.status(200).json({ message: "Additional subject unassigned" });
    } catch (error) {
      console.error("Error unassigning additional subject:", error);
      res.status(500).json({ message: "Internal server error", error: error.message });
    } finally {
      client.release();
    }
  };

  exports.assignAdditionalSubject = async (req, res) => {
    const client = await pool.connect();
    try {
      const { enrollment_id, class_id, subject_id } = req.body;
      console.log("assignAdditionalSubject called with:", { enrollment_id, class_id, subject_id });
      if (!enrollment_id || !class_id || !subject_id) {
        return res.status(400).json({ 
          message: "enrollment_id, class_id, and subject_id are required",
          received: { enrollment_id, class_id, subject_id }
        });
      }
      
      const checkQuery = `
        SELECT * FROM student_additional_subjects
        WHERE enrollment_id = $1 AND subject_id = $2
      `;
      console.log("Running checkQuery with:", [enrollment_id, subject_id]);
      const checkResult = await client.query(checkQuery, [enrollment_id, subject_id]);
      if (checkResult.rowCount > 0) {
        return res.status(400).json({ message: "Subject already assigned to this enrollment" });
      }
      
      const insertQuery = `
        INSERT INTO student_additional_subjects (enrollment_id, class_id, subject_id)
        VALUES ($1, $2, $3)
        RETURNING id
      `;
      console.log("Running insertQuery with:", [enrollment_id, class_id, subject_id]);
      const insertResult = await client.query(insertQuery, [enrollment_id, class_id, subject_id]);
      res.status(201).json({ message: "Additional subject assigned", id: insertResult.rows[0].id });
    } catch (error) {
      console.error("Error assigning additional subject:", error);
      res.status(500).json({ message: "Internal server error", error: error.message });
    } finally {
      client.release();
    }
  };
  