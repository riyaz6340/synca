import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Subjects table — subjects specific to a class/group
  await knex.schema.createTable('subjects', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('organization_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    table.uuid('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE');
    table.string('name').notNullable(); // e.g., "Mathematics", "English", "Science"
    table.string('teacher_name').nullable();
    table.integer('period_number').nullable(); // 1, 2, 3... for ordering
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

    table.index(['organization_id', 'group_id']);
  });

  // Add optional subject_id and period to attendance_records
  await knex.schema.alterTable('attendance_records', (table) => {
    table.uuid('subject_id').nullable().references('id').inTable('subjects').onDelete('SET NULL');
    table.string('period_label').nullable(); // "Full Day", "Period 1", "Period 2", etc.
  });

  // Drop the unique constraint on (person_id, date) and recreate with subject_id
  // This allows multiple records per person per day (one per period)
  await knex.raw('ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_records_person_id_date_unique');
  await knex.raw('CREATE UNIQUE INDEX attendance_records_person_date_period ON attendance_records (person_id, date, COALESCE(subject_id, \'00000000-0000-0000-0000-000000000000\'))');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS attendance_records_person_date_period');
  await knex.schema.alterTable('attendance_records', (table) => {
    table.dropColumn('subject_id');
    table.dropColumn('period_label');
  });
  await knex.schema.dropTableIfExists('subjects');
}
