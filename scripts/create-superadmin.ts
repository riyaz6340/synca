/**
 * Create SuperAdmin Account
 * 
 * Creates the platform founder/super admin account.
 * This user can see all organizations and platform-wide statistics.
 *
 * Usage:
 *   npx ts-node scripts/create-superadmin.ts
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
    password: process.env.DB_PASSWORD || 'admin',
  },
});

async function createSuperAdmin() {
  const email = process.env.SUPERADMIN_EMAIL || 'founder@avento.app';
  const password = process.env.SUPERADMIN_PASSWORD || 'Founder@2024';

  console.log('🔐 Creating SuperAdmin account...\n');

  // SuperAdmin needs an organization_id (we'll use the first one, or create a platform org)
  let platformOrg = await db('organizations').where('name', 'Avento Platform').first();

  if (!platformOrg) {
    [platformOrg] = await db('organizations')
      .insert({
        name: 'Avento Platform',
        industry_module: 'platform',
        metadata: JSON.stringify({ is_platform_org: true }),
      })
      .returning('*');
    console.log(`✅ Platform organization created (ID: ${platformOrg.id})`);
  }

  // Check if SuperAdmin already exists
  const existing = await db('users').where('email', email).first();
  if (existing) {
    console.log(`⚠️  User "${email}" already exists. Updating role to SuperAdmin...`);
    await db('users').where('id', existing.id).update({ role: 'SuperAdmin' });
    console.log('✅ Role updated to SuperAdmin');
  } else {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const [user] = await db('users')
      .insert({
        organization_id: platformOrg.id,
        email,
        password_hash: passwordHash,
        role: 'SuperAdmin',
      })
      .returning('*');
    console.log(`✅ SuperAdmin created (ID: ${user.id})`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  SuperAdmin Credentials:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Email:  ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`  Org ID: ${platformOrg.id}`);
  console.log(`  URL: http://localhost:5174/login`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await db.destroy();
}

createSuperAdmin().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
