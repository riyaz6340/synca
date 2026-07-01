import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('person_groups', (table) => {
    table.integer('roll_number').nullable();
  });

  // Add CHECK constraint: roll_number must be NULL or between 1 and 9999
  await knex.raw(`
    ALTER TABLE person_groups
    ADD CONSTRAINT roll_number_range
    CHECK (roll_number IS NULL OR (roll_number >= 1 AND roll_number <= 9999))
  `);

  // Add partial unique index: roll_number must be unique within a group (where not null)
  await knex.raw(`
    CREATE UNIQUE INDEX roll_number_unique_per_group
    ON person_groups (group_id, roll_number)
    WHERE roll_number IS NOT NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop the partial unique index
  await knex.raw('DROP INDEX IF EXISTS roll_number_unique_per_group');

  // Drop the CHECK constraint
  await knex.raw('ALTER TABLE person_groups DROP CONSTRAINT IF EXISTS roll_number_range');

  // Drop the column
  await knex.schema.alterTable('person_groups', (table) => {
    table.dropColumn('roll_number');
  });
}
