import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    `CREATE TYPE leave_request_status AS ENUM ('Pending', 'Approved', 'Rejected')`
  );

  await knex.schema.createTable('leave_requests', (table) => {
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
    table
      .uuid('requested_by')
      .notNullable()
      .references('id')
      .inTable('stakeholders')
      .onDelete('CASCADE');
    table.date('start_date').notNullable();
    table.date('end_date').notNullable();
    table.text('reason').notNullable();
    table
      .specificType('status', 'leave_request_status')
      .notNullable()
      .defaultTo('Pending');
    table
      .uuid('reviewed_by')
      .nullable()
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.text('review_comment').nullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

    table.index('organization_id');
    table.index(['organization_id', 'status']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('leave_requests');
  await knex.raw('DROP TYPE IF EXISTS leave_request_status');
}
