import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('user_activity_events', (table) => {
    table
      .uuid('id')
      .primary()
      .defaultTo(knex.raw('uuid_generate_v4()'));
    table
      .uuid('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table
      .uuid('organization_id')
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table.string('action_type', 100).notNullable();
    table.string('endpoint', 255).notNullable();
    table.timestamp('timestamp', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Index on (timestamp, user_id) for aggregation queries (DAU/WAU/MAU/YAU)
    table.index(['timestamp', 'user_id'], 'idx_activity_events_timestamp_user');
    // Index on (organization_id, timestamp) for org-scoped analytics
    table.index(['organization_id', 'timestamp'], 'idx_activity_events_org_timestamp');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_activity_events');
}
