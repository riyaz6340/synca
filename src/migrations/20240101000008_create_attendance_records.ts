import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    `CREATE TYPE presence_status AS ENUM ('Present', 'Absent', 'Late', 'On_Leave')`
  );

  await knex.schema.createTable('attendance_records', (table) => {
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
    table
      .uuid('person_id')
      .notNullable()
      .references('id')
      .inTable('persons')
      .onDelete('CASCADE');
    table.date('date').notNullable();
    table.timestamp('time', { useTz: true }).nullable();
    table
      .specificType('presence_status', 'presence_status')
      .notNullable();
    table
      .uuid('recorded_by')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

    table.unique(['person_id', 'date']);
    table.index('organization_id');
    table.index(['organization_id', 'date']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('attendance_records');
  await knex.raw('DROP TYPE IF EXISTS presence_status');
}
