import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('user_role_templates', (table) => {
    table
      .uuid('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table
      .uuid('template_id')
      .notNullable()
      .references('id')
      .inTable('role_templates')
      .onDelete('RESTRICT');
    table.timestamp('assigned_at', { useTz: true }).defaultTo(knex.fn.now());

    table.primary(['user_id', 'template_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_role_templates');
}
