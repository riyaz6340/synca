# Deploy Arixx — Free Forever (Render + Neon + Vercel)

## Architecture
```
[Vercel - Frontend]  →  [Render - Backend API]  →  [Neon - PostgreSQL]
     (Free)                   (Free)                    (Free, no expiry)
```

**Total cost: $0/month, forever** (no trial, no expiry, no credit card needed)

---

## Step 1: Create Neon PostgreSQL (2 min)

Neon gives you a **free Postgres database that never expires** (0.5GB storage, more than enough for thousands of students).

1. Go to **https://neon.tech** → Sign up (GitHub login works)
2. Click **"Create Project"**
   - Project name: `arixx`
   - Region: **Asia (Singapore)** or closest to you
   - Postgres version: 16 (default)
3. Click **"Create"**
4. You'll see a connection string like:
   ```
   postgresql://neondb_owner:abc123@ep-cool-name-12345.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
5. **Parse it into parts** (you'll need these for Render):
   - `DB_HOST` = `ep-cool-name-12345.ap-southeast-1.aws.neon.tech`
   - `DB_PORT` = `5432`
   - `DB_NAME` = `neondb`
   - `DB_USER` = `neondb_owner`
   - `DB_PASSWORD` = `abc123` (the part between `:` and `@`)

**Important:** Keep `?sslmode=require` in mind — our app already handles SSL for production.

---

## Step 2: Deploy Backend on Render (5 min)

1. Go to **https://render.com** → Sign in with GitHub
2. Click **"New +"** → **"Web Service"**
3. Connect your **`riyaz6340/synca`** repo
4. Configure:
   - **Name:** `avento-api`
   - **Region:** Singapore (same as Neon)
   - **Branch:** `main`
   - **Root Directory:** *(leave empty)*
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run migrate && node dist/index.js`
   - **Instance Type:** **Free**

5. Click **"Advanced"** → add **Environment Variables**:

```
NODE_ENV=production
PORT=10000
DB_HOST=ep-cool-name-12345.ap-southeast-1.aws.neon.tech
DB_PORT=5432
DB_NAME=neondb
DB_USER=neondb_owner
DB_PASSWORD=<your-neon-password>
JWT_SECRET=<generate: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
JWT_EXPIRES_IN=30d
VAPID_PUBLIC_KEY=BBrdGA6XIcbxcug7cF6tTNhnFakSulGl-aWLQ7u01SusorK6D9uLkVnjewEjTXTasboj-cJuCX3vmJdQTIT-lf8
VAPID_PRIVATE_KEY=CGpXlqoQBx_N6yiuyebhkLpXQg8zjSp4DK3L0pkW6-U
VAPID_SUBJECT=mailto:admin@arixx.app
CORS_ORIGINS=https://synca.vercel.app
REDIS_HOST=
REDIS_PORT=6379
REDIS_PASSWORD=
```

6. Click **"Create Web Service"**
7. Wait for build (~3-5 minutes)
8. Note your URL: `https://avento-api.onrender.com`

---

## Step 3: Seed the Database (1 min)

After the first deploy succeeds:

1. In Render → your web service → click **"Shell"** tab (top right)
2. Run:
```bash
node dist/scripts/seed.js
```

**If that doesn't work** (because seed uses ts-node), run these commands instead:
```bash
node -e "
const knex = require('knex');
const bcrypt = require('bcrypt');
const db = knex({ client: 'pg', connection: { connectionString: process.env.DATABASE_URL || 'postgresql://' + process.env.DB_USER + ':' + process.env.DB_PASSWORD + '@' + process.env.DB_HOST + ':' + process.env.DB_PORT + '/' + process.env.DB_NAME + '?sslmode=require' }});
async function seed() {
  const [org] = await db('organizations').insert({ name: 'Demo School', industry_module: 'school', metadata: '{}' }).returning('*');
  const hash = await bcrypt.hash('Admin@123456', 12);
  const [admin] = await db('users').insert({ organization_id: org.id, email: 'admin@demo.school', password_hash: hash, role: 'Admin' }).returning('*');
  console.log('Done! Org:', org.id, 'Admin: admin@demo.school / Admin@123456');
  await db.destroy();
}
seed().catch(e => { console.error(e); process.exit(1); });
"
```

