import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('push_subscriptions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('organization_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    table.text('endpoint').notNullable();
    table.text('p256dh').notNullable();
    table.text('auth').notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

    table.unique(['user_id', 'endpoint']);
    table.index('user_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('push_subscriptions');
}
