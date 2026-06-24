import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('person_groups', (table) => {
    table
      .uuid('person_id')
      .notNullable()
      .references('id')
      .inTable('persons')
      .onDelete('CASCADE');
    table
      .uuid('group_id')
      .notNullable()
      .references('id')
      .inTable('groups')
      .onDelete('CASCADE');
    table.timestamp('assigned_at', { useTz: true }).defaultTo(knex.fn.now());

    table.primary(['person_id', 'group_id']);
    table.index('group_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('person_groups');
}
