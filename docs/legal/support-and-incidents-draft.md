# Support route and personal-data breach routine (DRAFT)

Status: draft 2026-11-27. Not legal advice. Everything legal is "for BPP to review". Embr is run by Luke as an individual; Embr is not incorporated. [Decision (Luke, 2026-11-18)]

## 1. Support route
1. Contact: [to be decided: Luke. One email address Luke controls; a domain is not bought yet, Decision (Luke, 2026-11-26), so it may be a personal or free address.]
2. In the app, booking questions go in the booking's message thread; Embr staff can post in it. [`supabase/migrations/20261123000001_embr_pilot.sql:213-220`, messages; `src/views/booking.js:113`]
3. Staff work at the separate `/admin` site. [Decision (Luke, 2026-11-23)]
4. What to contact us about: a problem with a booking, a payment question, an ID check stuck for review (staff can confirm it, `supabase/migrations/20261125000003_id_review.sql:3`), removing a phone number or photos, closing an account, or a privacy request.
5. Reply time: [to be decided: Luke. No figure is promised.]
6. Disputes after a booking are decided as in section 8 of the booking agreement. [`docs/dev/booking-agreement.md:97-98`; for BPP to review]
7. Complaints that we have not resolved can go to the ICO for data issues. [Privacy notice s9]

## 2. Personal-data breach routine
A personal data breach is a security incident affecting personal data, for example a lost phone with access to the admin site, a wrongly sent email, or a leaked key. Steps, for Luke to follow:

1. **Contain.** Revoke the affected keys or sessions and stop the cause. Rotating credentials is Luke's action. [CLAUDE.md approval gates]
2. **Write it down straight away** with the time you became aware: what happened, what data, whose, how many people, what you did. Keep a record of every breach, including ones not reported. ICO: "Article 33(5) requires you to document the facts regarding the breach, its effects and the remedial action taken." [ICO personal data breaches guide](https://ico.org.uk/for-organisations/report-a-breach/personal-data-breach/personal-data-breaches-a-guide/), checked 2026-11-27 (fetch summary)
3. **Decide if it is notifiable** to the ICO: whether it is likely to result in a risk to people's rights and freedoms. [for BPP to review: the threshold judgement; take advice if unsure]
4. **Report to the ICO within 72 hours** if notifiable. ICO: "You must report a notifiable breach to the ICO without undue delay, but not later than 72 hours after becoming aware of it." Details can be given in phases but the notification should still be made inside 72 hours. Same source, checked 2026-11-27. (UK GDPR Article 33 on legislation.gov.uk was not opened.)
5. **Tell the people affected** without undue delay if the breach is likely to result in a high risk to them. ICO: "you must inform those concerned directly and without undue delay." Same source, checked 2026-11-27. [for BPP to review]
6. **Tell Stripe, Supabase, Resend or Cloudflare** where the incident touches their service, using their own contact routes. [Embr drafting; to be decided: Luke]
7. **Review:** note the cause and what changes, and add a test or checklist item if code was involved. [CLAUDE.md "Verify before marking done"]

Fields to record in `docs/` or a private log (not in git if it holds personal data): date and time aware, who found it, what data and categories, number of people, effect, actions, whether the ICO and individuals were told and when.

Note: the ICO data protection fee has not been paid, since Embr is a pilot and incorporation spend is deferred (Decision (Luke, 2026-11-26); fee background in `docs/research/r2-incorporation-and-domain.md`). Whether this affects the pilot is for BPP to review.

## Verification

Second pass on 2026-11-27 (orchestrator): the code citations were spot-checked against the files and match. The ICO 72-hour breach sentence and the "information in phases" rule were re-read on the live ICO guide. Draft only: every legal judgement is for BPP to review, and every "to be decided: Luke" item is listed in docs/workflow-state.md.
