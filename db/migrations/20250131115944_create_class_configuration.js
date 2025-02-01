exports.up = function (knex) {
  return knex.schema.createTable("class_configuration", (table) => {
    table.uuid("config_id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("class_id").references("id").inTable("classes").onDelete("CASCADE");
    table.jsonb("grading_system");
    table.jsonb("exam_pattern");
    table.jsonb("subjects");
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable("class_configuration");
};
