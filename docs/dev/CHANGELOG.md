# Changelog

Newest first. One entry per change: date, what changed for users, files, and tests.

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
