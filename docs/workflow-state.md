# Embr workflow state

This file is the single source of truth for what's happening. Every session reads it first and updates it before stopping. The dashboard (`docs/dashboard.html`) is generated from it with `npm run dashboard`, so keep the table layout exactly as it is.

Statuses: `todo`, `doing`, `blocked`, `needs-approval`, `done`. Agents: `researcher`, `developer`, `app-builder`, `marketer`, `luke`, `orchestrator`.

Last updated: 2026-11-26

## Current focus

Get the pilot online in Stripe test mode, run five full test bookings, then open the invite-only Manchester pilot.

## Agents now

| Agent | Working on | Status |
|---|---|---|
| researcher | B9 Pilot terms and privacy notice drafts | todo |
| developer | No unblocked task (D2, D3, D5 waiting) | blocked |
| app-builder | B5 Release checklist (tick as work lands) | doing |
| marketer | M1 Positioning pack | todo |

## Waiting on Luke

| ID | What Luke needs to do | Why |
|---|---|---|
| B2 | Create Supabase, Stripe (test mode), Resend and Cloudflare accounts (docs/builds/SETUP.md). Supabase signed up 2026-11-24; Stripe CLI installed on Luke's Mac (~/Documents/EMBR/tools/stripe-cli), login pending | Only Luke can sign up and hold the passwords |
| D7 | Approve the brand-facing line "Talent can see how many brands viewed or saved their profile, never which brand" (talent Today screen, docs/dev/talent-engagement.md) before real brands join; it also belongs in the privacy notice | Public copy and a UK GDPR privacy-notice item |
| D6 | Add the talent agency-status declaration to the BPP review (docs/dev/agency-declaration.md, draft wording live in the test app only) | Legal wording needs the solicitor before real talent sign up |
| D8 | Shoot Thread (PR held for the final UI round): decide whether creatives may send their own priced "Custom Offers" (built as "Ask for a change" instead), whether to build a true single shoot payment, and approve the draft cancellation and protection wording on the shoot checkout (docs/dev/shoot-thread.md) | Agency position, live-money design and legal wording are Luke's calls |
| D4 | Send the enquiry to BPP's free online business clinic (draft: docs/dev/bpp-enquiry-draft.md; form linked in docs/research/r3-agreement-review-shortlist.md) | Contacting BPP is Luke's to do |

## Backlog

### Research

| ID | Task | Agent | Status | Verify by | Next action |
|---|---|---|---|---|---|
| R1 | Check Cloudflare Pages free-plan terms allow a commercial app | researcher | done | Every quote re-read on the live pages 2026-11-24; brief docs/research/r1-cloudflare-pages-free-plan.md | Unclear, leaning allowed; keep talent photos in Supabase Storage |
| R2 | Incorporation and domain: steps, official fees, cheapest compliant option | researcher | done | Figures re-read on gov.uk, ICO and Porkbun 2026-11-25; docs/research/r2-incorporation-and-domain.md | Deferred: Luke pays when ready; run as a pilot until then (Decision (Luke, 2026-11-26)). ICO tier 1 price conflicts (£52 vs £40) |
| R3 | Routes to a specialist agency-law opinion at zero or low cost (law clinics, pro bono, founder schemes) | researcher | done | Quotes re-read on live pages 2026-11-24; docs/research/r3-agreement-review-shortlist.md | Luke chooses who to contact |
| R4 | Competitor brief: UK platforms where brands book unsigned models and creatives | researcher | done | Claims re-read on each platform's live pages 2026-11-26; docs/research/r4-competitor-brief.md | Marketer reads it; no comparative claims in public copy without Luke |
| R5 | Brand interview kit: Manchester independent brand target list and interview script | researcher | todo | Public sources for each brand | Draft only; Luke makes contact |
| R7 | Book now, pay later: how talent get paid at sign-off before the brand pays. Cover credit risk and who carries it, Embr's cash position (zero), UK B2B pay-later and invoice-finance partners (e.g. Kriya, Two) and their terms, fit with Stripe Connect, whether it's FCA-regulated, and partner fees and who absorbs them | researcher | todo | Every figure and rule cited to the provider's pages, FCA or legislation.gov.uk | Write brief; Luke picks a partner to approach |
| R6 | CAP Code checklist for launch claims ("0% of your earnings", fee claims) | researcher | done | Rule numbers and quotes re-read on asa.org.uk 2026-11-25; docs/research/r6-cap-code-checklist.md | Marketer uses the checklist for M1-M5 |

