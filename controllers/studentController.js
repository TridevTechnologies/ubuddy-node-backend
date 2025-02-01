const pool = require("../config/db");

exports.createStudent = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN"); // Start transaction

        // Extract school_code from the logged-in user
        const school_code = req.user.role === "super_admin" ? req.body.school_code : req.user.school_code;

        // Ensure school_code is present (for super_admin case)
        if (!school_code) {
            return res.status(400).json({ message: "School code is required" });
        }

        const {
            first_name, middle_name, last_name, date_of_birth, gender,
            aadhar_number, sssmid, family_sssmid, apaar_id, pen, primary_contact,
            current_address, permanent_address, session_id, class_id, section_id,
            roll_number, admission_type, admission_date, previous_class, previous_school,
            family_details, bank_details
        } = req.body;

        // Insert into students table
        const studentQuery = `
            INSERT INTO students (
                school_code, first_name, middle_name, last_name, date_of_birth, gender,
                aadhar_number, sssmid, family_sssmid, apaar_id, pen, primary_contact,
                current_address, permanent_address
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING student_id`;
        
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

        // Insert into family_details table
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

        // Insert into bank_details table
        if (bank_details) {
            const bankQuery = `
                INSERT INTO bank_details (student_id, account_holder, account_number, ifsc_code)
                VALUES ($1, $2, $3, $4)`;
            await client.query(bankQuery, [
                student_id, bank_details.account_holder, bank_details.account_number, bank_details.ifsc_code
            ]);
        }

        await client.query("COMMIT"); // Commit transaction
        res.status(201).json({ message: "Student created successfully", student_id });
    } catch (error) {
        await client.query("ROLLBACK"); // Rollback on failure
        console.error("Error creating student:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    } finally {
        client.release();
    }
};
