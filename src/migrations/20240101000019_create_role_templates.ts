import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('role_templates', (table) => {
    table
      .uuid('id')
      .primary()
      .defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name', 100).notNullable();
    table
      .uuid('organization_id')
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

    table.unique(['name', 'organization_id']);
  });

  await knex.schema.createTable('template_permissions', (table) => {
    table
      .uuid('template_id')
      .notNullable()
      .references('id')
      .inTable('role_templates')
      .onDelete('CASCADE');
    table.string('permission_name', 50).notNullable();

    table.primary(['template_id', 'permission_name']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('template_permissions');
  await knex.schema.dropTableIfExists('role_templates');
}
