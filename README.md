# Kono Notes

Daily journal with categorized notes (idea, private, checklist, work/timesheet).

Production: https://kono-uz7c.vercel.app

## Stack

- **Runtime:** Node.js + Express 5 (ESM)
- **Deploy:** Vercel (native Express framework detection)
- **Database:** Supabase Postgres (us-east-1)
- **Auth:** Supabase Auth with httpOnly cookie sessions
- **Frontend:** HTML + Alpine.js + Bootstrap 5 via CDN (phase 3)

## Requirements

- Node.js >= 22
- Git

## Local development

```bash
npm install
cp .env.example .env   # Windows: copy .env.example .env
npm run dev            # http://localhost:3000
```

## Health check

```bash
curl http://localhost:3000/api/health
```

## Project layout

```
src/
  app.js               Express app (default export, auto-detected by Vercel)
  config/env.js        Environment configuration
  routes/              Route modules
  controllers/         Request handlers (phase 2)
  services/            DB, search, timesheet, crypto (phase 2)
  schemas/             Zod validation schemas (phase 2)
public/                Frontend assets
migrations/            SQL migrations
tests/                 Automated tests
dev.js                 Local listener (not deployed)
```

## API

All endpoints live under `/api` and require an authenticated session (httpOnly
cookies) unless noted.

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check (public) |
| POST | `/api/auth/register` | Create account (email confirmation may be required) |
| POST | `/api/auth/login` | Start session |
| POST | `/api/auth/logout` | Clear session cookies |
| GET | `/api/auth/me` | Current user and profile |
| POST | `/api/pin/setup` | Set the global PIN |
| PUT | `/api/pin` | Change PIN (`currentPin`, `newPin`) |
| POST | `/api/pin/verify` | Verify PIN, returns a 30-minute unlock token |
| DELETE | `/api/pin` | Remove PIN |
| GET | `/api/notes?date=YYYY-MM-DD` | Notes for a day |
| POST | `/api/notes` | Create note (IDEA, PRIVATE, CHECKLIST, WORK) |
| PUT | `/api/notes/:id` | Replace a note |
| DELETE | `/api/notes/:id` | Delete a note |
| PATCH | `/api/notes/:id/items/:itemId` | Toggle a checklist item (`done`) |
| GET | `/api/notes/search?q=&type=&all=&date=&limit=&offset=` | Full-text search |
| GET | `/api/notes/timesheet?from=&to=` | Work minutes aggregation |

Private notes are redacted in `GET /api/notes` (metadata with `locked: true`,
no title or content) and excluded from search unless the request carries a
valid `X-Unlock-Token` header issued by `POST /api/pin/verify`.

## Frontend

Single-page Alpine.js app served from `public/` with no build step. Bootstrap 5
and Bootstrap Icons come from a CDN.

- Header: day navigation, date picker, PIN lock and sign out.
- Composer: IDEA, PRIVATE, CHECKLIST and WORK note types.
- Private notes render as a locked drawer until the PIN is verified.
- Checklist items toggle optimistically; timesheet totals update after WORK
  notes.
- Search supports day/history scope and a type filter.

Run `npm run dev` and open `http://localhost:3000`.

## Testing

```bash
npm test            # unit tests (node:test)
npm run test:e2e    # browser smoke test (needs Chrome or Edge)
```

The e2e script creates a confirmed test user directly in the database, drives
the real UI, and deletes the user afterwards. To run it against a deployment:

```powershell
$env:E2E_BASE_URL="https://kono-uz7c.vercel.app"; npm run test:e2e
```

It only touches the isolated test user, but do not run it while doing manual QA
on that same account.

## CI

GitHub Actions runs `npm ci` and `npm test` on every push to `main` and on pull
requests.

## Agent access

Create a token in the app under **Agent access** and give it to an external
agent. The token is shown once and can be revoked at any time.

Scopes: `notes:read` (private notes are always excluded) and `agent:write`.

```bash
# Read notes
curl -H "Authorization: Bearer kono_agent_..." \
  "https://<app>.vercel.app/api/agent/notes?from=2026-11-15&to=2026-11-15"

# Write an Agent note
curl -X POST -H "Authorization: Bearer kono_agent_..." \
  -H "Content-Type: application/json" \
  -d '{"text":"Daily news","agent":"instinct"}' \
  "https://<app>.vercel.app/api/agent/notes"
```

Agent reads and writes run inside a scoped RLS context (no service role), so
the database enforces the token's user. The agent endpoints require
`DATABASE_URL` in the runtime environment.

## Deployment

Vercel detects `src/app.js` as an Express application, so no `serverless-http`
wrapper or `api/` rewrite is required. `vercel.json` pins functions to `iad1`
(co-located with Supabase `us-east-1`) and adds baseline security headers.

1. Import the repository in the Vercel dashboard.
2. Set environment variables (Production and Preview):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `UNLOCK_TOKEN_SECRET` (64 random hex characters)
   - `NODE_ENV=production`
   - `APP_TIMEZONE=America/Caracas`
   - `DATABASE_URL` (transaction pooler; required by the agent endpoints)
3. In Supabase, set **Authentication -> URL Configuration**:
   - Site URL: `https://<your-app>.vercel.app`
   - Redirect URLs: `https://<your-app>.vercel.app/**` and
     `http://localhost:3000/**`
4. Deploy. Every push to `main` triggers production; pull requests get preview
   deployments.

Do not run migrations from Vercel; run `npm run migrate` locally or from CI
using `DIRECT_URL`. `DATABASE_URL` and `DIRECT_URL` are not needed at runtime.

## Status

- [x] Phase 0: project bootstrap, health endpoint
- [x] Phase 1: database schema, migrations, RLS
- [x] Phase 2: auth, PIN unlock, notes API
- [x] Phase 3: frontend (Alpine + Bootstrap, no build step)
- [x] Phase 4: CI, Vercel deploy and production hardening
- [x] Manual check: email confirmation redirect in production
- [x] Agent access: AGENT note type, scoped tokens, read/write API
