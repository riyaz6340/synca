import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('leave_requests', (table) => {
    // Add reviewer_role to record whether Admin or Teacher reviewed the request
    table.string('reviewer_role', 50).nullable();
    // Add reviewed_at to record the exact timestamp of the review decision
    table.timestamp('reviewed_at', { useTz: true }).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('leave_requests', (table) => {
    table.dropColumn('reviewer_role');
    table.dropColumn('reviewed_at');
  });
}
