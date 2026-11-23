# Embr workflow state

This file is the single source of truth for what's happening. Every session reads it first and updates it before stopping. The dashboard (`docs/dashboard.html`) is generated from it with `npm run dashboard`, so keep the table layout exactly as it is.

Statuses: `todo`, `doing`, `blocked`, `needs-approval`, `done`. Agents: `researcher`, `developer`, `app-builder`, `marketer`, `luke`, `orchestrator`.

Last updated: 2026-11-23

## Current focus

Get the pilot online in Stripe test mode, run five full test bookings, then open the invite-only Manchester pilot.

## Agents now

| Agent | Working on | Status |
|---|---|---|
| researcher | R1 Cloudflare Pages free-plan terms | done |
| developer | D1 Check CI passes on the first push | blocked |
| app-builder | B1 Push the workspace to GitHub | needs-approval |
| marketer | M1 Positioning pack | todo |

## Waiting on Luke

| ID | What Luke needs to do | Why |
|---|---|---|
| B1 | Create an empty private GitHub repo and send me its name, then approve the first push | The code needs a home before CI and deploys can work |
| B2 | Create Supabase, Stripe (test mode), Resend and Cloudflare accounts (docs/builds/SETUP.md) | Only Luke can sign up and hold the passwords |

## Backlog

### Research

| ID | Task | Agent | Status | Verify by | Next action |
|---|---|---|---|---|---|
| R1 | Check Cloudflare Pages free-plan terms allow a commercial app | researcher | done | Brief docs/research/2026-11-23-cloudflare-pages-free-plan.md; every quote re-checked against the live Cloudflare page on 2026-11-23; pilot build measured locally | Keep card entry on Stripe-hosted pages while on the free plan; optional written check with Cloudflare (Luke) |
| R2 | Incorporation and domain: steps, official fees, cheapest compliant option | researcher | todo | Companies House and registrar pages cited | Write brief for Luke to approve spend |
| R3 | Routes to a specialist agency-law opinion at zero or low cost (law clinics, pro bono, founder schemes) | researcher | todo | Each route linked with eligibility | Write brief; Luke chooses who to contact |
| R4 | Competitor brief: UK platforms where brands book unsigned models and creatives | researcher | todo | Every claim linked to the platform's own pages | Write brief; hand to marketer |
| R5 | Brand interview kit: Manchester independent brand target list and interview script | researcher | todo | Public sources for each brand | Draft only; Luke makes contact |
| R6 | CAP Code checklist for launch claims ("0% of your earnings", fee claims) | researcher | todo | CAP Code sections cited | Hand to marketer |

### Development

| ID | Task | Agent | Status | Verify by | Next action |
|---|---|---|---|---|---|
| D0 | Restructure pilot into the workspace layout, add CI, dashboard and agent docs | orchestrator | done | db and e2e tests passed locally on 2026-11-23 | None |
| D1 | Check CI passes on the first GitHub push | developer | blocked | GitHub Actions run is green | Waits on B1 |
| D2 | Test server functions against real Supabase and Stripe test mode | developer | blocked | Test-mode payments, payouts and ID check work | Waits on B3 |
| D3 | Fix anything found in the five test bookings | developer | blocked | Tests added for each fix | Waits on B4 |
| D4 | Export the booking agreement text for solicitor review | developer | todo | Text matches the `_agreement` function | Write docs/dev/booking-agreement.md |

### App build

| ID | Task | Agent | Status | Verify by | Next action |
|---|---|---|---|---|---|
| B1 | Push the workspace to a private GitHub repo | app-builder | needs-approval | Repo shows all commits | Luke creates repo and approves push |
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

- 2026-11-23 researcher: R1 done. No free-plan ban on commercial use found; §2.2.1(h) bans collecting card details on a free-plan site, which Embr avoids by using Stripe-hosted pages; pilot is far inside Pages limits.
- 2026-11-23 orchestrator: created the workspace (CLAUDE.md, four agents, decisions, backlog, CI, dashboard); pilot app moved to the repo root; local tests passed.
