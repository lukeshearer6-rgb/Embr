# Changelog

Newest first. One entry per change: date, what changed for users, files, and tests.

## 2026-11-24: Sign-in accepts 8-digit codes
- New Supabase projects email 8-digit sign-in codes, and the sign-in box only took 6, so every code looked wrong. The box now takes 6 to 8 digits and ignores spaces, and its label no longer says "6-digit".
- Files: `src/views/auth.js`, `scripts/dev-server.mjs` (test stand-in also accepts an 8-digit code), `tests/e2e.test.mjs`.
- Tests: e2e signs the brand in with an 8-digit code (33 checks).

## 2026-11-24: Admin website loads on Cloudflare Pages
- Fixes an endless redirect on /admin. Cloudflare Pages already serves admin.html at /admin and redirects /admin.html back to /admin, so the old `/admin -> /admin.html` rewrite looped. `/admin/*` now rewrites to `/admin`.
- Files: `public/_redirects`.
- Tests: checked on the live test site (embr-pilot.pages.dev/admin and /admin/people load); the local test server has its own routing, so e2e is unchanged (33 checks).

## 2026-11-24: Security review and hardening before the test deploy
- No visible change for users. Pages now tell browsers to run scripts only from Embr itself (Content-Security-Policy) and to always use HTTPS, as a second line of defence against unsafe text. Review findings are in `docs/dev/security-review-2026-11-24.md`.
- Files: `public/_headers`, `scripts/dev-server.mjs` (sends the same headers locally), `tests/e2e.test.mjs`, `docs/dev/security-review-2026-11-24.md`.
- Tests: e2e 33 checks (new: HTML typed into a bio shows as text and never runs; pages send the CSP and no-framing headers), db 64 checks.

## 2026-11-24: Booking agreement exported for solicitor review
- No change for users. New `docs/dev/booking-agreement.md` holds the booking agreement text exactly as the `_agreement` function writes it (migration `20261123000001_embr_pilot.sql`, line 373), with `{placeholders}` for the parts filled in per booking, a table of where each comes from, and questions for the solicitor limited to points in the text.
- Files: `docs/dev/booking-agreement.md`, `tests/agreement-export.test.mjs`, `package.json` (new `test:agreement` script), `.github/workflows/ci.yml`.
- Tests: new `npm run test:agreement` (9 checks, no database needed, also in CI) fails if the doc and the function's text drift apart.

## 2026-11-24: Payment safety fixes
- From a review of the Stripe integration. Brands can no longer be charged twice and talent can't be paid twice when a step fails halfway: the balance charge and each transfer are saved the moment they happen, and retries reuse them (even after Stripe's 24-hour idempotency window).
- A webhook that fails is forgotten, so Stripe's retry is processed instead of skipped as a duplicate.
- Staff sign-off closes the brand's open balance payment page first; a second balance payment that still arrives is refunded automatically and staff are told.
- Only card problems (authentication, declines) send the brand to the Checkout fallback; other errors are errors, and the failed payment is cancelled.
- New webhook events: chargebacks (staff alerted; transfer reversal stays a staff decision), expired balance pages, failed payouts, disconnected talent Stripe accounts. SETUP.md lists them.
- The deposit Checkout says when the saved card will be charged for the balance.
- Files: `supabase/functions/_shared/payments.ts`, migration `20261124000001_payment_safety.sql`, `scripts/fake-stripe.mjs`, `docs/builds/SETUP.md`.
- Tests: new `tests/payments.test.mjs` (6 checks, also in CI); db 64 and e2e 32 checks still pass.

## 2026-11-23: Animated office view
- New `docs/office.html`: a top-down office where the researcher, developer, app builder, marketer and orchestrator walk between rooms carrying their work, and take things to Luke's desk when they need his OK. Every walk comes from `docs/workflow-state.md` (waits-on links, "hand to" next actions, approval needs, "Agents now").
- Built by `npm run office`, and also by `npm run dashboard` and the edit hook. The dashboard links to it. Parsing moved to `scripts/workflow-state.mjs`, shared by both pages (dashboard output unchanged).
- Tests: `npm run test:office`, 13 checks pass. CI runs it.

## 2026-11-23: Workspace set up
- The pilot app is now the repo root, with docs, agents, CI and a dashboard around it. The app's behaviour is unchanged.
- `SETUP.md` moved to `docs/builds/SETUP.md`. `scripts/db-reset.sh` now reads `PGHOST`/`PGPORT`, so CI can use it.
- Added `npm run dashboard` (scripts/dashboard.mjs → docs/dashboard.html).
- The browser test now makes its own test photos instead of needing files outside the repo, and its screenshots go to the system temp folder.
- Tests: db 64 checks and e2e 32 checks pass.

## 2026-11-23: Full model details; staff admin moved to /admin
- The Model role needs full comp-card measurements, and briefs and board search filter on them (migration 3).
- Staff use a separate desktop admin site (`admin.html`, `/admin`).

## 2026-11-23: Multi-role talent profiles
- Talent pick every role they do at sign-up. Each role has a portfolio section, and the profile goes live only when every section is filled (migration 2).

## 2026-11-23: Pilot app
- Database, Stripe payments, ID check, emails, app screens and tests (migration 1).
