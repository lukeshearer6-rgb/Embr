# Embr workflow state

This file is the single source of truth for what's happening. Every session reads it first and updates it before stopping. The dashboard (`docs/dashboard.html`) is generated from it with `npm run dashboard`, so keep the table layout exactly as it is.

Statuses: `todo`, `doing`, `blocked`, `needs-approval`, `done`. Agents: `researcher`, `developer`, `app-builder`, `marketer`, `luke`, `orchestrator`.

Last updated: 2026-11-24

## Current focus

Get the pilot online in Stripe test mode, run five full test bookings, then open the invite-only Manchester pilot.

## Agents now

| Agent | Working on | Status |
|---|---|---|
| researcher | R2 Incorporation and domain brief | todo |
| developer | No unblocked task (D2, D3, D5 waiting) | blocked |
| app-builder | B5 Release checklist for the invite-only pilot | todo |
| marketer | M1 Positioning pack | todo |

## Waiting on Luke

| ID | What Luke needs to do | Why |
|---|---|---|
| B2 | Create Supabase, Stripe (test mode), Resend and Cloudflare accounts (docs/builds/SETUP.md). Supabase signed up 2026-11-24; Stripe CLI installed on Luke's Mac (~/Documents/EMBR/tools/stripe-cli), login pending | Only Luke can sign up and hold the passwords |
| DR1 | Review and merge the 24 Nov daily run pull request (R1 brief, D4 agreement export); push approved by Luke 2026-11-24 | Merging is Luke's call |
| D4 | Choose a solicitor to review docs/dev/booking-agreement.md (see R3 for low-cost routes) | Contacting a real person needs Luke |

## Backlog

### Research

| ID | Task | Agent | Status | Verify by | Next action |
|---|---|---|---|---|---|
| R1 | Check Cloudflare Pages free-plan terms allow a commercial app | researcher | done | Every quote re-read on the live pages 2026-11-24; brief docs/research/r1-cloudflare-pages-free-plan.md | Unclear, leaning allowed; keep talent photos in Supabase Storage |
| R2 | Incorporation and domain: steps, official fees, cheapest compliant option | researcher | todo | Companies House and registrar pages cited | Write brief for Luke to approve spend |
| R3 | Routes to a specialist agency-law opinion at zero or low cost (law clinics, pro bono, founder schemes) | researcher | todo | Each route linked with eligibility | Write brief; Luke chooses who to contact |
| R4 | Competitor brief: UK platforms where brands book unsigned models and creatives | researcher | todo | Every claim linked to the platform's own pages | Write brief; hand to marketer |
| R5 | Brand interview kit: Manchester independent brand target list and interview script | researcher | todo | Public sources for each brand | Draft only; Luke makes contact |
| R7 | Book now, pay later: how talent get paid at sign-off before the brand pays. Cover credit risk and who carries it, Embr's cash position (zero), UK B2B pay-later and invoice-finance partners (e.g. Kriya, Two) and their terms, fit with Stripe Connect, whether it's FCA-regulated, and partner fees and who absorbs them | researcher | todo | Every figure and rule cited to the provider's pages, FCA or legislation.gov.uk | Write brief; Luke picks a partner to approach |
| R6 | CAP Code checklist for launch claims ("0% of your earnings", fee claims) | researcher | todo | CAP Code sections cited | Hand to marketer |

### Development

| ID | Task | Agent | Status | Verify by | Next action |
|---|---|---|---|---|---|
| D0 | Restructure pilot into the workspace layout, add CI, dashboard and agent docs | orchestrator | done | db and e2e tests passed locally on 2026-11-23 | None |
| D1 | Check CI passes on the first GitHub push | developer | done | Run 45287047084 green on 2026-11-23 | None |
| D2 | Test server functions against real Supabase and Stripe test mode | developer | blocked | Test-mode payments, payouts and ID check work | Waits on B3 |
| D3 | Fix anything found in the five test bookings | developer | blocked | Tests added for each fix | Waits on B4 |
| D5 | Build book now, pay later at the balance step with the chosen partner | developer | blocked | Tests cover on-terms balance and instant talent payout | Waits on R7 and Luke's partner choice |
| D4 | Export the booking agreement text for solicitor review | developer | done | npm run test:agreement 9/9 passed 2026-11-24 (exact match to `_agreement`); docs/dev/booking-agreement.md | Luke picks a solicitor (Waiting on Luke) |

### App build

| ID | Task | Agent | Status | Verify by | Next action |
|---|---|---|---|---|---|
| B1 | Push the workspace to a private GitHub repo | app-builder | done | github.com/lukeshearer6-rgb/Embr main at 53aa598 | None |
| B2 | Luke creates Supabase, Stripe test, Resend and Cloudflare accounts | luke | todo | Values collected per SETUP.md | Luke follows docs/builds/SETUP.md steps 1–3 |
| B3 | Deploy database, functions and app in test mode | app-builder | blocked | Build log saved, admin site loads | Waits on B2; needs approval |
| B4 | Run five full test-mode bookings, including a cancellation and a refund | app-builder | blocked | Build log with each booking's result | Waits on B3 |
| B5 | Release checklist for opening the invite-only pilot | app-builder | todo | Every item ticked with evidence | Write docs/builds/release-checklist.md |
| B6 | Domain and Resend sender on the domain | app-builder | blocked | Test email arrives from the domain | Waits on R2 and spend approval |

### Marketing

| ID | Task | Agent | Status | Verify by | Next action |
|---|---|---|---|---|---|
| M1 | Positioning pack: "Unsigned, not unseen" messaging for brands and talent | marketer | todo | Every claim traced to decisions or research | Draft in marketing/positioning/ |
| M2 | Founding talent invite DMs and brand invite emails | marketer | todo | Copy rules checked | Drafts only; Luke sends |
| M3 | Landing and waitlist copy (not public until B5) | marketer | todo | Claims checked against R6 | Draft in marketing/landing/ |
| M4 | Instagram launch posts for Luke's account | marketer | todo | Canva drafts, claims checked | Drafts only; Luke posts |
| M5 | Zero-cash growth experiments with one metric each | marketer | todo | No predicted results | Draft in marketing/experiments/ |

## Session log

Newest first. One line per session: date, agent, what happened.

- 2026-11-24 daily run: R1 Cloudflare terms brief (quotes verified) and D4 agreement export (test 9/9, added to CI) done; payment-safety PR #2 merged; push waiting on Luke (DR1).
- 2026-11-24 orchestrator: reviewed the Stripe integration; fixed lost webhooks, double balance charge/transfer after partial failure, staff sign-off double payment, over-broad Checkout fallback; added dispute/payout/deauthorized webhooks; tests/payments.test.mjs 6 checks pass, db 64 and e2e 32 pass. Branch claude/payment-safety committed locally, push waiting on Luke (B3).

- 2026-11-23 orchestrator: added the animated office view (docs/office.html, npm run office) driven by this file; 13 office checks pass; Luke approved push and pull request (2026-11-23).
- 2026-11-23 orchestrator: added book now, pay later to README and decisions (planned, not built); new tasks R7 and D5.
- 2026-11-23 orchestrator: pushed to github.com/lukeshearer6-rgb/Embr (Luke approved); CI tests green on first run.
- 2026-11-23 orchestrator: created the workspace (CLAUDE.md, four agents, decisions, backlog, CI, dashboard); pilot app moved to the repo root; local tests passed.
