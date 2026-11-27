# Embr pilot terms (DRAFT)

Status: draft written 2026-11-27 for Luke and the BPP Enterprise Clinic. Not legal advice. Not for real users until reviewed. Every legal judgement is marked "for BPP to review". Each clause has a source note in square brackets. Sign-in screen link: `src/views/auth.js:48`.

Section 1 of the booking agreement (`docs/dev/booking-agreement.md:62`) is mirrored where Embr's role is described.

## 1. What this is
1.1 Embr is a UK booking service, in an invite-only pilot, where brands book unsigned models and creatives directly. [CLAUDE.md "What Embr is"; Decision (Luke, 2026-11-23): invite-only, brand-led, Manchester first]
1.2 These terms are between you and Luke, an individual. Embr is not incorporated and has no company number or registered address yet. When Embr is incorporated, these terms will be updated and you will be told. [Decision (Luke, 2026-11-18); for BPP to review: who the contracting party is and whether personal liability is an issue]
1.3 [To be decided: Luke. Contact name and address or email to show here.]

## 2. Pilot status
2.1 The pilot is a test. Features, fees and these terms may change. We will tell you before a change affects a booking you have already made. [for BPP to review: right to vary terms]
2.2 The app is built and tested; payments are in Stripe test mode until Luke says otherwise. Do not rely on test-mode screens as real payments. [CLAUDE.md "Tech stack"; Decision (Luke, 2026-11-24) on Stripe test mode. To be decided: Luke, the exact wording to use at the point real money starts.]
2.3 You need an invite code to join. Embr can refuse or end an invite. [`supabase/migrations/20261123000001_embr_pilot.sql:39`, invites table]
2.4 Talent must be 18 or over. Talent confirm date of birth at sign-up and pass an ID check run by Stripe Identity before accepting a booking. [Decision (Luke, 2026-11-20); `supabase/migrations/20261125000001_talent_snags.sql:62`; `supabase/functions/_shared/payments.ts:121`]

## 3. Embr's role
3.1 Embr provides the booking software and takes payments through its payment provider, Stripe. Embr is not an agency: it does not find work for talent, and the brand chooses and books the talent. [Booking agreement s1, `docs/dev/booking-agreement.md:62`; Decision (Luke, 2026-11-20); for BPP to review, as in agreement question 2]
3.2 Brands search the board, Embr ranks talent against a brief, and brands make offers. Talent do not apply for jobs, browse jobs or message brands to get work. [Decision (Luke, 2026-11-20)]
3.3 Talent are self-employed and responsible for their own tax. [Booking agreement s1, line 63; for BPP to review, agreement question 11]
3.4 Talent confirm at sign-up that they are not under an exclusive agency contract that stops them accepting bookings, or that their contract allows it. [`docs/dev/agency-declaration.md` wording agency-v1; for BPP to review, including whether Consumer Rights Act 2015 fairness rules apply]

## 4. Fees
4.1 Brands pay an Embr booking fee: 10% on the first booking with a person, 7% from the 2nd, 5% from the 5th, and 5% on booking-link jobs. Talent receive 100% of the talent fee and Embr takes no commission from talent. [Decision (Luke, 2026-11-23, tiers still need Luke's confirmation for launch); `supabase/migrations/20261123000001_embr_pilot.sql:17-29`; booking agreement s3]
4.2 Brands pay a 50% deposit when the talent accepts, held through Stripe, and the balance at sign-off. [Decision (Luke, 2026-11-18 to 2026-11-23); agreement s4]
4.3 Founding talent are free during the pilot. No paid talent membership exists. [Decision (Luke, 2026-11-23, "Campaign"); Decision (Luke, 2026-11-20)] Do not add pricing wording beyond this without Luke. [CLAUDE.md rule 2 and approval gates]

## 5. Bookings
5.1 Each booking is governed by its own booking agreement, generated when the offer is sent and stored with the booking. If these terms and a booking agreement differ on a booking, the booking agreement applies to that booking. [`docs/dev/booking-agreement.md:11`; for BPP to review: order of precedence]
5.2 Payment, sign-off after 72 hours, cancellation (free until 48 hours before the shoot day begins, then 50% of the day rate to talent), usage and disputes are set out in the agreement. [Decision (Luke, 2026-11-26); agreement ss4, 7, 8]
5.3 Keep bookings and payments on Embr. For 12 months after a booking the brand agrees to book that talent through Embr. [Agreement s9; for BPP to review, agreement question 10]

## 6. Conduct
6.1 Be honest, keep your profile accurate, and use your own account. Do not pass on other people's personal data, including phone numbers, or use it for anything but the booking. [for BPP to review; Embr drafting, no source decision. See privacy notice s4 for the phone number]
6.2 Photos you upload must be of you, and you must have the right to use them. Only images up to 5 MB (JPEG, PNG, WebP) are accepted. [`supabase/migrations/20261123000001_embr_pilot.sql:1386-1389`]
6.3 No harassment, pressure or requests outside what the agreement says. The talent may bring a chaperone. [Agreement s6]
6.4 Embr may remove content or suspend an account that breaks these terms. [for BPP to review]

## 7. Removing accounts
7.1 You can ask to close your account by contacting us (see the support route). Bookings in progress must be finished or cancelled under their agreements first. [to be decided: Luke. There is no delete-account function in `supabase/` or `src/` as at 2026-11-27 (searched); removal is a manual step.]
7.2 We may close an account for breach, for being under 18, or when the pilot ends. [for BPP to review]
7.3 What data we keep after closure is in the privacy notice. [privacy-notice-draft.md s6]

## 8. Liability (for BPP to review)
8.1 [for BPP to review: a clause limiting Embr's liability, kept fair to individuals and not excluding liability that cannot be excluded by law. Embr drafting offers no wording or figure.]
8.2 Embr does not guarantee any booking, that a brand will pay, or that the app will always be available during the pilot. [for BPP to review]
8.3 Nothing in these terms limits liability for death or personal injury caused by negligence, for fraud, or where the law does not allow a limit. [Standard carve-out; for BPP to review, Consumer Rights Act 2015 and Unfair Contract Terms Act 1977 on legislation.gov.uk, not opened]

## 9. Privacy and complaints
9.1 How we use personal data is in the privacy notice. [privacy-notice-draft.md]
9.2 Support route and complaints: support-and-incidents-draft.md.

## 10. Law
10.1 These terms are governed by the law of England and Wales. [Agreement s11, `docs/dev/booking-agreement.md:109`; for BPP to review for Scottish and Northern Irish users, agreement question 12]
10.2 [for BPP to review: which courts, and consumer rights to sue at home.]

## Not included on purpose
The sign-in screen has no fee line. Decision (Luke, 2026-11-26): "the line doesn't need to be there at all." These terms are the only place fees are stated, and only as set in decisions.md.

## Verification

Second pass on 2026-11-27 (orchestrator): the code citations were spot-checked against the files and match. The ICO 72-hour breach sentence and the "information in phases" rule were re-read on the live ICO guide. Draft only: every legal judgement is for BPP to review, and every "to be decided: Luke" item is listed in docs/workflow-state.md.
