# Deploy Avento on Render (100% Free)

## What's Free on Render
- ✅ Web Service (750 hours/month free — enough for 1 always-on service)
- ✅ PostgreSQL (free tier: 1GB storage, 90-day expiry — renew before it expires)
- ❌ Redis (not free — skip it, web push works without Redis)
- ⚠️ Free web services "sleep" after 15 min idle — ~30 sec cold start on first request

## Step-by-Step

### Step 1: Create Render Account
1. Go to **https://render.com**
2. Sign up with GitHub

### Step 2: One-Click Deploy (Blueprint)
1. Go to **https://render.com/deploy**
2. Paste your GitHub repo: `https://github.com/riyaz6340/synca`
3. Render detects `render.yaml` and auto-creates:
   - Web Service (avento-api)
   - PostgreSQL Database (avento-db)
4. Click **"Apply"** — wait 3-5 minutes for build

### Step 3: (Alternative) Manual Setup
If the blueprint doesn't work:

1. **Create PostgreSQL:**
   - Dashboard → "New" → "PostgreSQL"
   - Name: `avento-db`
   - Plan: **Free**
   - Create → note the Internal Connection String

2. **Create Web Service:**
   - Dashboard → "New" → "Web Service"
   - Connect your `riyaz6340/synca` repo
   - Settings:
     - Name: `avento-api`
     - Runtime: **Node**
     - Build Command: `npm install && npm run build`
     - Start Command: `npm run migrate && node dist/index.js`
     - Plan: **Free**
   - Environment Variables (add each one):
     ```
     NODE_ENV=production
     PORT=10000
     JWT_SECRET=<paste a random 64-char string>
     JWT_EXPIRES_IN=30d
     VAPID_PUBLIC_KEY=BBrdGA6XIcbxcug7cF6tTNhnFakSulGl-aWLQ7u01SusorK6D9uLkVnjewEjTXTasboj-cJuCX3vmJdQTIT-lf8
     VAPID_PRIVATE_KEY=CGpXlqoQBx_N6yiuyebhkLpXQg8zjSp4DK3L0pkW6-U
     VAPID_SUBJECT=mailto:admin@avento.app
     CORS_ORIGINS=https://synca.vercel.app
     DB_HOST=<from your PostgreSQL internal host>
     DB_PORT=5432
     DB_NAME=avento_prod
     DB_USER=avento
     DB_PASSWORD=<from your PostgreSQL password>
     REDIS_HOST=
     REDIS_PORT=6379
     REDIS_PASSWORD=
     ```

### Step 4: Seed the Database
After the first deploy succeeds:

1. In Render Dashboard → your web service → **"Shell"** tab
2. Run:
   ```bash
   npm run seed
   ```
3. Note the credentials output

### Step 5: Deploy Frontend on Vercel (Free)
1. Go to **https://vercel.com** → Import `riyaz6340/synca`
2. Settings:
   - Root Directory: `frontend`
   - Framework: Vite
   - Build: `npm run build`
   - Output: `dist`
3. Environment variable:
   - `VITE_API_URL` = `https://avento-api.onrender.com/api` (your Render URL)
4. Deploy

### Step 6: Update CORS
Go back to Render → your web service → Environment → update:
```
CORS_ORIGINS=https://synca.vercel.app
```
(Replace with your actual Vercel URL)

---

## Important Notes

### Free Tier Limitations
| Limitation | Impact | Workaround |
|-----------|--------|-----------|
| Service sleeps after 15 min idle | First request takes ~30 sec | Use cron-job.org to ping /api/health every 14 min |
| PostgreSQL expires in 90 days | Data lost if not renewed | Renew before expiry (Render sends email reminder) |
| No Redis on free tier | BullMQ queue won't work | Web push works directly (no queue needed) |
| 750 hours/month limit | Fine for 1 service (744 hrs in a month) | Only issue if you run multiple services |

### Keep-Alive Trick (Prevent Sleep)
Free services sleep after 15 min. To keep it awake:
1. Go to **https://cron-job.org** (free)
2. Create a job:
   - URL: `https://your-app.onrender.com/api/health`
   - Interval: Every 14 minutes
3. This pings your app every 14 min, preventing sleep

### When to Upgrade
- **10+ schools using the platform** → Upgrade to Render Starter ($7/month) for no sleep
- **Or switch to Railway** ($5/month, no sleep from day one)

---

## Summary: Total Cost = $0

| Service | Provider | Cost |
|---------|----------|------|
| Backend API | Render (Free) | $0 |
| PostgreSQL | Render (Free) | $0 |
| Frontend | Vercel (Free) | $0 |
| Push Notifications | Web Push (VAPID) | $0 |
| Domain (optional) | Namecheap | ~$10/year |
| **Total** | | **$0/month** |

---

## Your Live URLs After Deploy
- Frontend: `https://synca.vercel.app` (or custom domain)
- API: `https://avento-api.onrender.com`
- Health: `https://avento-api.onrender.com/api/health`
