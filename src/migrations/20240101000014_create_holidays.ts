import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('holidays', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('organization_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    table.date('date').notNullable();
    table.string('name').notNullable(); // e.g., "Ganesh Chaturthi", "Republic Day"
    table.string('type').defaultTo('holiday'); // holiday, half_day, event
    table.text('description').nullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

    table.unique(['organization_id', 'date']);
    table.index('organization_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('holidays');
}