### Development

| ID | Task | Agent | Status | Verify by | Next action |
|---|---|---|---|---|---|
| D0 | Restructure pilot into the workspace layout, add CI, dashboard and agent docs | orchestrator | done | db and e2e tests passed locally on 2026-11-23 | None |
| D1 | Check CI passes on the first GitHub push | developer | done | Run 45287047084 green on 2026-11-23 | None |
| D2 | Test server functions against real Supabase and Stripe test mode | developer | blocked | Test-mode payments, payouts and ID check work | Waits on B3 |
| D3 | Fix anything found in the five test bookings | developer | blocked | Tests added for each fix | Waits on B4 |
| D5 | Build book now, pay later at the balance step with the chosen partner | developer | blocked | Tests cover on-terms balance and instant talent payout | Waits on R7 and Luke's partner choice |
| D4 | Export the booking agreement text for solicitor review | developer | done | npm run test:agreement 9/9 passed 2026-11-24 (exact match to `_agreement`); docs/dev/booking-agreement.md | Luke picks a solicitor (Waiting on Luke) |
| D8 | Rebuild the brand board as a native phone screen (role pills, filter sheet, photo-first cards) from Mobbin research | developer | needs-approval | e2e 39 and db 77 passed 2026-11-25; docs/dev/board-mobile.md has Mobbin refs and before/after | Held for Luke's final UI round: merge the PR when he folds it in |
| D9 | Reusable mobile CreativeCard (swipeable photos, video tile, rating when real, Add to shoot) from Mobbin research, built on D8 | developer | needs-approval | e2e 40 and db 77 passed 2026-11-25; docs/dev/creative-card.md has Mobbin refs and before/after | Held for Luke's final UI round: merge after D8; needs `supabase db push` for the card media migration |
| D10 | Shoot Roster: group creatives under one shoot date and place, combined cost, missing-role prompts, send every offer at once (one offer per creative, payments unchanged), built on D9 | developer | needs-approval | e2e 41 and db 77 passed 2026-11-25; docs/dev/shoot-roster.md has Mobbin refs and before/after | Held for Luke's final UI round: merge after D9. A single combined payment would need new payment work (not built) |
| D11 | Rates and availability editor (full/half-day packages, blocked date ranges) and brand-facing creative detail screen with sticky "Add to shoot" bar, built on D10 | developer | needs-approval | db 82 and e2e 43 passed 2026-11-25; docs/dev/rates-and-detail.md has Mobbin refs and before/after | Held for Luke's final UI round: merge after D10, then `supabase db push` for 20261125000007_rate_packages.sql. Optional later: bookings.package column so half days are labelled on the booking screen |
| D13 | Shoot Day Hub: confirmed roster, call times, map directions, group chat, post-shoot tracker over the existing wrap and sign-off, built on the Shoot Thread PR | developer | needs-approval | e2e 45 and db 94 passed 2026-11-25; docs/dev/shoot-day-hub.md has Mobbin refs and before/after | Held for Luke's final UI round: merge after the Shoot Thread PR. No migration. Deliverables and reviews need new tables (listed in the doc) |
| D14 | Phone polish: one type scale, card padding, safe areas and 48px targets across PRs 27-33; skeleton loaders for the board and creative profile; empty states for no results, an empty Shoot Roster and a new creator profile | developer | needs-approval | e2e 46, db 94, payments 11 passed 2026-11-25; docs/dev/mobile-polish.md has Mobbin refs and before/after | Held for Luke's final UI round: merge after the Shoot Day Hub PR. No migration. Tab bar restructure and the phone dialog grabber left for Luke's call |

### App build

