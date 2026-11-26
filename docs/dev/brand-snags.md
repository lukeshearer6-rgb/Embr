# Brand snag list (Luke, 2026-11-26)

Luke tested the live pilot as a brand and listed eight snags. All eight are fixed on one branch, built on the booking contract work (PR 37), because usage, the usage fee and the agreement wording overlap with it. Decision (Luke, 2026-11-26): the usage fee is charged upfront, with no cut-from-the-edit refunds.

| Snag | Fix | Where |
|---|---|---|
| Usage only allowed one option, 12 months | Several uses picked together on the brief, the offer form and the Shoot Roster, with the length chosen on its own | `src/views/contract.js` (`usagePicker`), `src/views/brand.js`, `src/views/roster.js` |
| "All of it" printed on the agreement and offer | Removed. Every use is named on its own line in section 5 of the agreement and in the summary | `_usage_clause`, `_usage_summary` in `supabase/migrations/20261126000002_brand_snags.sql` |
| Lengths only 3, 6, 12, 24 | Those stay as presets, plus a Custom chip that opens a months field (1 to 120, such as 5 or 18). The database accepts any whole number in that range | `_usage_clean`; `usagePicker` |
| No usage fee on the brief | The brief has a usage fee per person, separate from the day rate. The form says the day rate pays for the talent's time (the basic studio fee) and the usage fee pays for using the photos. An offer or roster started from the brief carries it. The agreement names both lines apart: "Day rate for the Talent's time (basic studio fee)" and "Usage fee for using the photos and video" | `create_brief`, `briefs.usage_fee`, `_agreement` section 3 |
| A 2-day shoot booked everyone for both days | Each person in the roster has day chips ("Thu 10 Dec", "Fri 11 Dec"). Pick one day or both; each person still gets one offer for the days picked. `shoot_offer` takes `start_day` and `days` inside the shoot and no longer forces the usage fee to £0, so each person also gets their own usage fee | `src/views/roster.js` (`daysOf`), `shoot_offer` |
| Roster showed only the first date | Dates read as a range wherever a shoot or booking shows its date: the roster header and bar, each person's row, the quote, booking lists, the booking sheet, the shoot thread, the Shoot Day Hub and the agreement ("Thursday 10 December 2026 to Friday 11 December 2026 (2 days)") | `dRange`/`dRangeLong` in `src/ui.js`, `_date_range` |
| Only one skill per booking | Skill chips (multi-select) on the offer form and under each roster person. `bookings.roles` keeps every skill; `bookings.role` stays as the first one for older screens. The agreement says "booked as: Model and UGC creator" | `skillPicker` in `contract.js`, `_roles_for`, `_new_booking` |
| Phone number after confirmation | Talent can add a phone number on their profile with its own consent tick, and remove it. Brands see it on the booking (with a Call button) and on the Shoot Day Hub once the deposit confirms the booking, while it's live, and for 14 days after the last shoot day. Never on the board, profiles, Book-me pages, offers or cancelled bookings | `save_phone`, `my_phone`, `_phone_open`, `booking_detail`, `shoot_detail`; `src/views/talent.js` (`phoneCard`), `booking.js` (`phoneLine`), `shootday.js` |

## Choices made without asking (say if any should change)

- **Phone window:** from deposit paid until 14 days after the shoot, so brands can sort reshoots or late deliveries. Luke asked for "after a booking is confirmed"; the end date is my call. Change it in `_phone_open`.
- **Phone is optional** for talent. A brand on a confirmed booking without a number sees "hasn't added a phone number. Message them here."
- **Brands' own numbers** are not shared with talent (no brand phone field yet). Easy to add the same way if wanted.
- **Days next to each other only.** A person can't be booked for day 1 and day 3 of a 3-day shoot in one offer, because one booking covers one run of days. The roster says so. Sending two offers for split days would be the next step if it's needed.
- **Usage fee default in a roster from a brief:** on-camera roles (model, actor, UGC and content creators) start with the brief's usage fee; crew start at £0. The brand can change each one.

## Privacy

The phone number is personal data shared with a third party (the brand). The talent ticks consent when adding it (time kept in `talents.phone_consent_at`) and can remove it at any time. The pilot privacy notice (workflow-state B9) must say: what's shared, with whom (a brand with a confirmed booking), when (from the deposit until 14 days after the shoot) and how to remove it. That notice still needs Luke and the BPP review before real users.

## Mobbin references (iOS, checked 2026-11-26)

- Custom length next to presets: [BitePal](https://mobbin.com/screens/56f714cc-de38-47e9-94f7-1fe115d10eb2) (15/30/60 min chips plus Custom, which opens a number field), [Jobber](https://mobbin.com/screens/b9ec6cfd-1080-40c7-89cf-469724cb95cb) (arrival-window chips), [Headspace](https://mobbin.com/screens/785a8fca-79e2-417e-a797-382126432d4a) (length chips in a sheet).
- Dates as a range: [IHG](https://mobbin.com/screens/b7527bfe-63dd-4a2d-9d0f-7e25f2c50dba) ("Tue, 24 Jun – Wed, 25 Jun" header), [Trip.com](https://mobbin.com/screens/5def65c6-c26b-4a3d-adee-083b6d448839) ("Mon, Mar 17–Tue, Mar 18"), [Slopes](https://mobbin.com/screens/f0219f6a-8c56-4224-b142-5b270c78cce2) (start → end).
- Picking dates inside a booking sheet: [Klook](https://mobbin.com/screens/fb108108-9d98-451e-8ed9-8bbc55efd477) (a row of date chips).
- Call on a confirmed booking: [Trip.com](https://mobbin.com/screens/5def65c6-c26b-4a3d-adee-083b6d448839) ("Call Property"), [Uber Eats](https://mobbin.com/screens/61d2b40d-dbed-4707-8bc1-c296072674c2) (Call chip on the reservation), [Expedia](https://mobbin.com/screens/38f444b2-3469-414c-9484-817a32e08289) ("Call +82…" button), [World of Hyatt](https://mobbin.com/screens/da3decc9-dd5e-409d-8bec-e36ba950c17f) (Call action).
- Several skills: the same multi-select chips as "Where you'll use the photos" (DESIGN_RULES chips, 48px hit area).

## Screens

`docs/dev/brand-snags/`: `04i-roster-days-skills-phone.png` (roster on a phone: date range, skills, day chips, day rate and usage fee), `05b-brief-usage.png` (brief usage with a custom 5 months and the usage fee), `22-shoot-day-hub-phone.png` (Call button on a confirmed person), `03d-talent-phone.png` (talent phone field and consent).

## Tests

db 108, e2e 56, agreement 9, payments 11, office 13 (2026-11-26, local Postgres 16 and the dev-server stand-in). Payments code is unchanged.
