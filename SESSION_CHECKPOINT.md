# Session Checkpoint — Kono Notes

Date: 2026-11-14
Status: Phases 0-3 complete. Next: Phase 4 (CI, Vercel deploy, hardening).

## Goal

Build Kono Notes: a daily journal with categorized notes (IDEA, PRIVATE,
CHECKLIST, WORK/timesheet). Multiuser, Express 5 on Vercel, Supabase Postgres,
Git-based deploys.

## Active Supabase project

- Ref: `evczxgoqocxdfnimboqm` (us-east-1, PostgreSQL 17.11)
- `DATABASE_URL`: transaction pooler `:6543`
- `DIRECT_URL`: session pooler `:5432` (migrations)
- Email confirmation is ENABLED.
- Old projects to delete manually: `tefykfseowsizesreirr` and
  `garfmwezvesdpkxindkt`.

## Locked decisions

- Auth: Supabase Auth with httpOnly cookies (`kono_access`, `kono_refresh`);
  refresh-on-401 in `requireAuth`.
- RLS per user; the API uses the user JWT, never the service role.
- Vercel detects the Express app exported from `src/app.js`.
- Static frontend lives in `public/`; `express.static` serves it locally, the
  Vercel CDN serves it in production (do not rely on express.static on Vercel).
- Regions: Supabase `us-east-1`, Vercel functions `iad1`.
- Timezone: client sends `note_date` in local time; per-profile `timezone`.
- Private notes: when locked, `GET /api/notes` returns redacted metadata
  (`locked: true`, no title/content) so the UI can render the drawer. Search
  excludes them while locked.
- PIN: scrypt hash, DB-backed lockout (5 -> 1 min, 10 -> 15 min, 15 -> 1 h),
  30-minute HMAC unlock token.
- Checklist items carry stable UUIDs; toggled via per-item PATCH.
- Frontend: Alpine.js + Bootstrap 5 + Bootstrap Icons via CDN, no build step.
  Alpine ESM is imported after `app.js` so `window.konoApp` exists first.

## Completed

- Phase 0: Express 5 ESM app, `/api/health`, `dev.js`, README.
- Phase 1: migrations applied (`001_init`, `002_tighten_grants`), RLS, indexes,
  triggers, least-privilege grants.
- Phase 2: auth, PIN, notes CRUD, checklist PATCH, search, timesheet; Zod
  validation; CSRF same-origin guard.
- Phase 3 (frontend):
  - `public/index.html`: single-page app (auth view, app shell, composer, note
    cards, private drawer, search, timesheet, PIN modal, toast).
  - Header brand: compact `K` mark, "Kono Notes" wordmark and the
    "Capture the day." slogan; clicking it returns to today; the slogan hides
    below 768px.
  - `public/js/app.js`: Alpine component (state, auth, notes, PIN, search,
    timesheet, date nav).
  - `public/js/api.js`: fetch wrapper (same-origin, `X-Unlock-Token`, 401
    handling only for session errors).
  - `public/js/date.js`: local date math, display formatting, duration and
    unlock-token expiry helpers.
  - `public/css/app.css`: layout, type colors, private blur drawer, responsive.
  - `public/favicon.svg`.
  - `src/app.js`: `express.static(public)`; removed the JSON root route.
  - `src/routes/notes.js`: redacts private notes when locked.
- Testing:
  - `npm test`: 11/11 unit tests (crypto, unlock token, note schemas, date
    helpers, Alpine factory).
  - `npm run test:e2e`: real Chrome e2e against the live DB. PASS.
    Covers login, PIN setup, create IDEA/PRIVATE/CHECKLIST/WORK, lock/unlock
    private content, checklist toggle + reload persistence, timesheet total
    (1h 30m), search. Test user is cleaned up.

## Verified

- `/` serves the HTML app; `/js/app.js` and `/css/app.css` serve correctly.
- `/api/health` returns 200.
- Locked private notes have no content/title; unlocked ones do.
- Browser console clean (excluding the expected initial `/api/auth/me` 401).

## Gotchas discovered

- Alpine evaluates `x-text` even when `x-show` hides the element. Guard
  type-specific expressions (e.g. `Array.isArray(note.content)`), or use
  `x-if`.
- Browser requests `/favicon.ico`; a missing icon logs a 404. Added
  `favicon.svg` + link.
- The initial `/api/auth/me` returns 401 before login; that is expected.
- `auth.users` manual test users need the token/change columns set to `''` and
  `email_change_confirm_status = 0`; password via
  `extensions.crypt(pw, extensions.gen_salt('bf'))`.
- Supabase blocks `@example.com` and rate-limits confirmation emails.

## Next steps (in order)

1. Phase 4: Vercel project (`iad1`), production env vars, migration workflow.
2. CI (GitHub Actions): install, test, maybe e2e with a dedicated test user.
3. Security headers (CSP allowing jsdelivr, X-Content-Type-Options,
   Referrer-Policy, frame policy).
4. Verify preview deploy serves `public/**` from the CDN and `/api/*` from
   Express.
5. Optional: dark mode, PIN change/remove UI, per-item add/remove editing,
   week-complete timesheet view.

## Environment notes

- gentle-ai: global `opencode.jsonc` has `"__managed_by"` on agent definitions
  and the strict upstream rejects it; work is done with a plain agent.
- Engram MCP/CLI is unavailable; this file is the persistent checkpoint.

## Key files

- `src/app.js`, `src/config/env.js`
- `src/lib/{supabase,crypto,cookies,http}.js`
- `src/middleware/{auth,csrf,unlock}.js`
- `src/schemas/{auth,notes}.js`
- `src/routes/{health,auth,pin,notes}.js`
- `public/index.html`, `public/css/app.css`, `public/js/{app,api,date}.js`
- `migrations/001_init.sql`, `migrations/002_tighten_grants.sql`
- `scripts/migrate.js`, `scripts/set-db-password.ps1`, `scripts/e2e-smoke.mjs`
- `tests/unit.test.js`, `tests/date.test.js`
- `.env.example`, `.env` (ignored), `README.md`

## Environment variables (names only)

`NODE_ENV`, `PORT`, `APP_TIMEZONE`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`DATABASE_URL`, `DIRECT_URL`, `UNLOCK_TOKEN_SECRET`.
