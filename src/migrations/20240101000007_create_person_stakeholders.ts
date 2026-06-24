import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('person_stakeholders', (table) => {
    table
      .uuid('person_id')
      .notNullable()
      .references('id')
      .inTable('persons')
      .onDelete('CASCADE');
    table
      .uuid('stakeholder_id')
      .notNullable()
      .references('id')
      .inTable('stakeholders')
      .onDelete('CASCADE');
    table.string('relationship').notNullable();

    table.primary(['person_id', 'stakeholder_id']);
    table.index('stakeholder_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('person_stakeholders');
}
