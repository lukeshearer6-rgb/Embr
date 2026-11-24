# Security review, 2026-11-24

Before the test deploy, the code was checked by reading it: database rules and functions, server functions, and app pages. This is not an independent penetration test. Get one before real money or real personal data at scale.

## What was checked and held up

- **Database access.** All 17 tables have row-level security on, and `anon`/`authenticated` have no direct table access (`revoke all`). Every function signed-in users can call starts with `_need('talent'|'brand')` or `_uid()`, and every change is filtered by the caller's own id (e.g. `remove_photo`, `close_brief`, `respond_offer`, `mark_wrapped`, `remove_link`). Every `security definer` function sets `search_path`. Service-only `svc_*` functions are revoked from users. Covered by `tests/db.test.mjs` (64 checks).
- **Sign-up.** Invite-only. A staff (`ops`) account needs a staff invite. A brand may join without an invite only from a talent's open booking link or published Book-me page, which is by design.
- **Payments.** Card details only ever go to Stripe Checkout. Each server action checks the caller owns the booking (`payDeposit`, `signoff`, `cancel`). `resolve` is staff only and caps the amount. Webhooks are checked against Stripe's signature, and repeats are ignored. The cron and email hooks use secret headers compared in constant time.
- **18+ check.** Stripe Identity with a matching selfie. The date of birth from the document decides `age_verified`, not the one typed at sign-up.
- **App pages.** Text people type goes through `esc()` before it reaches the page. Links must start `https://`. Photos can only be added from the uploader's own storage folder.
- **Secrets.** Keys live in Supabase secrets, not in the app or git.

## Fixed in this change

1. **Content-Security-Policy added** (`public/_headers`). Scripts may only load from the app itself, so if a bug ever let typed text through as code, the browser still wouldn't run it. Also added HSTS. The local test server now sends the same headers, so the browser tests run under them.
2. **Test for unsafe text.** The browser test puts HTML in a talent bio and checks that brands and the public Book-me page show it as text and never run it.

## Known, accepted for the test pilot

- Public Book-me pages show which dates a talent is booked, as "not free" days. Consider hiding this for safety before a wider launch.
- Any signed-in user, brands included, can upload images into their own photo folder (5 MB each, images only). Only talent can attach them to a profile. Low risk; tighten if storage abuse appears.
- Chargebacks and refunds after a payout alert staff, but no transfer is reversed automatically.
- Stripe API version `2024-12-18.acacia` is older than current. Upgrade before live mode.
