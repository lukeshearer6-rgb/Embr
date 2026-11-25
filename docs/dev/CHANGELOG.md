# Changelog

Newest first. One entry per change: date, what changed for users, files, and tests.

## 2026-11-25: Brand board rebuilt as a native phone screen (held for the final UI round)
- Brands switch roles with a sideways row of pills (All, Model, UGC creator …, each with an icon) instead of a dropdown in a sentence.
- Applied filters show as pills (Filters with a count, date, city, day rate); each opens one filter sheet with Availability, Location, Day rate and, for models, sizes and height. The sheet's button shows how many people match before applying; "Clear all" resets.
- Board cards: photo first with the day rate on a small black pill, name, roles and city below; 48px save heart. Count reads "people", not "persons".
- Notes, Mobbin references and before/after: docs/dev/board-mobile.md.
- Files: `src/views/brand.js`, `src/icons.js`, `src/style.css`, `src/ui.js` (dialogs accept an extra class), `tests/e2e.test.mjs`.
- Tests: e2e 39 (new phone check for the filter sheet, live count and 48px targets), db 77.

## 2026-11-25: Interface round 2: black header and money, photo-led board, orange "needs you", motion
- Every screen: black header bar. Brand board: search in a black band; talent photos edge to edge with name, role, city, height and day rate on the photo (also on the shortlist).
- Talent Today: offers and setup in an orange block; earnings and seen/saved counts in one black block.
- Booking sheet: title block in black; the talent's offer bar ("You get", Decline, Accept) in black.
- Motion: cards rise in, meters and bars fill, figures fade up, buttons press. Off when the device asks for reduced motion.
- Notes and Mobbin references: docs/dev/interface-redesign.md (Round 2). Before/after: docs/dev/redesign/before-after-round2.png.
- Files: `src/style.css`, `src/views/common.js`, `src/views/brand.js`, `src/views/talent.js`, `tests/e2e.test.mjs`.
- Tests: e2e 38 (new checks: photo cards carry name, role and rate; search in the band; money block), db 77.

