# Embr privacy notice (DRAFT)

Status: draft 2026-11-27. Not legal advice. Every lawful basis and legal judgement is "for BPP to review". Written to cover what UK GDPR Article 13 and ICO "right to be informed" guidance say privacy information must include: purposes and lawful basis, retention periods, who it is shared with, controller contact, rights, right to complain, whether data is required, automated decisions, transfers. [UK GDPR Article 13 on legislation.gov.uk](https://www.legislation.gov.uk/eur/2016/679/article/13) and [ICO right to be informed](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/), both checked 2026-11-27 (fetch summaries; the more detailed ICO page "what privacy information should we provide" returned an error, so the ICO's full checklist was not read).

## 1. Who we are
Embr is an invite-only pilot run by Luke, an individual. Embr is not incorporated. Luke decides how and why personal data is used (the "controller"). Contact: [to be decided: Luke, name and email; address if needed]. No data protection officer. [Decision (Luke, 2026-11-18); for BPP to review: controller identity]

ICO fee: Embr has not paid the ICO data protection fee. Embr is a pilot and Luke has deferred incorporation spend. [Decision (Luke, 2026-11-26); fee background `docs/research/r2-incorporation-and-domain.md`. For BPP to review whether this matters for the pilot.]

## 2. What we hold, why, and on what basis
Lawful bases below are proposals. [All: for BPP to review]

| Who | Data | Source (file:line) | Why | Basis (proposed) |
|---|---|---|---|---|
| Everyone | Email address, role (talent or brand), sign-up time. Login is by a 6-digit emailed code | `supabase/migrations/20261123000001_embr_pilot.sql:32-37`; `src/views/auth.js:42` | Create and secure your account; send codes and booking emails | Contract (UK GDPR Art 6(1)(b)) |
| Everyone | Invite code used and when | `...pilot.sql:39-47` | Keep the pilot invite-only | Legitimate interests (6(1)(f)) |
| Talent | Name, handle, city, roles, bio, tags, Instagram, height and body measurements, hair and eye colour, sizing, rates, travel, free dates | `...pilot.sql:49-73` (name, handle, city, height, rates, instagram, bio, tags); `20261123000003_model_details.sql:19-31` (measurements); `20261125000001_talent_snags.sql:10-13` (travel) | Show your profile to brands so they can book you; rank you against a brief | Contract |
| Talent | Date of birth (self-declared at sign-up) | `...pilot.sql:63`; `20261125000001_talent_snags.sql:61-62` | Check you are 18 or over | Legal obligation or legitimate interests; for BPP to review |
| Talent | ID check result: Stripe Identity session id, status, verified flag and time; date of birth read from the check where available. Embr does not store the ID document itself in its tables; Stripe holds it | `...pilot.sql:64-67`; `supabase/functions/_shared/payments.ts:121-158`; `20261125000003_id_review.sql:3-12` | Confirm 18+ before a booking | Legitimate interests / legal obligation; for BPP to review. ID document images are processed by Stripe: unverified what Embr can see in the Stripe dashboard (staff check the session there, `id_review.sql:1-2`) |
| Talent | Optional gender | `20261126000003_brand_snags_2.sql:31` (column), `:33-40` (`save_gender`) | Brands may set casting by gender per role (Equality Act 2010 Sch 9 para 1, Decision (Luke, 2026-11-26)); never required | Consent (6(1)(a)). For BPP to review whether this is also special category data |
| Talent | Optional phone number and the time you consented | `20261126000002_brand_snags.sql:27-28`, `:299-313` | Share with a brand you are booked by (section 4) | Consent |
| Talent | Agency declaration text and time | `20261125000001_talent_snags.sql:14-15`; `docs/dev/agency-declaration.md` | Record your agency confirmation | Contract / legitimate interests |
| Talent | Photos (portfolio) and links | `...pilot.sql:75-82` (`talent_photos`); `:1384-1392` (storage bucket); `20261123000002_multi_role.sql:15-23` (links) | Show your profile | Contract |
| Talent | Stripe payout account id and whether payouts are enabled | `...pilot.sql:68-69` | Pay you | Contract |
| Talent | Which brands viewed or saved you is counted but never shown by name | `20261125000002_talent_engagement.sql:1-12` (profile_views stores brand id and day) | Show you counts | Legitimate interests |
| Brand | Brand name, contact name, city, website, Instagram | `...pilot.sql:90-99` | Run your account; show to talent you book | Contract |
| Brand | Stripe customer id | `...pilot.sql:97` | Take deposits and balances | Contract |
| Brand | Briefs, shortlist, shoot details and moodboard images | `...pilot.sql:101-123`; `20261125000008_shoot_thread.sql:19-33`; `20261126000003_brand_snags_2.sql:61-90` | Run the booking process | Contract |
| Both | Bookings: dates, location, call time, notes, money amounts, agreement text, typed signature name and time, status history, Stripe payment and refund ids | `...pilot.sql:142-200`; `20261126000001_booking_contract.sql` (signature); `booking-agreement.md:20` | Run and record the booking; keep the signed record | Contract; legal obligation for accounting records, for BPP to review |
| Both | Messages and events on a booking | `...pilot.sql:204-220` | Let you talk about the booking | Contract |
| Both | In-app and email notifications | `...pilot.sql:229-240` | Tell you about your bookings | Contract |
| Both | Stripe event ids | `...pilot.sql:242-246` | Avoid processing a payment event twice | Legitimate interests |

Card details are entered with Stripe and are not stored in Embr's tables (the tables hold Stripe ids only). [`...pilot.sql:97,173-188`. Unverified: confirm with Stripe's own pages.]

