# Embr pilot app

The working, invite-only pilot of Embr: brands book models and creatives directly. Built from the v11 prototype's design.

**Going online:** see [docs/builds/SETUP.md](docs/builds/SETUP.md).

**Working on Embr with Claude:** start with [CLAUDE.md](CLAUDE.md). Status and backlog live in [docs/workflow-state.md](docs/workflow-state.md). Run `npm run dashboard` and open `docs/dashboard.html` to see them as a board. Locked decisions are in [docs/decisions.md](docs/decisions.md). The four agents (researcher, developer, app-builder, marketer) are in `.claude/agents/`.

## What's in it
- **Logins:** email + 6-digit code (Supabase Auth). Invite-only; brands can also join from a talent's booking link or Book-me page.
- **Talent:** profile, up to 12 photos (resized on the phone), free/unavailable dates, 18+ ID check (Stripe Identity), payouts (Stripe Connect Express), booking links, Book-me page at `/@name`. No job list, nothing to apply for: "Let work find you".
- **Brands:** search the board, shortlist, post briefs and see Embr's best-fit ranking (up to 6), send offers with the booking agreement, pay the 50% deposit (Stripe Checkout, card saved), sign off and pay the balance.
- **Book now, pay later (planned, not built yet):** brands book and organise shoots on their usual invoice terms (for example 30 or 60 days), and talent are still paid in full the moment the shoot is signed off. The plan is a UK B2B pay-later partner at the balance step that pays Embr upfront and takes the credit risk. The pilot app takes the balance by card today. See tasks R7 and D5 in [docs/workflow-state.md](docs/workflow-state.md).
- **Money:** brand fee 10% first booking with a person, 7% from the 2nd, 5% from the 5th, 5% on booking links. Talent get 100%. Auto sign-off 72 hours after wrap. Free cancellation until 7 days before; later, talent get 50% of the session fee.
- **Messages** inside each booking, **notifications** in the app and by email (Resend).
- **Embr admin:** overview, every booking, people with ID/payout status, open briefs with their rankings, invites, resolving reported problems.
- **Home-screen app** (PWA): manifest, icons, offline shell.

## Layout
- `src/` the app (plain JavaScript, Vite). `src/style.css` is the v11 stylesheet.
- `supabase/migrations/` database tables, security rules and all booking logic.
- `supabase/functions/` server functions: `api` (payments, payouts, ID checks), `stripe-webhook`, `cron` (auto sign-off), `send-email`. Money logic is in `_shared/payments.ts`.
- `tests/` database tests and a full end-to-end browser test.
- `scripts/` a local stand-in for Supabase and Stripe, used only for testing.

## Testing locally
Needs Postgres 16 on port 54329. `scripts/db-reset.sh`, then `npm run test:db`. For the browser test: `npm run build`, `npm run local-server`, then `npm run test:e2e`.
