exports.up = function (knex) {
    return knex.schema.createTable("documents", (table) => {
      table.uuid("doc_id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      table.uuid("student_id").references("student_id").inTable("students").onDelete("CASCADE");
      table.enu("doc_type", ["transfer_certificate", "admit_card", "mark_sheet"]).notNullable();
      table.jsonb("content").notNullable();
      table.timestamp("generated_at").defaultTo(knex.fn.now());
      table.uuid("generated_by").references("id").inTable("users");
    });
  };
  
  exports.down = function (knex) {
    return knex.schema.dropTable("documents");
  };
  