Not collected: no analytics, advertising cookies or location tracking were found in `src/` or `supabase/`. Unverified: not exhaustively searched. Sign-in uses browser storage for the session. [for BPP to review: cookies/PECR]

## 3. Required or optional
Email, name, role and (for talent) date of birth and the ID check are needed to use Embr. Phone number, gender, Instagram, bio, travel and most extra profile fields are optional. [`src/views/auth.js:129`; `save_phone` line 307; `save_gender` lines 33-40]

## 4. Talent phone number shared with a brand
- What: your phone number, only if you add it. [`20261126000002_brand_snags.sql:299-313`]
- Who: the brand you are booked by, and Embr staff. [`_talent_phone`, `:325-327`]
- When: from when the brand's deposit confirms the booking until 14 days after the last shoot day. Also while a booking is wrapped or disputed. Never on the board, profiles, Book-me pages, offers or cancelled bookings. [`_phone_open`, `:320-323`; `docs/dev/brand-snags.md` "Phone number after confirmation"; the 14-day end date is Claude's call, listed there for Luke to confirm]
- Consent: you tick a box when you add it, and the time is recorded. [`:307, :311`]
- Remove it: clear the field on Profile and save. The number and consent time are deleted at once from your profile and brands lose sight of it. [`:303-306`]
- A brand that has already seen the number may have noted it. Brand obligations: [to be decided: Luke / for BPP to review, see pilot terms 6.1].

## 5. Who we share data with
- **Brands see talent profiles** that are published: name, photos, roles, measurements, rates, travel, links, optional gender and verified flag. Brands see booking details for their own bookings. [`docs/dev/booking-agreement.md:17-20`; `talent_detail` in `20261125000002_talent_engagement.sql`]
- **Talent see** the brand name, brief and booking details for their bookings. They see "Optioned" but not a brand's ranking. [Decision (Luke, 2026-11-26)]
- **Stripe** (payments, ID check, payout accounts). Processor and in places an independent controller. [CLAUDE.md "Money and ID"; `payments.ts`. For BPP to review roles. Stripe's privacy notice not read: unverified.]
- **Supabase** (database, logins, photo storage, server code). [CLAUDE.md "Tech stack"; `docs/dev/architecture.md`]
- **Resend** (sending login and notification emails). [`supabase/functions/_shared/handlers.ts:92-128`]
- **Cloudflare Pages** (serves the app). [`docs/dev/architecture.md:14`]
- Photos live in a public storage bucket: anyone with a photo's link can open it. [`...pilot.sql:1387-1389`, `public = true`. For BPP to review; also see to be decided below.]
- Where these providers store data and any transfers outside the UK, and the safeguards used: unverified, needs checking in each provider's terms. For BPP to review.

We do not sell personal data. Unverified: no code in `src/` or `supabase/` sends data to advertisers (not exhaustively searched).

## 6. How long we keep it
- Phone number: until you remove it (above). Brands see it only in the window in section 4.
- Everything else: to be decided: Luke. No retention rule is in the code or in docs/decisions.md as at 2026-11-27. (Searched `supabase/`, `src/` for delete, purge, retention.) UK GDPR requires a period or the criteria to be stated. [Article 13(2) link above]
- Account removal is manual until a delete function is built; see pilot terms 7.1.
- Accounts are deleted from the database cascade when the auth user is deleted (`on delete cascade`, `...pilot.sql:33,50`), but bookings and money records are kept referencing both parties (`...pilot.sql:144-145`, no cascade). For BPP to review which records must be kept (for example tax records) and for how long.

## 7. Automated decisions
Embr ranks talent against a brief and brands decide; nothing is decided about you solely by automated means. [Decision (Luke, 2026-11-20); for BPP to review whether ranking counts as profiling under Art 22 or Art 13(2)(f)]. Auto sign-off 72 hours after a shoot is a booking rule, not a decision about you as a person. [Decision (Luke, 2026-11-26)]

## 8. Your rights
You can ask to see your data, correct it, have it deleted, restrict or object to use of it, receive it in a portable form, and withdraw consent (for example your phone number or gender) at any time. [Article 13(2), link above. How each is handled in practice: to be decided: Luke; reply time: to be decided.]

## 9. Complaints
Contact us first at the address in section 1. You can also complain to the Information Commissioner's Office. [ICO: https://ico.org.uk/make-a-complaint/ , not opened: unverified wording; Article 13(2) refers to complaints to the Commissioner under section 165 of the Data Protection Act 2018.]

## 10. Changes
We will update this notice if we change how we use data and tell you about material changes. [for BPP to review]

## Verification

Second pass on 2026-11-27 (orchestrator): the code citations were spot-checked against the files and match. The ICO 72-hour breach sentence and the "information in phases" rule were re-read on the live ICO guide. Draft only: every legal judgement is for BPP to review, and every "to be decided: Luke" item is listed in docs/workflow-state.md.