## 2026-11-25: Interface round 1: fit reasons, pay beside Accept, next step first
- Brands: each person in "Best fit for this brief" now shows why they fit (free on the date, where they're based, day rate against the brief, model details). Cards are wider so names don't wrap.
- Talent: a new offer shows "You get £X" in the footer beside Accept, so the pay is visible without scrolling.
- Talent Today: offers to answer, and the setup panel while the profile is new, now come before the earnings figures.
- Backed by Mobbin references: docs/dev/interface-redesign.md. Before/after: docs/dev/redesign/before-after-2026-11-25.png.
- Files: `src/views/brand.js`, `src/views/booking.js`, `src/views/talent.js`, `src/style.css`, `tests/e2e.test.mjs`.
- Tests: e2e 38 (new checks: fit reasons on the brief, pay in the offer footer, setup panel above earnings), db 77.

## 2026-11-25: "Set up payouts" works on Stripe's newer platforms
- New Stripe platforms refuse to create connected accounts the old way (Accounts v1), so "Set up payouts" failed with a Stripe message. Talent payout accounts are now created with Stripe Accounts v2 as recipients (they receive transfers; Embr pays Stripe's fees and carries losses; Express dashboard), using the request Stripe's own error message set out. If Stripe refuses a v1 onboarding link for such an account, Embr uses a v2 link. Platforms without v2 still get v1 Express accounts.
- Not yet proven against real Stripe: v1 transfers, account status and `account.updated` webhooks for v2 accounts (Stripe's docs say v2 account IDs work with v1 endpoints and v2 accounts still send `account.updated`). Check on the first test booking.
- Stripe refused Embr as the losses collector on a new platform (`account_creation_losses_collector_unavailable`), so Stripe is now the losses collector for talent accounts; Embr still pays the fees.
- Stripe then said recipient-only payout accounts can only have Embr as losses collector, so that is back to Embr. The first refusal means Embr's Connect platform profile in the Stripe Dashboard isn't finished; "Set up payouts" now says so and how to fix it.
- If both ways fail, the error now shows Stripe's Accounts v2 reason (with its code), not only the v1 refusal.
- Files: `supabase/functions/_shared/payments.ts`, `supabase/functions/_shared/deps.ts`, `scripts/fake-stripe.mjs`, `tests/payments.test.mjs`.
- Tests: payments 10 checks (new: v2 account created once when v1 is blocked, v2 onboarding link fallback, v1 fallback without v2), e2e 38 (payout setup now goes through the v2 path).

## 2026-11-25: Clearer staff email when an ID check needs confirming
- The staff alert now says what to do ("go to People, and tap Confirm 18+ under ID checks to confirm") and its button opens the admin People page.
- Files: `supabase/migrations/20261125000005_id_alert_wording.sql`, `tests/db.test.mjs`.

## 2026-11-25: "Around my region" means nearby cities, and saving the profile keeps typed model details
- Travel range now decides which other cities a talent appears in for brand search and brief matching. "Around my region" covers nearby cities only (North: Manchester, Liverpool, Leeds; Midlands: Birmingham; South: London, Bristol; Scotland: Glasgow); "Anywhere in the UK" and "UK and abroad" cover every city. Before, any travelling talent showed up everywhere. The profile form says which cities "around my region" covers for your city.
- Saving the profile form no longer redraws the model details below it, so measurements typed but not saved stay put.
- An ID check left on "Checking your ID…" now offers "Check again" and "Start again", instead of saying it went through.
- Talent who haven't confirmed their agency status are hidden from brands until they do.
- Files: `supabase/migrations/20261125000004_travel_regions.sql`, `src/ui.js`, `src/views/talent.js`.
- Tests: db 77 checks (new: region talent appear in nearby cities only), e2e 38 checks (region hint shown).

## 2026-11-25: ID checks no longer get stuck after a pass
- Stripe only shares the date of birth from an ID check with a restricted key allowed to read sensitive results. Embr asked for it with the standard key, Stripe refused, and a passed check stayed on "Checking your ID…". Embr now reads the date of birth with an optional restricted key (`STRIPE_IDENTITY_KEY`); if that's missing or refused, it reads the result without it and the check goes to "Confirming your age".
- Staff see "ID checks to confirm" on the admin People page and can confirm 18+ after checking the session in Stripe (`ops_confirm_age`).
- Files: `supabase/functions/_shared/payments.ts`, `supabase/functions/_shared/deps.ts`, `supabase/migrations/20261125000003_id_review.sql`, `src/views/ops.js`, `scripts/fake-stripe.mjs`, `docs/builds/SETUP.md`.
- Tests: payments 8 checks (new: refused date of birth goes to review; with the restricted key the talent is verified), db 76 checks (new: staff confirm 18+ only for checks waiting on review).

## 2026-11-25: Talent Today screen has something to see after setup
- **Seen and saved:** three tiles under the earnings card: how many brands opened your profile this week, how many have saved you, and offers received. Counts only, never which brand ("Brands make the first move"). Before the profile is live the tiles say "Not live yet" and lead to the profile.
- **Profile strength:** once you're ready to be booked, the checklist becomes a strength bar with one "Next" step (more photos, bio, tags, comfort note, Instagram, half-day rate, dates confirmed). No claim that it ranks you higher.
- **This week on Embr:** anonymised whole-pilot totals (briefs posted, bookings confirmed, brands joined, briefs for your roles when 2 or more). No titles, names, dates or rates, and nothing to tap. Lifetime totals when the week is quiet.
- **Your dates:** one tap to confirm your free dates are up to date. No streaks.
- **Last 6 months** earnings bars and a **Your Embr so far** milestones row.
- A brand saving your profile sends one quiet in-app note a day (no email, no brand name).
- Design and reasoning (Mobbin research, what was rejected and why): `docs/dev/talent-engagement.md`.
- Files: `supabase/migrations/20261125000002_talent_engagement.sql`, `src/views/talent.js`, `src/style.css`.
- Tests: db 75 checks (new: a brand view counts once a day, staff and self views don't, no brand ids returned, one quiet save note a day, pilot totals have no titles or names, talent still can't read briefs or view logs, one-tap dates), e2e 38 checks (new: tiles, strength, this week panel with nothing to click, dates check-in, milestones, no brand names and no jobs-board wording on Today).

## 2026-11-25: Talent demo fixes: photos keep your details, ID check, travel, new roles, agency status
- **Photos no longer wipe the profile form.** Adding, removing or choosing a cover photo redrew the whole profile page, so anything typed but not saved was lost. Only the work sections are redrawn now, and typed model details are kept too.
- **ID check no longer says "under 18" after a pass.** Stripe only returns the date of birth when asked for it by name; Embr wasn't asking, so a passed check had no date of birth and was treated as under 18. Embr now asks for it, and if a passed check ever arrives without one it goes to "Confirming your age" for staff to check, never "under 18". The test Stripe stand-in now behaves like real Stripe here.
- **Travel is a preference, not yes/no.** Talent pick how far they'll travel (local, region, anywhere in the UK, UK and abroad) and how costs work (brand covers travel, nearby included, agree per booking). The form says they still decide offer by offer. Brands and the Book-me page show the new wording.
- **Hair stylist and Nail technician** added to the things talent can do (3 photos each).
- **Agency status declaration** at talent sign-up, and a prompt for existing talent; profiles stay hidden until it's confirmed. The wording is a DRAFT for solicitor review: `docs/dev/agency-declaration.md`.
- Files: `supabase/migrations/20261125000001_talent_snags.sql`, `supabase/functions/_shared/payments.ts`, `scripts/fake-stripe.mjs`, `src/api.js`, `src/ui.js`, `src/views/auth.js`, `src/views/talent.js`, `src/views/brand.js`, `src/views/public.js`, `docs/dev/agency-declaration.md`.
- Tests: db 69 checks (new: declaration required and stored, travel range and costs, new roles, passed check without date of birth goes to review), e2e 36 checks (new: sign-up tick box, travel saved, photo upload keeps unsaved fields, ID check needs the date of birth asked for by name).

## 2026-11-25: "I already have a code" on the sign-in screen
- If the sign-in email can't be sent, or someone already has a code from an earlier email, they can tap "I already have a code" and type it in. Until Embr has its own domain, Resend only emails the account owner, so in testing Embr staff make the codes for test accounts and pass them on.
- Files: `src/views/auth.js`, `tests/e2e.test.mjs` (the café brand signs in this way).

## 2026-11-24: "Copy invite link" works on the admin site
- The copy button's code only loaded in the app, so on the admin site "Copy invite link" did nothing. It now lives in shared code used by both.
- Files: `src/views/common.js`, `src/views/talent.js`, `tests/e2e.test.mjs` (clicks Copy invite link on the admin site and checks it copied).

## 2026-11-24: Admin menu shows on narrow windows
- On a browser window narrower than 820px, the admin website hid its top menu and had nothing in its place, so Invites couldn't be reached. The menu now stays visible and scrolls sideways if needed.
- Files: `src/style.css`, `tests/e2e.test.mjs` (checks Invites is visible at 760px wide).

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
