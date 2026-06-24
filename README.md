# Avento — People Presence Platform

A multi-tenant SaaS platform for school attendance tracking, parent communication, and operations management.

## Features

- **One-tap attendance** — Mark 60+ students in seconds (Mark Absentees / Mark Present modes)
- **Free push notifications** — Web Push alerts to parents (no SMS cost)
- **Parent Portal** — Calendar view of attendance, leave requests, announcements
- **Leave management** — Digital request/approve workflow with auto-attendance
- **Reports** — Class-wise, student-wise, organization-wide with PDF/CSV export
- **Announcements** — Templates for fee reminders, holidays, events
- **Holiday calendar** — School-wide holidays shown on everyone's calendar
- **Multi-child parent login** — One login sees all children
- **Super Admin dashboard** — Platform-wide stats for the founder
- **PWA** — Installable on phones, works offline

## Tech Stack

**Backend:** Node.js, TypeScript, Express, PostgreSQL (Knex), BullMQ/Redis, JWT, Web Push
**Frontend:** React, TypeScript, Vite, React Router

## Project Structure

```
/                  → Backend (Express API)
  src/
    routes/        → API endpoints
    services/      → Business logic
    middleware/    → Auth, tenant isolation
    migrations/    → Database schema
  frontend/        → React SPA (Admin + Parent Portal)
  scripts/         → Seed and admin scripts
  docs/            → Product guides and marketing
```

## Local Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 5+ (optional — only needed for SMS/WhatsApp queue)

### Steps
```bash
# 1. Install backend dependencies
npm install

# 2. Install frontend dependencies
cd frontend && npm install && cd ..

# 3. Create database
# (create a PostgreSQL database named 'avento_dev')

# 4. Configure environment
copy .env.example .env
# Edit .env with your DB credentials

# 5. Run migrations
npm run migrate

# 6. Seed initial data (creates Demo School + admin)
npm run seed

# 7. Start backend (port 3000)
npm run dev

# 8. Start frontend (port 5173) — in a separate terminal
cd frontend && npm run dev
```

### Default Login
- **Admin:** admin@demo.school / Admin@123456 / Demo School

## Environment Variables

See `.env.example` for the full list. Key variables:
- `DB_*` — PostgreSQL connection
- `JWT_SECRET`, `JWT_EXPIRES_IN` — Authentication
- `REDIS_*` — Notification queue (optional)
- `VAPID_*` — Web push notifications
- `CORS_ORIGINS` — Allowed frontend origins

## License

Proprietary — All rights reserved.
