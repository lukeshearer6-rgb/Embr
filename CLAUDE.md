# Embr: project guide for Claude sessions

Read this first in every session. Then read `docs/workflow-state.md`. Read nothing else until the task needs it.

## What Embr is

Embr is a UK marketplace where brands book unsigned models and creatives directly. It is built for unsigned talent, new faces, models who no longer want representation, and other creative talent who get booked by newer, local and independent brands.

- Campaign line: **"Unsigned, not unseen"**. Talent line: **"Let work find you"**.
- Status: invite-only pilot app built and tested locally. Not online yet. Embr is **not incorporated** yet.
- Pilot plan: brand-led, invite-only, Manchester first.
- Team: Luke (founder) and Claude. Claude drafts, researches, designs and builds. Luke sends, posts, calls, signs up for accounts and tests.
- Budget: **zero cash**. The only accepted unavoidable costs are incorporation and a domain, and they still need Luke's approval.

The locked business rules are in `docs/decisions.md`. Read it before any product, copy or legal-adjacent work.

The mobile design rules are in `DESIGN_RULES.md` (tab bar, safe areas and touch targets, sheets vs modals, colour and photos, each backed by Mobbin screens). Read it before any UI task.

## Hard rules (never break these)

1. **No estimated figures.** Every number (market size, price, fee, statistic, date) carries a source link and the date it was checked. If no source exists, write "unverified: needs measuring" instead of a guess. Luke's own decisions count as a source: cite them as "Decision (Luke, date)".
2. **Embr must not look like an employment agency.** Talent cannot apply for jobs, browse jobs or message brands to get work. Brands search the board, Embr ranks talent against a brief, and brands make offers. Never write "find work", "apply", "jobs for you" or "join to get work" for talent. Keep "Let work find you" away from membership pricing.
3. **Ask Luke before any public, paid, live-money or outward action.** See "Approval gates" for what agents may now do alone.
4. **Verify before marking done.** Code: the tests pass. Build: the build runs and the log is saved. Research and marketing: every claim is checked against its source.
5. **Never commit secrets.** `.env*` files (except `.env.example`), API keys, webhook secrets and passwords stay out of git and out of docs.

## Approval gates

Luke's standing rule, loosened 2026-11-24 ("GitHub plus routine setup"; Luke: "I allow this to be autonomous"). Autonomy grows as trust is built, and Luke loosens this list himself.

Agents may do these without asking:

- push branches, and open and merge their own pull requests once CI is green (never force-push, never push straight to `main`)
- change the pilot's **test** setup: Supabase test project schema and migrations, Edge Functions, and Stripe sandbox (test mode) settings

Stop, write the request in `docs/workflow-state.md` under "Waiting on Luke", and ask him before you:

- deploy anything public or live (Cloudflare Pages, a live domain, anything real users can reach)
- publish, post or send anything (social posts, emails, DMs, landing pages, Canva exports for use)
- contact any real person or company
- spend money or start a paid plan or trial
- create or rotate credentials or secrets, or change account settings beyond the test setup above
- switch Stripe from test mode to live mode, or move any real money
- put any legal, pricing, earnings or comparative claim into public copy

Local work needs no approval: editing files, running tests and builds, local commits, research and drafts.

`.claude/settings.json` makes the gated commands ask first. It still lists `git push`, GitHub and Supabase/Stripe CLI commands as ask-first until Luke updates that file himself.

## Orchestrator pattern

The main session is the orchestrator. It does not do large jobs itself. It:

1. Reads `docs/workflow-state.md` and picks the top unblocked task.
2. Splits it into small tasks that each fit one agent and one session.
3. Hands each task to the right agent in `.claude/agents/`, with the exact files it needs.
4. Checks the agent's output (tests, build log, sources) before marking the task done.
5. Updates `docs/workflow-state.md` and stops at any approval gate.

| Agent | Does | Writes to |
|---|---|---|
| `researcher` | market, competitor, user, legal and pricing research | `docs/research/` |
| `developer` | architecture, features, bug fixes, tests | `src/`, `supabase/`, `tests/`, `docs/dev/` |
| `app-builder` | assembly, build/run scripts, environment checks, deploy runbooks, release readiness | `docs/builds/`, `scripts/` |
| `marketer` | positioning, landing copy, launch posts, growth experiments | `marketing/` |

