import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add Teacher to the user_role enum
  // ALTER TYPE ... ADD VALUE is non-transactional in PostgreSQL,
  // so it cannot be rolled back. IF NOT EXISTS ensures idempotency.
  await knex.raw(`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Teacher'`);
}

export async function down(knex: Knex): Promise<void> {
  // PostgreSQL doesn't support removing values from enums easily.
  // This is a no-op for down migration, matching the pattern used
  // for the SuperAdmin enum extension.
}
