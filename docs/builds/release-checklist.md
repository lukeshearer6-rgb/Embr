# Release checklist: opening the invite-only Manchester pilot

Task B5. Written 2026-11-26. Status is taken only from what the repo shows. A box is ticked only where a test, file or log line is cited. Everything else stays unticked with the backlog ID that covers it. No dates or figures here are estimates: each one cites its source.

How to read an item: **Done means** (the test of done), **Evidence** (what to attach), **Owner** (agent or Luke), **Status**. **APPROVAL** marks anything that needs Luke under the CLAUDE.md "Approval gates" (deploy anything public or live, publish or send, contact anyone, spend, credentials or secrets, Stripe live mode, legal or pricing claims in public copy).

Known gaps in the evidence itself:
- `docs/builds/build-log.md` has no entries yet, so no build or test result is logged there. Test counts below come from `docs/workflow-state.md` (session log 2026-11-26 and the D-task rows), which is the only repo record.
- `docs/workflow-state.md` session log (2026-11-26) says migrations 000006 to 000008 were pushed to the pilot and Pages was deployed from Luke's Mac, while rows B2 and B3 still read `todo` and `blocked`. The two disagree. Reconcile them before relying on either.
- No privacy notice, pilot terms document or incident/support process exists in the repo (searched `docs/`, `src/`).

---

## 1. Accounts and environment

- [ ] **Supabase, Stripe (test), Resend and Cloudflare accounts exist and the values are collected.**
  Done means: all four accounts created, values noted per `docs/builds/SETUP.md` steps 1 to 3. Evidence: Luke confirms in `docs/workflow-state.md` (B2). Owner: Luke. Backlog: **B2**. Status: partial (Supabase signed up 2026-11-24, Stripe CLI installed, login pending, per Waiting on Luke row B2). **APPROVAL** (account creation, credentials).
- [ ] **Stripe Connect platform profile finished.**
  Done means: Stripe accepts Embr as losses collector so v2 recipient accounts can be created. Evidence: a sandbox payout account created and logged. Owner: Luke. Backlog: **B8**. Status: open (B8 row: Luke asked 2026-11-25). **APPROVAL** (account settings).
- [x] **Local environment builds and tests pass.**
  Done means: `npm run build`, db, payments, e2e and agreement tests all pass. Evidence: db 94, e2e 46, payments 11, agreement 9, CI green on every PR (`docs/workflow-state.md`, session log 2026-11-26); CI definition `.github/workflows/ci.yml`. Owner: app-builder. Backlog: **B3** (a fresh run with versions must still be written to `docs/builds/build-log.md`). Status: ticked on the session-log evidence; no build-log entry yet.
- [ ] **Environment versions recorded.**
  Done means: Node, npm, Postgres 16, Playwright/Chromium and Supabase CLI versions in the build log. Evidence: entry in `docs/builds/build-log.md`. Owner: app-builder. Backlog: **B3**. Status: open (build log empty).
- [ ] **Production-style build size and date logged.**
  Done means: `npm run build` output and `dist` size in the build log. Evidence: `docs/builds/build-log.md`. Owner: app-builder. Backlog: **B3**.