| ID | Task | Agent | Status | Verify by | Next action |
|---|---|---|---|---|---|
| B1 | Push the workspace to a private GitHub repo | app-builder | done | github.com/lukeshearer6-rgb/Embr main at 53aa598 | None |
| B2 | Luke creates Supabase, Stripe test, Resend and Cloudflare accounts | luke | todo | Values collected per SETUP.md | Luke follows docs/builds/SETUP.md steps 1–3 |
| B3 | Deploy database, functions and app in test mode | app-builder | blocked | Build log saved, admin site loads | Waits on B2; needs approval |
| B4 | Run five full test-mode bookings, including a cancellation and a refund | app-builder | blocked | Build log with each booking's result | Waits on B3 |
| B5 | Release checklist for opening the invite-only pilot | app-builder | doing | Every item ticked with evidence | docs/builds/release-checklist.md written 2026-11-26 (83 items, 12 evidenced, IDs and paths checked); tick items as B2, B3, B4 and B9 land |
| B9 | Write the pilot terms and privacy notice the sign-in screen already links to (src/views/auth.js line 48), plus a support route and incident routine | researcher | todo | Each clause traced to decisions, UK GDPR/ICO guidance or the BPP advice | Draft only; legal wording goes to Luke and BPP before real users |
| B6 | Domain and Resend sender on the domain | app-builder | blocked | Test email arrives from the domain | Waits on R2 and spend approval |
| B7 | Stripe restricted key for ID-check date of birth (STRIPE_IDENTITY_KEY: "Identity Verification Results" + "Recent Detailed Verification Results", Read). Not offered in the test sandbox on 2026-11-25; until then passed checks go to admin People, "ID checks to confirm" | luke | blocked | A passed test ID check shows Verified 18+ without staff | Retry when Identity is activated for the account, before launch |
| B8 | Move payout account creation to Stripe Accounts v2 (POST /v2/core/accounts, recipient config, express dashboard). New Stripe platforms block v1 account creation unless "Accounts v1 support" is switched on (test sandbox: switched on 2026-11-25 as a stopgap). Check v1 account links, transfers, accounts.retrieve and account.updated still work for v2 accounts; every money change needs a test | developer | doing | payments tests pass with a v2-created account; live sandbox payout onboarding works with v1 support switched off | Code switched to v2 2026-11-25 (payments 11/11). Recipient accounts need losses_collector 'application', which Stripe only allows once the Connect platform profile is finished (Luke asked 2026-11-25 18:30); confirm transfers and account.updated on the first live-sandbox booking |

### Marketing

| ID | Task | Agent | Status | Verify by | Next action |
|---|---|---|---|---|---|
| M1 | Positioning pack: "Unsigned, not unseen" messaging for brands and talent | marketer | todo | Every claim traced to decisions or research | Draft in marketing/positioning/ |
| M2 | Founding talent invite DMs and brand invite emails | marketer | todo | Copy rules checked | Drafts only; Luke sends |
| M3 | Landing and waitlist copy (not public until B5) | marketer | todo | Claims checked against R6 | Draft in marketing/landing/ |
| M4 | Instagram launch posts for Luke's account | marketer | todo | Canva drafts, claims checked | Drafts only; Luke posts |
| M5 | Zero-cash growth experiments with one metric each | marketer | todo | No predicted results | Draft in marketing/experiments/ |

## Session log

- 2026-11-26 orchestrator: removed the welcome-screen fee line on Luke's word (e2e 47 passed); incorporation and domain spend deferred until Luke is ready.
- 2026-11-26 daily run: R4 competitor brief (claims re-read live) and B5 release checklist (83 items, 12 evidenced) done; new task B9 for the missing pilot terms and privacy notice; sign-in fee line flagged for Luke.
- 2026-11-26 orchestrator: final UI round shipped on Luke's go. PRs 27, 28, 29, 31, 32, 33, 34 merged with 35 (phone tab bar: Profile/Account in the bar, Today, Links, Jobs and Shortlist under More). Migrations 000006 to 000008 pushed to the pilot; Pages deployed from Luke's Mac (build 3915c7e, site returns 200 with the new assets). Tests: db 94, e2e 46, payments 11, agreement 9; CI green on every PR.
- 2026-11-25 developer: D14 phone polish (type, padding, safe areas, skeletons, empty states) on a PR stacked on the Shoot Day Hub PR (not merged); e2e 46.
- 2026-11-25 developer: D13 Shoot Day Hub on a PR stacked on the Shoot Thread PR (not merged); e2e 45, db 94; no database changes.
- 2026-11-25 developer: Shoot Thread built on a branch stacked on PR 31 (shoot brief, offer and change cards, message everyone, one shoot checkout over the existing per-booking deposits); db 94 and e2e 44 pass; three questions added to Waiting on Luke (D8); not merged or deployed.

