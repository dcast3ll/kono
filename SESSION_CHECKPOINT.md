# Session Checkpoint — Kono Notes

Date: 2026-11-15
Status: Phases 0-4 complete, deployed, and cleaned up. Production auth flow
and timezone verified.

## Links

- Repository: https://github.com/dcast3ll/kono (branch `main`)
- Production: https://kono-uz7c.vercel.app
- Supabase project: `evczxgoqocxdfnimboqm` (us-east-1, PostgreSQL 17.11)

## Goal

Kono Notes: a daily journal with categorized notes (IDEA, PRIVATE, CHECKLIST,
WORK/timesheet). Multiuser, Express 5 on Vercel, Supabase Postgres.

## Deployment

- Vercel project `kono-uz7c` (domain `kono-uz7c.vercel.app`) imported from
  `dcast3ll/kono`; auto-deploys on push to `main`.
- Functions region `iad1` (co-located with Supabase `us-east-1`) via
  `vercel.json`.
- Vercel env vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  `UNLOCK_TOKEN_SECRET`, `NODE_ENV=production`, `APP_TIMEZONE=America/Caracas`.
  `DATABASE_URL`/`DIRECT_URL` are not used at runtime.
- Supabase Authentication -> URL Configuration: Site URL is the Vercel domain;
  Redirect URLs include the Vercel domain and `http://localhost:3000/**`.
- `vercel.json` also sets baseline security headers and `Cache-Control:
  no-store` for `/api/*`.

## Locked decisions

- Auth: Supabase Auth with httpOnly cookies; refresh-on-401 in `requireAuth`.
  Cookies are `Secure` in production (`NODE_ENV=production`).
- RLS per user; the API uses the user JWT, never the service role.
- Timezone: the browser computes `note_date` in local time; the profile
  `timezone` defaults to `America/Caracas` and drives `HH:mm` display.
- Vercel detects the Express app exported from `src/app.js`; no
  `serverless-http` and no `api/`.
- Frontend is in `public/`: `express.static` serves it locally, the Vercel CDN
  serves it in production.
- Private notes: redacted metadata (`locked: true`) when locked; excluded from
  search while locked.
- PIN: scrypt, DB-backed lockout, 30-minute HMAC unlock token.
- Frontend: Alpine.js + Bootstrap 5 via CDN, no build step.

## Completed

- Phase 0: Express 5 ESM app, `/api/health`, local dev script.
- Phase 1: migrations `001_init`, `002_tighten_grants`,
  `003_timezone_caracas`; RLS, indexes, triggers, least-privilege grants.
- Phase 2: auth, PIN, notes CRUD, checklist PATCH, search, timesheet; Zod
  validation; same-origin guard.
- Phase 3: full Alpine frontend, header brand ("Kono Notes" / "Capture the
  day."), private drawer, responsive layout.
- Phase 4: GitHub repo, 3 work-unit commits plus deploy config, Vercel
  production deploy (`iad1`), security headers, CI workflow.

## Verified

- Production HTTP: `/` 200 HTML; `/api/health` 200 (`env: production`);
  assets 200; `/api/notes` without session 401 JSON.
- Production headers: HSTS, X-Content-Type-Options, X-Frame-Options,
  Referrer-Policy, Permissions-Policy; `/api/*` no-store.
- `E2E_BASE_URL=https://kono-uz7c.vercel.app npm run test:e2e` -> PASS,
  including `session cookie is Secure`.
- Local unit tests: 11/11.
- Manual production: `dcastell@gmail.com` confirmed, PIN configured, PRIVATE
  note for `2026-11-15` stored; profile timezone migrated to `America/Caracas`.
- After redeploy, `/api/health` reports `America/Caracas`; production e2e PASS.
- Duplicate Vercel project `kno` deleted and disconnected from Git; only
  `kono-uz7c` remains.

## Remaining

1. Optional: CSP (blocked by Alpine's standard build using `new Function`;
   would require the Alpine CSP build or `'unsafe-eval'`).
2. Optional features: dark mode, PIN change/remove UI, full-week timesheet view.

## Gotchas

- Vercel's 401 console message is `status of 401 ()` (no "Unauthorized"
  reason), so the e2e filter matches `status of 401`.
- `express.static` does not serve on Vercel; `public/**` is served by the CDN.
  Keep static assets there.
- Alpine evaluates `x-text` even when `x-show` hides the element; guard
  type-specific expressions or use `x-if`.
- Manual `auth.users` test users need token/change columns set to `''` and
  `email_change_confirm_status = 0`.
- Supabase blocks `@example.com` and rate-limits confirmation emails.
- The primary user is in Venezuela (UTC-4). Profile timezone and defaults are
  `America/Caracas`; do not assume Bogota.

## Key files

- `src/app.js`, `src/config/env.js`
- `src/lib/{supabase,crypto,cookies,http}.js`
- `src/middleware/{auth,csrf,unlock}.js`
- `src/schemas/{auth,notes}.js`
- `src/routes/{health,auth,pin,notes}.js`
- `public/index.html`, `public/css/app.css`, `public/js/{app,api,date}.js`
- `migrations/001_init.sql`, `migrations/002_tighten_grants.sql`,
  `migrations/003_timezone_caracas.sql`
- `scripts/migrate.js`, `scripts/set-db-password.ps1`, `scripts/e2e-smoke.mjs`
- `tests/unit.test.js`, `tests/date.test.js`
- `vercel.json`, `.github/workflows/ci.yml`
- `README.md`, `.env.example`, `.env` (ignored)

## Environment variables (names only)

`NODE_ENV`, `PORT`, `APP_TIMEZONE`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`DATABASE_URL`, `DIRECT_URL`, `UNLOCK_TOKEN_SECRET`.
