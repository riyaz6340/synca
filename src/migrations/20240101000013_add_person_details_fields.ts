import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('persons', (table) => {
    // Student identification
    table.string('roll_number').nullable();
    table.string('admission_number').nullable();

    // Personal details
    table.integer('age').nullable();
    table.string('gender').nullable(); // Male, Female, Other
    table.string('date_of_birth').nullable(); // YYYY-MM-DD
    table.string('blood_group').nullable(); // A+, A-, B+, B-, O+, O-, AB+, AB-

    // Family details
    table.string('father_name').nullable();
    table.string('mother_name').nullable();
    table.string('guardian_name').nullable();
    table.string('guardian_relation').nullable(); // Father, Mother, Uncle, etc.

    // Contact details
    table.string('parent_mobile').nullable();
    table.string('parent_email').nullable();
    table.text('address').nullable();

    // Index for quick lookups
    table.index(['organization_id', 'roll_number']);
    table.index(['organization_id', 'admission_number']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('persons', (table) => {
    table.dropIndex(['organization_id', 'roll_number']);
    table.dropIndex(['organization_id', 'admission_number']);
    table.dropColumn('roll_number');
    table.dropColumn('admission_number');
    table.dropColumn('age');
    table.dropColumn('gender');
    table.dropColumn('date_of_birth');
    table.dropColumn('blood_group');
    table.dropColumn('father_name');
    table.dropColumn('mother_name');
    table.dropColumn('guardian_name');
    table.dropColumn('guardian_relation');
    table.dropColumn('parent_mobile');
    table.dropColumn('parent_email');
    table.dropColumn('address');
  });
}
