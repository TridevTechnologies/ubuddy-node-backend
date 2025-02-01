exports.up = function (knex) {
    return knex.schema.createTable('users', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('name').notNullable();
      table.string('email').unique().notNullable();
      table.string('password').notNullable();
      table.uuid('school_id').references('id').inTable('schools').onDelete('CASCADE');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
  };
  
  exports.down = function (knex) {
    return knex.schema.dropTable('users');
  };
  