const db = require("../config/db");

exports.getSubjects = async (req, res) => {
    try {
        const { role, school_code: userSchoolCode } = req.user; // Extract from JWT
        const { school_code } = req.query; // school_code can be passed as a query param by super-admin

        let finalSchoolCode;

        if (role === "super_admin") {
            if (!school_code) {
                return res.status(400).json({ message: "Super Admin must provide a school_code" });
            }
            finalSchoolCode = school_code;
        } else {
            finalSchoolCode = userSchoolCode; // school_code is derived from the JWT for school-admin
        }

        if (!finalSchoolCode) {
            return res.status(400).json({ message: "Invalid school_code" });
        }

        const query = `SELECT id, name, code FROM subjects WHERE school_code = $1;`;
        const { rows } = await db.query(query, [finalSchoolCode]);

        res.status(200).json({ message: "Subjects fetched successfully", subjects: rows });
    } catch (error) {
        console.error("Error fetching subjects:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.createSubjects = async (req, res) => {
    try {
        const { role, school_code: userSchoolCode } = req.user; // Extract from JWT
        const { subjects } = req.body;  // school_code is not needed for school-admin

        if (role === "super_admin") {
            const { school_code } = req.body;  // school_code is required for super-admins
            if (!school_code) {
                return res.status(400).json({ message: "Super Admin must provide a school_code" });
            }
            if (school_code !== userSchoolCode) {
                return res.status(403).json({ message: "Unauthorized: Mismatched school code" });
            }
            finalSchoolCode = school_code;
        } else {
            finalSchoolCode = userSchoolCode; // Use the school_code from JWT
        }

        if (!finalSchoolCode || !subjects || !Array.isArray(subjects) || subjects.length === 0) {
            return res.status(400).json({ message: "Invalid request data" });
        }

        const values = subjects.map(sub => [finalSchoolCode, sub.name, sub.code]);

        const query = `
            INSERT INTO subjects (school_code, name, code)
            VALUES ${values.map(() => "($1, $2, $3)").join(",")}
            ON CONFLICT (school_code, code) DO NOTHING
            RETURNING *;
        `;

        const { rows } = await db.query(query, values.flat());

        res.status(201).json({ message: "Subjects created successfully", subjects: rows });
    } catch (error) {
        console.error("Error creating subjects:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
