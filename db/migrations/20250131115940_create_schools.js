exports.up = function (knex) {
    return knex.schema.createTable('schools', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('name').notNullable();
      table.string('address');
      table.string('email').unique();
      table.string('phone').unique();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
  };
  
  exports.down = function (knex) {
    return knex.schema.dropTable('schools');
  };
  