3. Note the Organization ID and credentials

---

## Step 4: Deploy Frontend on Vercel (3 min)

1. Go to **https://vercel.com** → Sign in with GitHub
2. Click **"Add New..."** → **"Project"**
3. Import **`riyaz6340/synca`**
4. Configure:
   - **Root Directory:** click Edit → type `frontend`
   - **Framework Preset:** Vite
5. Add **Environment Variable**:
   ```
   VITE_API_URL = https://avento-api.onrender.com/api
   ```
   (Replace with your actual Render URL)
6. Click **"Deploy"** → wait ~1 min
7. Note your URL: e.g., `https://synca.vercel.app`

---

## Step 5: Update CORS on Render (30 sec)

1. Go to Render → your Web Service → **"Environment"** tab
2. Update `CORS_ORIGINS` to your actual Vercel URL:
   ```
   CORS_ORIGINS=https://synca.vercel.app
   ```
3. Service auto-redeploys

---

## Step 6: Create SuperAdmin (Founder Account)

From the Render Shell, run:
```bash
node -e "
const knex = require('knex');
const bcrypt = require('bcrypt');
const db = knex({ client: 'pg', connection: { connectionString: process.env.DATABASE_URL || 'postgresql://' + process.env.DB_USER + ':' + process.env.DB_PASSWORD + '@' + process.env.DB_HOST + ':' + process.env.DB_PORT + '/' + process.env.DB_NAME + '?sslmode=require' }});
async function run() {
  let org = await db('organizations').where('name', 'Arixx Platform').first();
  if (!org) { [org] = await db('organizations').insert({ name: 'Arixx Platform', industry_module: 'platform', metadata: '{}' }).returning('*'); }
  const hash = await bcrypt.hash('Founder@2024', 12);
  await db('users').insert({ organization_id: org.id, email: 'founder@arixx.app', password_hash: hash, role: 'SuperAdmin' }).onConflict(['organization_id','email']).ignore();
  console.log('SuperAdmin: founder@arixx.app / Founder@2024 / Org: Arixx Platform');
  await db.destroy();
}
run().catch(e => { console.error(e); process.exit(1); });
"
```

---

## Step 7: Keep-Alive (Prevent Sleep)

Render free services sleep after 15 min idle. Set up a free cron to keep it awake:

1. Go to **https://cron-job.org** (free account)
2. Create a new cron job:
   - **URL:** `https://avento-api.onrender.com/api/health`
   - **Schedule:** Every 14 minutes
3. Save → your app never sleeps

---

## Step 8: Test! 🎉

1. Open your Vercel URL
2. Login as Admin: `admin@demo.school` / `Admin@123456` / select "Demo School"
3. Login as Founder: `founder@arixx.app` / `Founder@2024` / select "Arixx Platform"

---

## Summary

| Service | Provider | Cost | Expiry |
|---------|----------|------|--------|
| Backend API | Render | Free | Never |
| PostgreSQL | Neon.tech | Free | **Never** (0.5GB) |
| Frontend | Vercel | Free | Never |
| Push Notifications | Web Push | Free | Never |
| Keep-alive cron | cron-job.org | Free | Never |
| **Total** | | **$0/month** | **Forever** |

---

## When to Upgrade (Later)

| Milestone | Action | Cost |
|-----------|--------|------|
| 10+ institutions | Render Starter (no sleep) | $7/month |
| 50+ institutions | Neon Pro (more storage) | $19/month |
| Custom domain | Buy domain | $10/year |
| SMS/WhatsApp | Twilio / WhatsApp API | Pay per message |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Application error" on Render | Check Logs tab for errors. Usually missing env vars. |
| CORS error in browser | Make sure CORS_ORIGINS exactly matches your Vercel URL (with https://, no trailing slash) |
| Database connection refused | Check DB_HOST/DB_USER/DB_PASSWORD from Neon dashboard. Make sure SSL is handled. |
| Slow first load (~30 sec) | Normal — Render free tier cold start. Use cron-job.org to prevent. |
| "relation does not exist" | Migrations didn't run. Check Start Command includes `npm run migrate &&` |
