exports.up = function (knex) {
    return knex.schema.createTable("student_academic_records", (table) => {
      table.uuid("record_id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      table.uuid("student_id").references("student_id").inTable("students").onDelete("CASCADE");
      table.uuid("session_id").references("session_id").inTable("academic_sessions");
      table.uuid("class_id").references("id").inTable("classes");
      table.string("section", 50);
      table.integer("roll_number");
      table.jsonb("subjects");
      table.jsonb("marks");
      table.string("final_grade", 5);
      table.string("promotion_status", 50);
      table.timestamps(true, true);
    });
  };
  
  exports.down = function (knex) {
    return knex.schema.dropTable("student_academic_records");
  };
  