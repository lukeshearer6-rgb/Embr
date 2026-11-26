# Brand snag list 2 (D18)

Luke's second brand snag list, 2026-11-26 13:35 UK. Built on main after PR 41/42. Migration `supabase/migrations/20261126000003_brand_snags_2.sql`. Screens are in `docs/dev/brand-snags-2/`.

## What changed for users

| Snag | What brands and talent see now |
|---|---|
| Options | Each role on a brief holds up to 3 options per spot, ranked 1st, 2nd, 3rd. The brand sends the offer to the 1st option with a "Time to answer" of 12, 24 or 48 hours (24 by default). If that person declines or the time runs out, Embr asks the brand: "Your next option for Model is NAME. Send them the offer?" The brand chooses. Nothing moves on its own. Talent see "Optioned" with the brand's name and date, never their number, and can tap "I'm not available". When a role is filled, the remaining options are released and told their dates are free. |
| Several roles per brief | A brief has one or more roles. Each has its own role, how many, days, day rate From/To, usage fee, travel and casting. Example: Model x1, 1 day, £300 to £400 a day, £1,000 usage, travel paid; nail tech x1, 2 days, £100 to £200 a day, no usage. |
| Day-rate range | From/To fields, plus a "Only show talent within this price range" box. Unticked, out-of-range matches still show, below in-range ones, with "£10 over your range". |
| Booking-link 5% | Removed from the brand Account page. The 5% link rate now applies only when the brand had not already found that talent on Embr. See "Link fee" below. |
| Travel wording | "Local talent only" or "Travel paid for non-local talent". |
| Edit a posted brief | "Edit brief" on the job screen. Roles can be changed, added or removed. Removing a role releases its held options, and they are told. Offers already sent are not changed. |
| Gender | Optional "Casting" on each role (Any, Women, Men, Non-binary) and an optional gender on the talent profile. See "Gender" below. |
| Cancellation | Free until 48 hours before the shoot day begins (11:59pm UK two days before). After that, talent get 50% of the session fee, as before. Agreement v3. Draft for BPP. |
| Rosters | New "Shoots" tab in the brand navigation lists every roster in progress and every one sent. Each job has a "Shoot roster" button that opens or starts its roster, carrying the brief's roles and fees. |

## Decisions I made, and why

### Options (backup picks)