- [ ] **Secrets set in Supabase and none committed.**
  Done means: `STRIPE_SECRET_KEY`, `APP_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_HOOK_SECRET`, `CRON_SECRET`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET` set (SETUP.md steps 4 and 5); `run_secret_scanning` or a grep shows no keys in git. Evidence: `npx supabase secrets list` names (not values) pasted in the build log. Owner: Luke sets, app-builder verifies. Backlog: **B3**. **APPROVAL** (secrets). Note: `docs/dev/security-review-2026-11-24.md` states keys live in Supabase secrets, not in the app or git; that is a review by reading, not a scan.
- [ ] **`STRIPE_IDENTITY_KEY` restricted key set.**
  Done means: a passed test ID check shows Verified 18+ without staff. Evidence: build log entry. Owner: Luke. Backlog: **B7** (blocked: permissions not offered in the test sandbox on 2026-11-25). **APPROVAL** (credentials).

## 2. Database and security rules

- [x] **Row-level security and function guards tested.**
  Done means: all tables have RLS, users have no direct table access, every user-callable function checks the caller. Evidence: `docs/dev/security-review-2026-11-24.md` ("What was checked and held up", by reading); `tests/db.test.mjs` (94 checks per workflow-state). Owner: developer. Status: ticked. Note: the review says it is not a penetration test.
- [x] **Talent can never see briefs or create offers.**
  Done means: enforced in the database. Evidence: `tests/db.test.mjs` lines 174 and 176 ("talent can never see briefs (nothing to apply for)", "talent can't create offers"). Owner: developer. Status: ticked.
- [x] **Invite-only sign-up.**
  Done means: talent cannot join without an invite, invite works once, staff need a staff invite. Evidence: `tests/db.test.mjs` lines 58, 64, 67, 71, 81. Owner: developer. Status: ticked.
- [x] **Security headers served.**
  Done means: CSP, HSTS and no framing on pages. Evidence: `public/_headers`; browser test "typed-in text shows as text, never runs as code, and pages send the security headers" (`tests/e2e.test.mjs` line 730). Owner: developer. Status: ticked for the local server. Confirm on the live host (section 6).
- [ ] **Migrations applied to the pilot test project in order.**
  Done means: all 12 files in `supabase/migrations/` (20261123000001 to 20261125000008) applied with `supabase db push`. Evidence: `supabase migration list` output in the build log. Owner: app-builder. Backlog: **B3**. Status: open. The session log says 000006 to 000008 were pushed; earlier ones are not logged. Changing the test project schema is permitted autonomously (CLAUDE.md); the live project is not.
- [ ] **Staff first-invite bootstrap run once and the staff invite stored safely.**
  Done means: `supabase/setup/after-deploy.sql` run, staff code kept by Luke. Evidence: admin sign-in works (section 6). Owner: Luke. Backlog: **B3**. **APPROVAL** (credentials).
- [ ] **Known accepted risks reviewed before real data.**
  Done means: Luke decides on the four items under "Known, accepted for the test pilot" (public Book-me booked dates, photo uploads by brands, no automatic transfer reversal after refund, old Stripe API version `2024-12-18.acacia` to be upgraded before live). Evidence: decision in `docs/decisions.md`. Owner: Luke with developer. Backlog: **D3** (fixes), **D2**.
- [ ] **Independent security test before real money or personal data at scale.**
  Done means: written report. Evidence: report path in `docs/dev/`. Owner: Luke. Backlog: none yet (raised in `docs/dev/security-review-2026-11-24.md`). **APPROVAL** (spend, contacting a third party).

## 3. Payments: Stripe test mode, then live

Test mode first.
- [x] **Money logic failure cases covered.**
  Done means: webhook retries run once, no double balance charge or transfer, late second payment refunded. Evidence: `tests/payments.test.mjs` (11 checks per workflow-state), e.g. line 63 and line 97 to 99. Owner: developer. Status: ticked.
- [x] **Fees, deposit and sign-off rules tested in the database.**
  Done means: 10% first-booking brand fee, 50% deposit, 72-hour clock, dispute pause and refund record. Evidence: `tests/db.test.mjs` lines 182, 224, 228, 314, 318. Owner: developer. Status: ticked.
- [ ] **Server functions work against real Supabase and Stripe test mode.**
  Done means: test payments, payouts and ID check work. Evidence: build log. Owner: developer. Backlog: **D2** (waits on **B3**).
- [ ] **Stripe Accounts v2 payout onboarding works with v1 support switched off.**
  Done means: sandbox payout onboarding, transfers and `account.updated` confirmed on a live-sandbox booking. Evidence: build log; payments tests with a v2 account (code switched 2026-11-25, payments 11/11 per B8 row). Owner: developer. Backlog: **B8**.
- [ ] **Webhooks created and verified (test mode).**
  Done means: both endpoints from SETUP.md step 5 exist, events delivered with a 200 in Stripe's event log. Evidence: Stripe event log screenshot or build log line. Owner: Luke creates, app-builder verifies. Backlog: **B3**. **APPROVAL** (webhook and key changes; test-setup changes by agents are permitted, anything touching credentials is not).
- [ ] **Five test-mode bookings run, including a cancellation and a refund.**
  Done means: see section 9. Backlog: **B4**.
- [ ] **Stripe API version upgraded before live mode.**
  Done means: version bumped and `tests/payments.test.mjs` still passes. Evidence: `docs/dev/CHANGELOG.md` entry. Owner: developer. Backlog: **D2**.
- [ ] **Reversal on refund after payout decided.**
  Done means: Luke decides whether transfers are reversed automatically (current behaviour: alert staff only, per security review). Evidence: `docs/decisions.md`. Owner: Luke with developer. Backlog: **D3**.

Live mode (after test mode is clean).
- [ ] **Embr incorporated and spend approved.**
  Done means: company registered, domain and ICO fee paid. Evidence: Luke's approval in `docs/decisions.md`; sources in `docs/research/r2-incorporation-and-domain.md` (verified: £100 Companies House, £52 or £40 ICO tier 1 conflict unresolved, $5.66 .co.uk at Porkbun; checked 2026-11-25). Owner: Luke. Backlog: **R2**. **APPROVAL** (spend).
- [ ] **Stripe activated with company details; keys, Connect and webhooks repeated in live mode.**
  Done means: SETUP.md section 8 step 1 complete, live secrets set, one real small payment refunded. Evidence: build log. Owner: Luke. Backlog: **B3**. **APPROVAL** (Stripe live mode, live money, credentials).
- [ ] **Talent payout losses decision confirmed in live mode.**
  Done means: Embr as losses collector accepted for live. Evidence: `docs/decisions.md` "Payout account losses (2026-11-25)" already records it for the pilot. Owner: Luke. Backlog: **B8**. **APPROVAL** (live money).
- [ ] **Book now, pay later kept out of the pilot.**
  Done means: not built, not advertised. Evidence: `docs/decisions.md` (not built in the pilot yet); `docs/research/r6-cap-code-checklist.md` section 4. Owner: orchestrator. Backlog: **R7**, **D5**. Status: open until Luke confirms it is out of scope for opening.

## 4. ID and 18+ checks

- [x] **Under-18s refused at sign-up.**
  Evidence: `tests/db.test.mjs` line 69. Owner: developer. Status: ticked.
- [x] **Passed ID check with no date of birth goes to staff review, never "under 18".**
  Evidence: `tests/db.test.mjs` lines 201 and 206; admin People page test `tests/e2e.test.mjs` line 736. Owner: developer. Status: ticked (fallback only).
- [ ] **Stripe Identity turned on and a test check passes end to end.**
  Done means: test ID check returns Verified 18+. Evidence: build log. Owner: Luke turns on, app-builder verifies. Backlog: **B7**, **D2**. **APPROVAL** (account settings). SETUP.md step 2.4 says first 50 checks free then £1.25 each: not yet re-verified against Stripe's own page; check before relying on it (hard rule 1).
- [ ] **Identity privacy wording matches what is collected.**
  Done means: privacy notice names Stripe Identity, the selfie and document check and the date-of-birth use. Evidence: privacy notice path (section 7). Owner: marketer drafts, Luke approves. Backlog: none yet; see section 7.

## 5. Email

- [ ] **Six-digit sign-in code email works through Resend SMTP.**
  Done means: Supabase custom SMTP on, Email OTP length 6, templates set per SETUP.md step 1.4 and 3.3, code arrives. Evidence: build log. Owner: Luke configures, app-builder verifies. Backlog: **B3**. **APPROVAL** (credentials; sending to real addresses).
- [ ] **Booking emails send via the `send-email` function.**
  Done means: each booking email arrives in test mode. Evidence: build log per booking. Owner: app-builder. Backlog: **B3**, **B4**.
- [ ] **Sender on Embr's domain.**
  Done means: Resend domain verified, a test email arrives from the domain (SPF/DKIM pass). Evidence: build log. Owner: app-builder with Luke. Backlog: **B6** (waits on **R2**). **APPROVAL** (spend, DNS and credentials). Until then Resend only sends to Luke's own address (SETUP.md step 3.2).
- [ ] **Invite emails and DMs drafted, checked and sent by Luke.**
  Done means: drafts pass copy rules and CAP Code 2.2 and section 10 (`docs/research/r6-cap-code-checklist.md` section 7; PECR not researched). Evidence: draft paths in `marketing/`. Owner: marketer drafts, Luke sends. Backlog: **M2**. **APPROVAL** (publish or send, contact real people).

## 6. Hosting and domain

- [x] **Cloudflare Pages free-plan terms checked.**
  Done means: brief with quotes. Evidence: `docs/research/r1-cloudflare-pages-free-plan.md` (checked 2026-11-24). Result: "Unclear, leaning allowed"; no clause bars commercial use, none expressly permits it, no service guarantee. Keep talent photos in Supabase Storage. Owner: researcher. Backlog: **R1**. Status: ticked as researched; Luke should accept the "unclear" finding explicitly (see next item).
- [ ] **Luke accepts the hosting terms risk or moves host.**
  Done means: decision recorded. Evidence: `docs/decisions.md`. Owner: Luke. Backlog: **R1**.
- [x] **Test site deployed to Pages and returns 200.**
  Evidence: `docs/workflow-state.md` session log 2026-11-26 ("Pages deployed from Luke's Mac (build 3915c7e, site returns 200 with the new assets)"). Owner: app-builder. Backlog: **B3**. Status: ticked on that line only. It conflicts with B3 `blocked`; no build-log entry exists. Treat as unconfirmed until logged.
- [ ] **Admin site reachable on desktop at `/admin`; talent and brands cannot use it.**
  Done means: staff sign-in on `admin.html` works on the hosted site. Evidence: hosted check in build log; local test `tests/e2e.test.mjs` lines 80 and 755 already cover the rule. Owner: app-builder. Backlog: **B3**.
- [ ] **Security headers confirmed on the hosted site.**
  Done means: response headers from the Pages URL match `public/_headers`. Evidence: `curl -I` output in build log. Owner: app-builder. Backlog: **B3**.
- [ ] **Own domain added to Pages, `APP_URL`, Supabase Site URL and Resend sender updated.**
  Done means: SETUP.md section 8 step 3 complete. Evidence: build log. Owner: Luke. Backlog: **R2**, **B6**. **APPROVAL** (spend, live domain, secrets).
- [ ] **PWA installable on iPhone and Android.**
  Done means: Add to Home Screen opens full-screen on a real iPhone (Safari) and Android phone (Chrome). Evidence: Luke's confirmation plus screenshots in build log. Owner: Luke tests. Backlog: **B3**. Partial: `public/manifest.webmanifest` (standalone, start_url `/`), `public/sw.js` and four icons in `public/icons/` exist; no device test is recorded.
- [ ] **Public deploy to a live domain.**
  Done means: Luke says go. Owner: Luke. **APPROVAL** (deploy anything public or live). No public teaser until the app can take a real paid booking (`docs/decisions.md`, 2026-11-23).

## 7. Legal and policies

- [x] **Booking agreement text exported for review.**
  Evidence: `docs/dev/booking-agreement.md`; `npm run test:agreement` 9/9 (`docs/workflow-state.md` D4). Owner: developer. Backlog: **D4**. Status: ticked.
- [ ] **BPP clinic enquiry sent.**
  Done means: Luke submits the enquiry; no other adviser approached meanwhile. Evidence: Luke's confirmation. Draft: `docs/dev/bpp-enquiry-draft.md`; route: `docs/research/r3-agreement-review-shortlist.md`; decision: `docs/decisions.md` "Legal review (2026-11-24)". Owner: Luke. Backlog: **D4**. **APPROVAL** (contact a real organisation).
- [ ] **Agreement reviewed by BPP and changes made.**
  Done means: written feedback received, agreement function changed in a new migration, test updated. Evidence: feedback path in `docs/dev/` and new migration. Owner: developer after Luke. Backlog: **D4**.
- [ ] **Agency-status declaration reviewed by the solicitor.**
  Done means: wording approved or changed; version string updated. Evidence: `docs/dev/agency-declaration.md`; db tests at `tests/db.test.mjs` lines 73 and 77 already cover the mechanics (draft wording `agency-v1`, 2026-11-25). Owner: Luke asks BPP, developer updates. Backlog: **D6**. **APPROVAL** (legal wording).
- [ ] **Agency-law opinion before talent are charged anything.**
  Done means: written opinion. Not needed to open while founding talent are free (`docs/decisions.md` Agency position, Product and money). Owner: Luke. Backlog: **D6**. **APPROVAL**.
- [ ] **Privacy notice written, reviewed and linked.**
  Done means: notice covers data collected, Stripe, Supabase, Resend, Stripe Identity, retention and rights, and includes the D7 line "Talent can see how many brands viewed or saved their profile, never which brand". Evidence: notice path (not yet in repo). The sign-in screen already links to "pilot terms and privacy notice" (`src/views/auth.js` line 48) but no such documents exist. Owner: marketer drafts, Luke approves after review. Backlog: **D7**, **D6**. **APPROVAL** (legal and public copy).
- [ ] **Pilot terms written, reviewed and linked.**
  Done means: terms document live at a link the app uses. Evidence: path. Owner: marketer drafts, Luke approves. Backlog: **D6**, **D4**. **APPROVAL** (legal wording).
- [ ] **D7 brand-facing line approved.**
  Evidence: Luke's decision in `docs/decisions.md`. Owner: Luke. Backlog: **D7**. **APPROVAL** (public copy).
- [ ] **D8 shoot wording and Custom Offers question answered.**
  Done means: Luke decides on creatives' own priced Custom Offers (agency position), single shoot payment, and cancellation and protection wording on the shoot checkout. Evidence: `docs/decisions.md`. Owner: Luke. Backlog: **D8**. **APPROVAL** (legal wording, live-money design).
- [ ] **ICO data protection fee paid and registration confirmed.**
  Done means: ICO registration number. Evidence: `docs/research/r2-incorporation-and-domain.md` (tier 1 price conflict, £52 or £40, unresolved; check the ICO fee form). Owner: Luke. Backlog: **R2**. **APPROVAL** (spend).
- [ ] **Trader identity shown once a legal entity exists.**
  Done means: company name and number on public pages (CAP Code 3.5 per R6 section 6, which flags it for checking). Owner: Luke. Backlog: **R2**.

## 8. Copy and CAP Code

Source: `docs/research/r6-cap-code-checklist.md` (rules re-read on asa.org.uk 2026-11-25; the brief notes its numbering differs from the briefing and the fetch tool returned fragments, so recheck the live page before quoting).

- [ ] **Evidence file held before any copy goes live (rule 3.7).**
  Done means: fee schedule, pilot terms, test payout timings, signed testimonial permission in one folder. Evidence: folder path. Owner: marketer. Backlog: **M3**.
- [ ] **"0% of your earnings" says who pays.**
  Done means: wording like "Talent keep 100% of their session fee. Brands pay the Embr fee." Note `src/views/auth.js` line 18 currently reads "Embr takes 0% of your fee" with no brand-fee qualifier; check it against R6 section 4 rules 3.1, 3.3, 3.7, 3.9, 3.10, 3.17. Owner: marketer and developer. Backlog: **M3**, **D3**. **APPROVAL** (pricing claim in public copy).
- [ ] **"Free for talent" and "free during the pilot" meet rules 3.23 to 3.26.**
  Done means: commitment and what happens after the pilot stated. Evidence: copy review note. Owner: marketer. Backlog: **M3**. **APPROVAL**.
- [ ] **"Paid instantly" removed or evidenced.**
  Done means: replaced by a measured, product-matching statement. Real payout timing is "unverified: needs measuring" (R6). Evidence: payout timings from the test bookings. Owner: marketer. Backlog: **B4**, **M3**. **APPROVAL**.
- [ ] **"Book now, pay later" absent from public copy.**
  Done means: no mention until built and reviewed. Evidence: grep of `src/`, `marketing/`. Owner: marketer. Backlog: **R7**, **D5**.
- [ ] **Free cancellation states the 7-day cut-off and 50% rule.**
  Owner: marketer. Backlog: **M3**. **APPROVAL**.
- [ ] **No agency denigration; any comparison factual and evidenced (3.33, 3.34, 3.41).**
  Owner: marketer. Backlog: **M1**, **R4** (competitor brief). **APPROVAL** (comparative claim).
- [ ] **Founding talent testimonials: permission, contact details, incentives disclosed (3.44 to 3.50).**
  Owner: marketer. Backlog: **M3**. **APPROVAL**.
- [ ] **Luke's Instagram posts labelled upfront (CAP 2.1).**
  Owner: Luke posts, marketer drafts. Backlog: **M4**. **APPROVAL** (publish).
- [ ] **No employment-agency language.**
  Done means: no "find work", "apply", "jobs for you" or "join to get work" for talent; "Let work find you" kept away from membership pricing (CLAUDE.md hard rule 2). Evidence: grep of `src/` and `marketing/` in build log. Owner: marketer. Backlog: **M3**. The Jobs tab sits under More on the phone tab bar (`docs/workflow-state.md` session log 2026-11-26): confirm it is brand-only.
- [ ] **Fee tiers confirmed for launch.**
  Done means: Luke confirms 10%, 7%, 5%, 5% (`docs/decisions.md`, "Pilot app, 2026-11-23; the tiers still need Luke's final confirmation"). Owner: Luke. Backlog: **M3**. **APPROVAL** (pricing).

## 9. Test bookings (B4)

All in Stripe test mode on the hosted test project. Each logged in `docs/builds/build-log.md` with result. Backlog for the whole section: **B4** (waits on **B3**).

- [ ] **Booking 1: full path** (offer, accept, deposit with test card `4242 4242 4242 4242`, wrap, sign-off, transfer visible under Connect). Procedure: SETUP.md section 7.
- [ ] **Booking 2: automatic sign-off after 72 hours** through the cron function. DB logic already tested (`tests/db.test.mjs` lines 224 and 228).
- [ ] **Booking 3: cancellation** more than 7 days before the shoot (free) and a second case within 7 days (talent get 50% of the session fee), both per `docs/decisions.md`.
- [ ] **Booking 4: refund** after deposit paid, plus a reported problem resolved by staff (state side tested at `tests/db.test.mjs` lines 314 to 318).
- [ ] **Booking 5: a repeat booking with the same talent** showing the 7% fee tier, or a booking-link booking at 5%.
- [ ] **Each booking: emails arrived, notifications shown, amounts match Stripe's dashboard, no stuck Checkout.**
- [ ] **Failures turned into tests and fixed.** Backlog: **D3**.
- [ ] **Payout timing recorded** for the "paid instantly" copy decision (section 8).

## 10. Monitoring and support

- [ ] **Stripe webhook failures and payout failures visible.**
  Done means: `payout.failed` and dispute webhooks produce an alert on the admin overview (disputes already show: `tests/db.test.mjs` line 316). Staff look daily during the pilot. Evidence: build log. Owner: app-builder. Backlog: **B3**.
- [ ] **Supabase project kept awake and its backup position known.**
  Done means: Luke knows free projects pause after a week of inactivity (SETUP.md note) and what backups the free plan gives. Backup terms not yet checked against Supabase's own page: unverified. Owner: app-builder. Backlog: **B3**.
- [ ] **Support route for pilot users.**
  Done means: one named inbox and a written reply routine, stated in the terms. No support doc exists in the repo. Owner: Luke decides, marketer drafts. Backlog: none yet (add a task). **APPROVAL** (public contact details).
- [ ] **Incident and data-breach routine written.**
  Done means: who does what if a payment goes wrong or personal data leaks (UK GDPR ICO notification duty not yet researched here: unverified). Owner: researcher then Luke. Backlog: none yet (add a task).
- [ ] **Pilot invite list approved.**
  Done means: Manchester brands and founding talent chosen. Owner: Luke. Backlog: **R5**, **M2**. **APPROVAL** (contact real people).

## 11. Rollback

- [ ] **Hosting rollback tested.**
  Done means: previous Pages deployment can be restored and the steps are in SETUP.md. Evidence: build log. Owner: app-builder. Backlog: **B3**. Not yet written in `docs/builds/SETUP.md`.
- [ ] **Database rollback plan written.**
  Done means: migrations are additive and never edited once deployed (CLAUDE.md coding standards); a fix is a new migration. Add a database export before each `supabase db push` on the live project. Owner: app-builder. Backlog: **B3**. **APPROVAL** (`supabase db push` on live).
- [ ] **Function rollback.**
  Done means: previous function version redeployable from git. Owner: app-builder. Backlog: **B3**. **APPROVAL** (`supabase functions deploy`).
- [ ] **Kill switches known.**
  Done means: how to pause new bookings, remove a pilot invite, and disable the Stripe webhook endpoints. Owner: app-builder documents, Luke holds the logins. Backlog: **B3**.
- [ ] **Return to test mode if a live-money fault appears.**
  Done means: live keys can be swapped back to test keys without data loss. Owner: Luke. **APPROVAL** (key changes).

---

## Go / no-go

All boxes above ticked with evidence, Luke's explicit go recorded in `docs/decisions.md`, then the public deploy (an **APPROVAL** item). A release is never ready with a failing test.
