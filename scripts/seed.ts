/**
 * Database Seed Script
 * Creates the first organization and admin user for production deployment.
 *
 * Usage:
 *   npx ts-node scripts/seed.ts
 *
 * Environment variables required: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
 */

import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcrypt';
import knex from 'knex';

const SALT_ROUNDS = 12;

const db = knex({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'avento_dev',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  },
});

async function seed() {
  console.log('🌱 Seeding database...\n');

  // Configuration — change these values for your deployment
  const ORG_NAME = process.env.SEED_ORG_NAME || 'Demo School';
  const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@demo.school';
  const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@123456';

  // 1. Create Organization
  const [org] = await db('organizations')
    .insert({
      name: ORG_NAME,
      industry_module: 'school',
      metadata: JSON.stringify({}),
    })
    .returning('*');

  console.log(`✅ Organization created: "${org.name}" (ID: ${org.id})`);

  // 2. Create Admin User
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);

  const [admin] = await db('users')
    .insert({
      organization_id: org.id,
      email: ADMIN_EMAIL,
      password_hash: passwordHash,
      role: 'Admin',
    })
    .returning('*');

  console.log(`✅ Admin user created: "${admin.email}" (ID: ${admin.id})`);

  // 3. Create a sample stakeholder user (parent)
  const parentEmail = process.env.SEED_PARENT_EMAIL || 'parent@demo.school';
  const parentPassword = process.env.SEED_PARENT_PASSWORD || 'Parent@123456';
  const parentPasswordHash = await bcrypt.hash(parentPassword, SALT_ROUNDS);

  const [parentUser] = await db('users')
    .insert({
      organization_id: org.id,
      email: parentEmail,
      password_hash: parentPasswordHash,
      role: 'Stakeholder',
    })
    .returning('*');

  const [stakeholder] = await db('stakeholders')
    .insert({
      organization_id: org.id,
      user_id: parentUser.id,
      name: 'Demo Parent',
      communication_channels: JSON.stringify([
        { type: 'email', config: { address: parentEmail }, priority: 1 },
      ]),
    })
    .returning('*');

  console.log(`✅ Parent user created: "${parentEmail}" (ID: ${parentUser.id})`);

  // 4. Create a sample group
  const [group] = await db('groups')
    .insert({
      organization_id: org.id,
      name: 'Class 1A',
      description: 'First grade, section A',
    })
    .returning('*');

  console.log(`✅ Group created: "${group.name}" (ID: ${group.id})`);

  // 5. Create a sample person (student)
  const [person] = await db('persons')
    .insert({
      organization_id: org.id,
      name: 'John Doe',
      contact_info: JSON.stringify({ phone: '+1234567890' }),
      metadata: JSON.stringify({ roll_number: '001' }),
      is_active: true,
    })
    .returning('*');

  console.log(`✅ Person created: "${person.name}" (ID: ${person.id})`);

  // 6. Link person to group
  await db('person_groups').insert({
    person_id: person.id,
    group_id: group.id,
  });

  console.log(`✅ Person linked to group: "${person.name}" → "${group.name}"`);

  // 7. Link person to stakeholder
  await db('person_stakeholders').insert({
    person_id: person.id,
    stakeholder_id: stakeholder.id,
    relationship: 'parent',
  });

  console.log(`✅ Stakeholder linked to person: "Demo Parent" → "${person.name}"`);

  console.log('\n🎉 Seed complete!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Login Credentials:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Admin:  ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`  Parent: ${parentEmail} / ${parentPassword}`);
  console.log(`  Org ID: ${org.id}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await db.destroy();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
