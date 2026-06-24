import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    `CREATE TYPE delivery_status AS ENUM ('Pending', 'Sent', 'Failed')`
  );

  await knex.schema.createTable('notifications', (table) => {
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
      .uuid('stakeholder_id')
      .notNullable()
      .references('id')
      .inTable('stakeholders')
      .onDelete('CASCADE');
    table.string('type').notNullable();
    table.string('title').notNullable();
    table.text('body').notNullable();
    table.string('channel_used').notNullable();
    table
      .specificType('delivery_status', 'delivery_status')
      .notNullable()
      .defaultTo('Pending');
    table.timestamp('sent_at', { useTz: true }).nullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

    table.index('organization_id');
    table.index('stakeholder_id');
    table.index(['stakeholder_id', 'delivery_status']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('notifications');
  await knex.raw('DROP TYPE IF EXISTS delivery_status');
}
