import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    `CREATE TYPE announcement_target_type AS ENUM ('Organization', 'Group', 'Person')`
  );

  await knex.schema.createTable('announcements', (table) => {
    table
      .uuid('id')
      .primary()
      .defaultTo(knex.raw('uuid_generate_v4()'));
    table
      .uuid('organization_id')
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table.string('title').notNullable();
    table.text('body').notNullable();
    table
      .specificType('target_type', 'announcement_target_type')
      .notNullable();
    table.specificType('target_ids', 'uuid[]').notNullable();
    table.timestamp('scheduled_at', { useTz: true }).nullable();
    table.timestamp('published_at', { useTz: true }).nullable();
    table
      .uuid('created_by')
      .nullable()
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

    table.index('organization_id');
    table.index(['organization_id', 'published_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('announcements');
  await knex.raw('DROP TYPE IF EXISTS announcement_target_type');
}