- Cap: 3 per spot (Luke's number). A role for 2 people can hold 6.
- Nothing auto-advances. Luke said "Embr asks the brand", so the next offer is always the brand's tap. This also keeps Embr on the side of brands making offers (agency position, `docs/decisions.md`).
- Default answer window 24 hours. Evidence: provisional bookings lapse after 24 hours in the published terms of [Body London](https://bodylondon.com/terms) (3.1), [The Hive](https://www.thehivemanagement.com/model-booking-terms/) (8.1), [Premier](https://premiermodelmanagement.com/terms) (15) and [Zone](https://www.zone-models.com/terms) (3.6.1), all checked 2026-11-26. The brand can pick 12 or 48 instead.
- Talent never see their rank, the brief title or the rate while optioned (`my_options`). They only learn an offer is made when it arrives. This avoids "you're our 3rd choice" and keeps briefs private from talent.
- Being optioned is not a booking and does not block the talent's calendar. Other brands can still book them. If that happens, the talent can tap "I'm not available".
- Mobbin patterns for picking backups (iOS, checked 2026-11-26): [Amazon Shopping](https://mobbin.com/screens/1d2a2181-dfef-450e-b5fa-412ec8ac2acc) ("Choose a backup"), [Zocdoc](https://mobbin.com/screens/1fa5fbd4-873c-492a-b95d-96e6eb5cb654) (find a new provider when the first falls through).

### Day-rate range

- From/To fields side by side, as in [Vinted](https://mobbin.com/screens/b0e64516-6cc6-4d76-be1e-5693c33d824c) and [Gojek](https://mobbin.com/screens/ec84ac3a-638f-44e5-8a09-dafd50440c6d) price filters (checked 2026-11-26).
- The offer sheet starts at the talent's rate clamped into the role's range, and the brand can still change it.

### Link fee

The worry: if brands pay 5% through a talent's booking link and 10% through Embr, a brand who found someone on the board has a reason to ask them for their link.

- Fresha's new-client fee "never applies" to clients who arrive by direct links or Instagram, and from 2027 it depends only on where the client books ([Fresha help centre](https://www.fresha.com/help-center/knowledge-base/billing-and-fees/101357-marketplace-new-client-fees), checked 2026-11-26).
- StyleSeat charges its new-client fee only on clients StyleSeat sends ([StyleSeat](https://www.styleseat.com/join/new-client-connections), checked 2026-11-26).
- On Mobbin, share-link screens speak to the person sharing, not the payer, and offer the payer no discount: [Linktree](https://mobbin.com/screens/c3ace0a5-a299-44b8-9e5b-70b5ce9bf2c5), [Revolut Business](https://mobbin.com/screens/eaee5f70-330d-4212-af67-92df0d83a967), [Careem](https://mobbin.com/screens/887d738c-4c72-4700-90c4-faa93d0b8e5f). Referral offers apply to new customers only: [Instacart](https://mobbin.com/screens/3bf02ddd-ff69-41a8-a2d4-7b54829ff5ae), [Neo Financial](https://mobbin.com/screens/d9cbc656-626e-402c-acb9-b4006488e08d), [Careem](https://mobbin.com/screens/5c72507f-1ea6-47ed-823b-917fe39eab13) (all checked 2026-11-26).

Call: keep the 5% link rate (it rewards talent for bringing their own clients), but only when the brand had not already found that talent on Embr: no profile view, shortlist entry, option or booking with them before (`_found_on_embr`, `fee_for`). Otherwise the usual tier applies. The brand Account page no longer mentions the link rate at all. The talent's Links screen explains the rule. The tiers themselves still need Luke's final confirmation for launch (`docs/decisions.md`).

### Gender

- Equality Act 2010, Schedule 9 paragraph 1 allows an occupational requirement when it is a proportionate means to a legitimate aim ([legislation.gov.uk](https://legislation.gov.uk/ukpga/2010/15/schedule/9/part/1?view=plain), checked 2026-11-26). The explanatory notes (note 787) name modelling jobs as an example of authenticity ([explanatory notes](https://www.legislation.gov.uk/ukpga/2010/15/schedule/9/notes?view=plain), checked 2026-11-26).
- So casting is set per role, not per brief, and defaults to Any. It is labelled "Casting", which ties it to the look a shoot needs.
- Talent gender is optional, with Woman, Man, Non-binary, or not stated. It is shown to brands only on the profile details. Talent who leave it blank are never filtered out. They rank just below a stated match.
- Non-binary is a choice on both sides. "Women" casting matches talent who say Woman. Whether to widen this is worth asking in the BPP review.

### Cancellation

- Published UK agency terms charge half the fee inside 48 hours and the full fee inside 24 hours: [Body London](https://bodylondon.com/terms) 3.1 and [The Hive](https://www.thehivemanagement.com/model-booking-terms/) 8.1 (checked 2026-11-26). Premier and Zone use working days.
- Chose 48 hours, with the existing 50% to talent after that. Kept one step, not two, so the money logic in `supabase/functions/_shared/payments.ts` is unchanged (48 hours before 00:00 UK on the shoot day is the same as the old `free_cancel_days = 3`). A database rule keeps the hours and days in step.
- Booking agreement is now v3 (`docs/dev/booking-agreement.md`). It is marked draft, and question 14 for BPP asks whether 48 hours with 50% is fair to both sides and whether a second step at 24 hours is needed.

## Not built, for later

- Options do not hold the talent's diary, and an option is not flagged automatically when the talent is booked elsewhere. Both could be later choices.
- Answer-window nudges run every 15 minutes through pg_cron on the live project only (`svc_option_nudge`). Locally they are tested by calling the function.
- Gender is not used anywhere else (no board filter yet).

## Verification (2026-11-26)

- `npm run test:db`: 125 passed (new section covers roles, ranges, edit, gender, options, nudge, pass, decline, release, unavailable, close, link rate and 48 hours).
- `npm run test:e2e`: 64 passed, with screens 30 to 34.
- `npm run test:payments`: 12 passed (cancel split at the 48-hour boundary).
- `npm run test:agreement`: 9/9 (agreement doc matches `_agreement` v3).
- `npm run test:office`: 13 passed.

## Screens

- `brand-snags-2/30-brief-roles-phone.png`: brief form with two roles and the price-range box
- `brand-snags-2/31-options-phone.png`: job screen with options 1st and 2nd
- `brand-snags-2/32-talent-optioned-phone.png`: talent Bookings with "Optioned"
- `brand-snags-2/33-next-option-phone.png`: "Send them the offer?" prompt after a decline
- `brand-snags-2/34-shoots-phone.png`: Shoots tab with rosters in progress
