exports.up = function (knex) {
    return knex.schema.createTable("academic_sessions", (table) => {
      table.uuid("session_id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      table.uuid("school_id").references("id").inTable("schools").onDelete("CASCADE");
      table.string("name", 9).notNullable().checkRegex("name ~ '^\d{4}-\d{4}$'");
      table.date("start_date").notNullable();
      table.date("end_date").notNullable();
      table.boolean("is_active").defaultTo(false);
      table.unique(["school_id", "name"]);
    });
  };
  
  exports.down = function (knex) {
    return knex.schema.dropTable("academic_sessions");
  };
  