# Mission Control

Personal life planning and daily mission control — pillars, tasks, scheduling, daily logs, and AI-assisted prioritization.

Built with Next.js 15, Turso (libSQL), and Vercel AI SDK.

## Setup

```bash
cd "/Users/yuanichen/Desktop/mission control"
npm install
cp .env.example .env.local
# Fill in ODB_TURSO_DATABASE_URL and ODB_TURSO_AUTH_TOKEN (same Turso DB as before)
npm run dev
```

Open http://localhost:3000

### First-time database setup

If the Turso database is new or missing life-planning tables:

```bash
curl -X POST http://localhost:3000/api/admin/init \
  -H "x-admin-token: YOUR_ADMIN_INIT_TOKEN"
```

Omit the header if `ADMIN_INIT_TOKEN` is not set (local dev only).

## Deploy on Vercel

1. Push this repo to a new GitHub repository.
2. Import the project in Vercel (Framework Preset: **Next.js**).
3. Set environment variables from `.env.example`.
4. Deploy.

Root `vercel.json` is configured for Next.js — no custom output directory needed.

## App structure

- `app/mission` — daily command center (AI brief, check-in, reflection)
- `app/pillars` — life focus areas, goals, milestones
- `app/tasks` — task list and chores
- `app/scheduling` — recurring events and weekly rhythm
- `app/daily` — daily log (what went well / poorly, focus)
- `src/db/life.ts` — life planning schema (pillars, tasks, mission state)
- `src/db/users.ts` — auth and sessions
