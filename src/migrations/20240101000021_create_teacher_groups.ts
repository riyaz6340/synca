import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('teacher_groups', (table) => {
    table
      .uuid('teacher_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table
      .uuid('group_id')
      .notNullable()
      .references('id')
      .inTable('groups')
      .onDelete('CASCADE');
    table.timestamp('assigned_at', { useTz: true }).defaultTo(knex.fn.now());

    table.primary(['teacher_id', 'group_id']);
    table.index('group_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('teacher_groups');
}
