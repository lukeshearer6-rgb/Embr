# Embr architecture

## Pieces
| Piece | What it does | Where |
|---|---|---|
| App (PWA) | Talent and brand screens. Plain JavaScript and Vite, installable on a phone | `src/`, `index.html`, `public/` |
| Admin site | Staff overview, bookings, people, briefs, invites, problems. Desktop only | `admin.html`, `src/views/ops.js` |
| Database | Tables, row-level security, booking logic, fee tiers, ranking, auto sign-off (pg_cron) | `supabase/migrations/` |
| Server functions | `api` (payments, payouts, ID checks), `stripe-webhook`, `cron`, `send-email` | `supabase/functions/` |
| Money logic | Deposits, balances, transfers, refunds | `supabase/functions/_shared/payments.ts` |
| Payments | Stripe Connect Express: separate charges and transfers; Checkout for the 50% deposit with the card saved; balance charged at sign-off | Stripe |
| ID check | Stripe Identity (18+) | Stripe |
| Email | Resend (sign-in codes over SMTP, notifications) | Resend |
| Hosting | Static `dist/` on Cloudflare Pages | Cloudflare |
| Tests | `tests/db.test.mjs` (database rules) and `tests/e2e.test.mjs` (full booking journey in a browser) against local stand-ins | `tests/`, `scripts/` |

## Rules enforced in the database
- Talent can't read briefs or create offers. The app is invite-only; brands can also join from a booking link or a Book-me page.
- Fee tiers per brand–talent pair, automatic sign-off, and cancellation terms (see `docs/decisions.md`).
- Multi-role profiles: `role_rules()` in migration 2. Model measurements: migration 3.

## Why this stack
- It's already built, with passing tests, so rebuilding it would cost time for no gain.
- The services Embr uses have free plans, which fits the zero-cash budget. Check each plan's current limits on the provider's page before launch (tasks R1, B5). Don't quote limits from memory.
- A web app avoids an app-store build and fee for now. A native app can come later if pilot data supports it.

## Not yet tested
Calls to real Supabase and Stripe (test mode) are not tested yet (task D2). The container that built the pilot couldn't reach them.
