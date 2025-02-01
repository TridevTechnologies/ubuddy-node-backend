exports.up = function (knex) {
    return knex.schema.createTable("promotion_mapping", (table) => {
      table.uuid("mapping_id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      table.uuid("school_id").references("id").inTable("schools").onDelete("CASCADE");
      table.uuid("from_session_id").references("session_id").inTable("academic_sessions");
      table.uuid("to_session_id").references("session_id").inTable("academic_sessions");
      table.jsonb("class_mapping").notNullable();
      table.timestamps(true, true);
    });
  };
  
  exports.down = function (knex) {
    return knex.schema.dropTable("promotion_mapping");
  };
  