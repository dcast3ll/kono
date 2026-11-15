# Session Checkpoint — Kono Notes

Date: 2026-11-15
Status: Phases 0-4 complete, deployed, and cleaned up. Agent access added and
verified locally; pending `DATABASE_URL` on Vercel and a production redeploy.

## Links

- Repository: https://github.com/dcast3ll/kono (branch `main`)
- Production: https://kono-uz7c.vercel.app
- Supabase project: `evczxgoqocxdfnimboqm` (us-east-1, PostgreSQL 17.11)

## Goal

Kono Notes: a daily journal with categorized notes (IDEA, PRIVATE, CHECKLIST,
WORK/timesheet, AGENT). Multiuser, Express 5 on Vercel, Supabase Postgres.

## Deployment

- Vercel project `kono-uz7c` (domain `kono-uz7c.vercel.app`) imported from
  `dcast3ll/kono`; auto-deploys on push to `main`.
- Functions region `iad1` (co-located with Supabase `us-east-1`) via
  `vercel.json`.
- Vercel env vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  `UNLOCK_TOKEN_SECRET`, `NODE_ENV=production`, `APP_TIMEZONE=America/Caracas`,
  and `DATABASE_URL` (transaction pooler, required by the agent endpoints).
- Supabase Authentication -> URL Configuration: Site URL is the Vercel domain;
  Redirect URLs include the Vercel domain and `http://localhost:3000/**`.
- `vercel.json` sets baseline security headers and `Cache-Control: no-store`
  for `/api/*`.

## Locked decisions

- Auth: Supabase Auth with httpOnly cookies; refresh-on-401 in `requireAuth`.
  Cookies are `Secure` in production (`NODE_ENV=production`).
- RLS per user; the user-facing API uses the user JWT, never the service role.
- Timezone: the browser computes `note_date` in local time; the profile
  `timezone` defaults to `America/Caracas` and drives `HH:mm` display.
- Vercel detects the Express app exported from `src/app.js`.
- Frontend is in `public/`: `express.static` serves it locally, the Vercel CDN
  serves it in production.
- Private notes: redacted metadata (`locked: true`) when locked; excluded from
  search while locked.
- PIN: scrypt, DB-backed lockout, 30-minute HMAC unlock token.
- Agent access: per-user scoped tokens, hashed (SHA-256), revocable. Scopes
  `notes:read` + `agent:write`; **private notes are never readable by agents**.
  Agent DB work runs under a forced RLS context (`request.jwt.claims` +
  `set local role authenticated`), no service role.

## Completed

- Phase 0: Express 5 ESM app, `/api/health`, local dev script.
- Phase 1: migrations `001_init`, `002_tighten_grants`,
  `003_timezone_caracas`, `004_agent_and_tokens`; RLS, indexes, triggers,
  least-privilege grants.
- Phase 2: auth, PIN, notes CRUD, checklist PATCH, search, timesheet; Zod
  validation; same-origin guard.
- Phase 3: full Alpine frontend, header brand ("Kono Notes" / "Capture the
  day."), private drawer, responsive layout.
- Phase 4: GitHub repo, CI, Vercel production deploy (`iad1`), security headers.
- Agent access:
  - Migration `004`: `AGENT` note type and `agent_tokens` table with RLS.
  - `src/lib/tokens.js` (prefix + SHA-256), `src/lib/agent-db.js`
    (token auth + RLS user context), `src/middleware/agent.js` (Bearer + scope),
    `src/schemas/agent.js`, `src/routes/agent-tokens.js`,
    `src/routes/agent-notes.js`.
  - `GET /api/agent/notes` (private excluded, filters + pagination) and
    `POST /api/agent/notes` (creates AGENT notes, date default in profile
    timezone).
  - UI: 🤖 Agent composer tab, agent card badge, Agents search filter, and
    Account -> Agent access with generate/copy/revoke.
  - Unit tests: 13/13. E2E: 22 checks including token create, read, private
    exclusion, write, revoke, and UI render.

## Verified

- Production HTTP: `/` 200 HTML; `/api/health` 200 (`env: production`);
  assets 200; `/api/notes` without session 401 JSON.
- Production headers: HSTS, X-Content-Type-Options, X-Frame-Options,
  Referrer-Policy, Permissions-Policy; `/api/*` no-store.
- Production e2e PASS, including `session cookie is Secure`.
- Production `/api/health` reports `America/Caracas` after redeploy.
- Manual production: `dcastell@gmail.com` confirmed, PIN configured, PRIVATE
  note for `2026-11-15` stored.
- Local agent e2e PASS: token create, read (private excluded), write, revoke
  401, UI render.
- Duplicate Vercel project `kno` deleted and disconnected from Git.

## Remaining

1. Add `DATABASE_URL` (transaction pooler) to Vercel (Production + Preview) and
   redeploy; then rerun the production e2e for the agent endpoints.
2. Generate an agent token in the app and give it to Instinct. Endpoint
   contract in README (Agent access).
3. Optional: CSP (blocked by Alpine's standard build using `new Function`).
4. Optional features: dark mode, PIN change/remove UI, full-week timesheet.

## Gotchas

- `pg` returns `date` columns as JS Date objects; cast `note_date::text` in
  agent queries to keep the string contract.
- Agent reads/writes must run inside the RLS context; `auth.uid()` was verified
  to return the token's user via `set_config('request.jwt.claims', ...)`.
- Vercel's 401 console message is `status of 401 ()`; the e2e filter matches
  `status of 401`.
- `express.static` does not serve on Vercel; `public/**` is served by the CDN.
- Alpine evaluates `x-text` even when `x-show` hides the element; guard
  type-specific expressions or use `x-if`.
- Manual `auth.users` test users need token/change columns set to `''` and
  `email_change_confirm_status = 0`.
- Supabase blocks `@example.com` and rate-limits confirmation emails.
- The primary user is in Venezuela (UTC-4); profile/default timezone is
  `America/Caracas`.

## Key files

- `src/app.js`, `src/config/env.js`
- `src/lib/{supabase,crypto,cookies,http,tokens,agent-db}.js`
- `src/middleware/{auth,csrf,unlock,agent}.js`
- `src/schemas/{auth,notes,agent}.js`
- `src/routes/{health,auth,pin,notes,agent-tokens,agent-notes}.js`
- `public/index.html`, `public/css/app.css`, `public/js/{app,api,date}.js`
- `migrations/001_init.sql` ... `migrations/004_agent_and_tokens.sql`
- `scripts/migrate.js`, `scripts/set-db-password.ps1`, `scripts/e2e-smoke.mjs`
- `tests/unit.test.js`, `tests/date.test.js`
- `vercel.json`, `.github/workflows/ci.yml`
- `README.md`, `.env.example`, `.env` (ignored)

## Environment variables (names only)

`NODE_ENV`, `PORT`, `APP_TIMEZONE`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`DATABASE_URL`, `DIRECT_URL`, `UNLOCK_TOKEN_SECRET`.
