# Talent agency status declaration (DRAFT, needs solicitor review)

Status: **draft, not legal advice.** Added 2026-11-25 at Luke's request ("there needs to be some sort of waiver/disclaimer that talent sign upon account setup…"). It must be reviewed by the solicitor Luke chose (BPP Enterprise Clinic, task D4) before the pilot opens to real talent.

## Where it appears

- **Sign-up:** a required tick box on the talent account form (`src/views/auth.js`, `agencyBox`). The database refuses a talent account without it (`create_profile` in `supabase/migrations/20261125000001_talent_snags.sql`).
- **Existing talent:** a "Confirm your agency status" panel on Profile (`declare_agency()`). Their profile stays hidden from brands until they confirm.
- **Record kept:** `talents.agency_declared_at` (time) and `talents.agency_declaration` (the exact versioned wording they agreed). The wording lives in one place, `public.agency_declaration()`, and the app shows that same text.

## Current wording (version agency-v1, draft 2026-11-25)

> I confirm that I am not under an exclusive contract with a modelling or talent agency, or that any agency or management contract I have allows me to accept bookings on my own. I am responsible for making sure that using Embr and accepting bookings does not break any agreement I have with anyone else, and Embr is not responsible for any such breach. I will tell Embr if this changes.

## Questions for the solicitor

1. Is a sign-up declaration like this enforceable, and does the "Embr is not responsible" sentence need to sit in the platform terms instead (or as well), given the Consumer Rights Act 2015 fairness rules if talent are treated as consumers?
2. Should the declaration be repeated per booking (in the booking agreement, `docs/dev/booking-agreement.md`) rather than only at sign-up?
3. Should Embr ask for an indemnity, or is a warranty plus responsibility statement enough and fairer for individual talent?
4. Does anything here make Embr look like it is placing talent with agencies' clients (Employment Agencies Act 1973 / Conduct Regulations 2003 framing, see the agency-status notes)?
5. Wording for "exclusive" versus "sole" representation, and for management (not agency) contracts.

## Changing the wording

Never edit the text in a deployed migration. Add a new migration that replaces `agency_declaration()` with a new version prefix (agency-v2 …). Existing records keep the version they agreed. Decide with Luke whether talent must re-confirm when the version changes.
