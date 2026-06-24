import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add SuperAdmin to the user_role enum
  await knex.raw(`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'SuperAdmin'`);

  // Add subscription fields to organizations table
  await knex.schema.alterTable('organizations', (table) => {
    table.string('plan').defaultTo('free'); // free, starter, growth, premium
    table.decimal('monthly_amount', 10, 2).defaultTo(0);
    table.string('billing_status').defaultTo('active'); // active, trial, expired, cancelled
    table.timestamp('trial_ends_at', { useTz: true }).nullable();
    table.timestamp('subscription_started_at', { useTz: true }).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('organizations', (table) => {
    table.dropColumn('plan');
    table.dropColumn('monthly_amount');
    table.dropColumn('billing_status');
    table.dropColumn('trial_ends_at');
    table.dropColumn('subscription_started_at');
  });
  // Note: PostgreSQL doesn't support removing values from enums easily
}
