exports.createClassSubjects = async (req, res) => {
    try {
        const { role, school_code: userSchoolCode } = req.user; // Extract from JWT
        const { school_code, class_id, subjects } = req.body;

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

        if (!finalSchoolCode || !class_id || !subjects || !Array.isArray(subjects) || subjects.length === 0) {
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

            const values = subjects.map(sub => [
                class_id, sub.subject_id, sub.is_compulsory, sub.is_result_subject, sub.is_daily_schedule, sub.is_timetable
            ]);

            const query = `
                INSERT INTO class_subjects (class_id, subject_id, is_compulsory, is_result_subject, is_daily_schedule, is_timetable)
                VALUES ${values.map(() => "($1, $2, $3, $4, $5, $6)").join(",")}
                ON CONFLICT (class_id, subject_id) DO UPDATE SET 
                    is_compulsory = EXCLUDED.is_compulsory,
                    is_result_subject = EXCLUDED.is_result_subject,
                    is_daily_schedule = EXCLUDED.is_daily_schedule,
                    is_timetable = EXCLUDED.is_timetable
                RETURNING *;
            `;

            const { rows } = await client.query(query, values.flat());

            res.status(201).json({ message: "Subjects allocated to class successfully", classSubjects: rows });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Error allocating subjects to class:", error);
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
                `SELECT cs.id, cs.class_id, cs.subject_id, s.name AS subject_name, 
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
