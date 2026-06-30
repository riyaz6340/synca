import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('audit_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
    table.uuid('user_id').nullable(); // who performed the action
    table.string('action', 50).notNullable(); // CREATE, UPDATE, DELETE, LOGIN, LOGOUT, PASSWORD_CHANGE
    table.string('entity_type', 50).notNullable(); // person, group, attendance, leave_request, announcement, user
    table.uuid('entity_id').nullable(); // the affected record
    table.jsonb('details').defaultTo('{}'); // extra context (old values, new values, etc.)
    table.string('ip_address', 50).nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Index for querying by org + time
  await knex.schema.raw('CREATE INDEX idx_audit_logs_org_time ON audit_logs (organization_id, created_at DESC)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('audit_logs');
}
