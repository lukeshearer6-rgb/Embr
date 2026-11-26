# Embr decisions

Locked decisions from Luke. Change one only when Luke says so, and record the date. Cite these as "Decision (Luke, date)".

## Company and team
- Embr is not incorporated yet. Incorporation is the first company step. (2026-11-18)
- The team is Luke and Claude. Claude drafts, researches, designs and builds. Luke sends, posts, calls and tests. (2026-11-23)
- Zero cash budget: be creative. The only accepted costs are incorporation and a domain, and each still needs approval. (2026-11-23)
- No estimated figures. Research and cite everything, and list what can't be sourced as something to measure. (2026-11-18)
- Ask Luke before every external action for now. Autonomy grows as trust is built. (2026-11-23)

## Agency position (2026-11-20)
- Avoid Embr being an employment agency.
- Talent cannot apply for jobs or message brands about jobs. Brands search the board, and Embr ranks talent against the brief.
- Embr keeps brand-side matching and closes the booking.
- No commission on talent ("0% of your earnings"). A paid talent subscription is kept for tools and premium features, not for getting work. The paid membership comes only after brands book and a specialist opinion is obtained.
- The defence leans on Equity v Talent Systems (Spotlight, 2025). A specialist legal opinion is still recommended before talent are charged.
- Talent are 18+ only.

## Product and money
- Brands pay a 50% deposit, held through Stripe, and the balance on completion. There is no reduced deposit for repeat brands.
- **Book now, pay later** is one of the biggest brand features. Brands book on their traditional invoicing cycles, and creatives are paid instantly on completion. It would be delivered through a plugged-in B2B "Klarna-style" pay-later partner, not by Embr lending its own money. (Luke, 2026-11-17, confirmed 2026-11-23.) It is not built in the pilot yet (R7, D5).
- Pilot brand fee: 10% on the first booking with a person, 7% from the 2nd, 5% from the 5th, 5% on booking links. Talent get 100% of the fee. (Pilot app, 2026-11-23; the tiers still need Luke's final confirmation for launch.)
- Automatic sign-off 72 hours after wrap. Free cancellation until 7 days before the shoot. After that, talent get 50% of the session fee.
- Usage applies only if the talent makes the final cut.
- Booking link and Book-me page (`/@name`) move Instagram enquiries onto Embr.
- Multi-role profiles: talent pick every role they do, each role has a portfolio section, and the profile goes live only when every section is filled. (2026-11-23)
- The Model role needs full comp-card measurements. (2026-11-23)
- Staff use a separate desktop admin site at `/admin`, not the app. (2026-11-23)
- Jobs/briefs stay in the brand's main navigation. The app must feel premium and keep the independent, new-faces feel.
- It is a web app (PWA) first. No app-store build yet.

## Campaign
- "Unsigned, not unseen" is the campaign platform. (2026-11-23)
- "Let work find you" is the talent line. (2026-11-20)
- "Burn Agency Fees" is not a headline.
- Invite-only, brand-led pilot in Manchester first. No public teaser until the app can take a real paid booking. (2026-11-23)
- Founding talent are free during the pilot.
- Still open: pilot city confirmation, a fee-free first booking for founding brands, the founder on camera, and the brand fee tiers.

## Workspace (2026-11-23)
- The code lives in a private GitHub repo, with Luke's Mac folder `Documents/EMBR` as the local copy.
- The pilot app is the repo root. The prototypes are archived.
- Use whichever tools are most token-, time- and cost-efficient, and use all connected plugins (Mobbin, Canva and others) to make the best app and company.

## Legal review (2026-11-24)
- Booking agreement review: Luke chose the BPP Legal Advice Clinic for Enterprise (free, online). Decision (Luke, 2026-11-24). Luke submits the enquiry himself; route and draft in docs/research/r3-agreement-review-shortlist.md and docs/dev/bpp-enquiry-draft.md. Don't approach other advisers on the same matter while BPP is considering it.

## Autonomy (2026-11-24)
- Agents may push branches, open and merge their own PRs once CI is green, and change the pilot's test setup (Supabase test project, Stripe sandbox) without asking. Public deploys, publishing, contacting people, spending, credentials and live money still need Luke. Decision (Luke, 2026-11-24).

## Payout account losses (2026-11-25)

- Talent payout accounts are Stripe Accounts v2 recipients. Stripe only accepts Embr (the platform) as losses collector for this kind of account (Stripe API error, 2026-11-25), so Embr carries negative balances on talent accounts, as it already carries chargebacks on its own charges under separate charges and transfers. Needs Embr's Connect platform profile finished in Stripe.

## Usage fee when talent are cut from the edit (2026-11-26)

- No "no usage fee if the talent doesn't make the final cut" rule for now. It only applies to commercials where talent miss the final cut, and Embr isn't for productions that size at first. The usage fee stays charged with the booking. Decision (Luke, 2026-11-26).

## Pilot money and copy (2026-11-26)
- Incorporation and domain: Luke pays when he is ready. Until then Embr keeps running as a pilot; don't ask about this spend again. Decision (Luke, 2026-11-26).
- The welcome screen carries no fee claim ("Embr takes 0% of your fee" removed, not reworded). Decision (Luke, 2026-11-26).