To save tokens and time: give agents file paths, not pasted content. Use one agent at a time unless two tasks are clearly independent. Do small edits yourself without an agent.

## Handoff protocol

- Every agent reads only the files its task needs.
- When an agent finishes or stops, it updates its task in `docs/workflow-state.md`: status, what changed (file paths), how it was verified, and the next action. It also adds one line to the session log.
- Statuses: `todo`, `doing`, `blocked`, `needs-approval`, `done`.
- A task is `done` only when its verification is written down.
- Anything a future session would have to ask Luke again goes in `docs/decisions.md` (if it is a decision) or `docs/workflow-state.md` (if it is state).

## Directory structure

```
CLAUDE.md                 this guide
DESIGN_RULES.md           mobile design rules, read before any UI task
.claude/agents/           the four sub-agents
.claude/settings.json     approval gates as permission rules
.github/workflows/ci.yml  runs database and browser tests on every push
docs/
  workflow-state.md       backlog, status, waiting on Luke, session log
  decisions.md            locked business rules and their dates
  research/               cited research briefs
  dev/                    CHANGELOG.md, architecture.md, history/ (earlier build notes)
  builds/                 SETUP.md (go-live runbook), build-log.md, release checklist
marketing/                positioning/, landing/, posts/, experiments/
src/                      the app (plain JavaScript, Vite, installable web app)
supabase/                 migrations/ (tables, security rules, booking logic), functions/ (server code)
tests/                    db.test.mjs and e2e.test.mjs
scripts/                  local test stand-ins for Supabase and Stripe, db reset
public/                   icons, manifest, service worker
archive/prototypes/       v10 and v11 single-file prototypes (reference only, do not edit)
index.html, admin.html    app entry and staff admin site (/admin, desktop only)
```

## Tech stack

Keep the existing stack. Do not add a paid service or a framework without Luke's approval.

- **App:** Vite and plain JavaScript (ES modules), installable home-screen web app (PWA). No app-store build, which avoids the Apple developer fee.
- **Back end:** Supabase: Postgres with row-level security, where booking logic and the rules above live in the database; email 6-digit-code logins; photo storage; Edge Functions (Deno, TypeScript); pg_cron for automatic sign-off.
- **Money and ID:** Stripe Connect Express, with separate charges and transfers. Stripe Identity handles the 18+ check. Stripe stays in test mode until Embr is incorporated and Luke approves.
- **Email:** Resend.
- **Hosting:** Cloudflare Pages. Its free-plan terms for commercial use are not yet verified (task R1).
- **CI:** GitHub Actions.
- **Design references:** Mobbin. **Marketing visuals:** Canva.

More detail is in `docs/dev/architecture.md`.

## Coding standards

- Plain JavaScript (ES modules) in `src/`, TypeScript in `supabase/functions/`. No new framework.
- Business rules belong in the database (security rules and SQL functions), not only in the app. Talent must never be able to read briefs or create offers.
- Money logic stays in `supabase/functions/_shared/payments.ts`. Every money change needs a test.
- Each schema change is a new file in `supabase/migrations/`. Never edit a migration that has already been deployed.
- Every feature or fix comes with a test in `tests/`, plus an entry in `docs/dev/CHANGELOG.md`.
- Phone first, UK English, GBP, en-GB dates. Keep the premium look of `src/style.css`.
- Every UI change follows `DESIGN_RULES.md`. If a rule doesn't fit, say why in the task note.
- Small commits with plain-English messages that say what changed for users.

### Running tests locally

Needs Postgres 16 on port 54329 (socket in `/tmp`, or set `PGHOST`/`DB_URL`).

```sh
npm install
sh scripts/db-reset.sh && npm run test:db
npm run build && npm run local-server &   # then:
npm run test:e2e                          # needs Playwright with Chromium
```

## Writing standards

- UK English. Plain, warm, confident. Short sentences.
- Premium and independent in tone, not corporate.
- Talent copy describes tools (bookings, payments, usage, travel, on-time pay), never getting work.
- Don't denigrate agencies (CAP Code). "Burn Agency Fees" is not a headline.
- Every factual claim cites its source in the draft's notes.