Newest first. One line per session: date, agent, what happened.

- 2026-11-25 developer: D11 rates editor and creative detail screen on a PR stacked on D10 (not merged); db 82, e2e 43.
- 2026-11-25 developer: D10 Shoot Roster on a PR stacked on D9 (not merged); e2e 41, db 77.
- 2026-11-25 developer: D9 CreativeCard on a PR stacked on D8 (not merged); e2e 40, db 77.
- 2026-11-25 developer: D8 brand board rebuilt as a native phone screen on a PR (not merged; Luke wants all UI fixes in one final round); e2e 39, db 77.
- 2026-11-25 orchestrator: wrote DESIGN_RULES.md from Mobbin (Airbnb, Fiverr, Peerspace, Behance, Spotify; iOS) plus Apple and Android touch-target guidance; linked from CLAUDE.md and the developer, app-builder and marketer agents. Gaps in the current app listed in the file, app code unchanged.
- 2026-11-25 orchestrator: interface round 2 (black header and money blocks, photo-led board, orange needs-you block, motion) after Luke chose a mix of three Mobbin-backed directions; e2e 38 and db 77 passed.
- 2026-11-25 orchestrator: interface round 1 from Mobbin references (brief fit reasons, talent offer pay beside Accept, Today next step first); docs/dev/interface-redesign.md; e2e 38 and db 77 passed.
- 2026-11-25 daily run: R2 incorporation and domain brief and R6 CAP Code checklist done, every figure and rule re-read on the live pages; spend approval added to Waiting on Luke.
- 2026-11-25 marketer: talent engagement design written (docs/dev/talent-engagement.md; Mobbin studied, 6 features ranked, build spec for developer); no app code changed; Luke to review and hand to developer.
- 2026-11-24 orchestrator: pushed the daily run (PR #3, Luke approved); R3 shortlist done (MMU Business Law Cafe, BPP Enterprise Clinic, Law Society Find a Solicitor), quotes verified; PR #3 merged by Luke; R3 pushed.
- 2026-11-24 orchestrator: Luke loosened the approval gates (agents push and merge their own PRs, change test setup); CLAUDE.md and decisions updated; .claude/settings.json left for Luke.
- 2026-11-24 orchestrator: Luke chose BPP's free online business clinic for the agreement review; application route verified on BPP's pages, enquiry drafted; recorded in decisions.
- 2026-11-24 daily run: R1 Cloudflare terms brief (quotes verified) and D4 agreement export (test 9/9, added to CI) done; payment-safety PR #2 merged; push waiting on Luke (DR1).
- 2026-11-24 orchestrator: reviewed the Stripe integration; fixed lost webhooks, double balance charge/transfer after partial failure, staff sign-off double payment, over-broad Checkout fallback; added dispute/payout/deauthorized webhooks; tests/payments.test.mjs 6 checks pass, db 64 and e2e 32 pass. Branch claude/payment-safety committed locally, push waiting on Luke (B3).

- 2026-11-23 orchestrator: added the animated office view (docs/office.html, npm run office) driven by this file; 13 office checks pass; Luke approved push and pull request (2026-11-23).
- 2026-11-23 orchestrator: added book now, pay later to README and decisions (planned, not built); new tasks R7 and D5.
- 2026-11-23 orchestrator: pushed to github.com/lukeshearer6-rgb/Embr (Luke approved); CI tests green on first run.
- 2026-11-23 orchestrator: created the workspace (CLAUDE.md, four agents, decisions, backlog, CI, dashboard); pilot app moved to the repo root; local tests passed.
