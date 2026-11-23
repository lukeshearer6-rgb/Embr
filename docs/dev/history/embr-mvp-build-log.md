# Embr MVP prototype: build log

**Artifact:** https://claude.ai/artifact/AZrKKDjDth2Q23UZkBpRBW · **File:** Documents/EMBR/Embr_MVP_App.html · **Source:** Documents/EMBR/embr-source (src.html + build.py) · **Owner:** Luke Shearer

## Version history
- **v1 (17 Nov 2026):** first clickable prototype. Dark theme, card-based UI.
- **v2 (17 Nov 2026):** full redesign after Luke said v1 looked "too AI". Added the 50% deposit model, business pay-later on the balance, and final-cut (conditional) usage.
- **v3 (17 Nov 2026):** travel and expenses: four travel options, travel advance, receipt claims and approval, brand-booked itinerary, accommodation, travel day. The board shows talent who'll travel. Jobs set a travel policy.
- **v4 (17 Nov 2026):** repeat bookings and anti-leakage: brand fee tiers per talent pair, Roster with one-tap rebooking, usage extensions, off-platform message warning, call-sheet contacts, talent Rebooked badge, free membership months, tax-year earnings statement, "bring your own client" at 5%, 12-month booking-through-Embr clause, ops Repeat bookings tab.
- **v5 (17 Nov 2026):** one monthly invoice for trusted clients, a working buy-out flow, and an Ops Pricing panel to change fee tiers, the deposit and buy-out terms without a rebuild.
- **v5.1 (17 Nov 2026):** removed the trusted-client deposit reduction at Luke's request. Every brand pays 50%.
- **v5.2 (17 Nov 2026):** brands upload train, coach or flight tickets (images or PDFs) for "We'll book it" travel. Tickets appear on the talent's call sheet with a "View ticket" button.
- **v5.3 (17 Nov 2026):** brands upload hotel, Airbnb or serviced-apartment booking confirmations, with address, check-in and check-out dates and a reference or door code. They appear on the call sheet with a "View booking" button.
- **v5.4 (17 Nov 2026):** **Embr booking links** for enquiries that start on Instagram, WhatsApp or email. Talent create a link with the terms and get a ready-written Instagram reply. The brand lands on a page showing the talent, terms and price, then accepts and pays the 50% deposit, or suggests changes. New businesses sign up on the page. Link bookings use the 5% direct-client fee. Talent "Invite" tab renamed "Links". Mobile bottom bar gets a "More" menu.
- **v6 (17 Nov 2026):** ten features Luke approved from Claude's "what would make this a success" list:
  1. **Auto sign-off** 72 hours after talent mark the job wrapped, unless a problem is reported. Hours set in Ops Pricing.
  2. **Safety tools** (framed as tools Embr provides, not agency protection, per Luke): content comfort list, content agreed per booking with a warning to brands, chaperone allowed, shoot-day check-in/out, live-location sharing with a trusted contact, Get help button feeding an Ops Safety tab.
  3. **18+ only:** unverified talent can't accept bookings or create booking links.
  4. **Options (holds):** 1st/2nd/3rd option, hold-until date, promotion when released or lapsed, 2nd can ask 1st to decide, confirm via pre-filled offer.
  5. **Shareable shortlists:** client marks yes/maybe/no without an account; "Book the yeses".
  6. **Team booking:** one brief to several people; pay all accepted deposits at once.
  7. **Digitals on request.**
  8. **Usage watch** (online findings simulated in the prototype).
  9. **Book-me page** (embr.app/@name) for Instagram bios.
  10. **Tax pot and invoices:** set-aside guide, self-billed invoice per job, Self Assessment CSV.
  11. **Rate guidance** with a warning when well below the usual range.
- **v6.1 (17 Nov 2026):** **TV and outdoor tracking**: TV ad clock numbers checked against airing data (simulated), poster schedules and site photos, "Spotted it" sightings from talent and followers, agreement clause 5a. Fixed "Paid Invalid Date" and out-of-order seed history.
- **v6.2 (17 Nov 2026):** terms learned from Luke's own signed contracts: usage from first use (6-month backstop), pre-priced renewals (+10%), day length / overtime / fitting fee with overtime claimed at wrap from check-in times, named category exclusivity with a clash check, per-booking AI consent, portfolio rights and posting rules, new agreement clauses. Details in `embr-contract-review.md`.
- **v7 (17 Nov 2026):** **simplification pass for local brands and new faces** (plan: `embr-simplification-plan.md`), after Luke said the app was drifting from the independent/new-models vibe.
  - **Offer form:** usage now reads "Where you'll use the images" with plain-English places (Instagram and TikTok, Paid social ads, Website and online shop, Email newsletters, Posters and print, TV, All of it). "Final cut only" became "Only pay if we use it". Region and renewal price only appear when More options is open.
  - **More options** (collapsed, with a one-line summary of the defaults): day length, overtime, fitting fee, final-cut deadline, exclusivity, AI, posting, portfolio, cancellation. Defaults apply quietly: 10-hour day, overtime 20% of day rate, no exclusivity, no AI changes, post after launch, portfolio allowed, free cancellation until 7 days before. Exclusivity clash warnings still show outside the collapsed section.
  - **Board:** the Options section is gone; a held 1st option becomes a to-do ("Confirm booking"). Full list of held dates lives on Roster as "Dates on hold". The to-do list shows five items with "Show all".
  - **Roster:** "Share a shortlist" is now a small "Share with a client" button.
  - **TV and posters** section on bookings only appears when TV or posters/print is in the usage (or records already exist), no longer for "All of it". Brand wording: "TV ad ID (clock number)", "poster details", "site photos" instead of clock number, outdoor schedule, proof of posting.
  - **Usage watch** panel on talent Today only appears when something needs a look; a quiet "Where your images are used" panel sits in Wallet.
  - **Demo data:** "Northline Apparel" became **Rivet Studio** (London streetwear). Seed day rates, usage fees and job rates scaled to new-face levels (about 0.6x; models now roughly £180–£300 a day). Rate guide starting ranges lowered (models £150–£350). Fewer big-campaign examples: no seeded TV ad, shared shortlist or 2nd option; "SS27/SS26 campaign stills" became "Drop 4 lookbook" / "Summer drop lookbook".
  - Checked at phone width (390px). All 10 regression suites pass after updating them for the new labels and data.

## Decisions (17 Nov 2026, Luke)
| Decision | Rationale | Owner |
|---|---|---|
| Brands pay a **50% deposit upfront**, held by Embr/Stripe; the balance is due on completion | Protects talent against no-shows and late cancellations; brands commit | Luke |
| Pay-later is a **B2B "Klarna-style" partner** plugged in at the balance step | Keeps brands on familiar 30/60-day terms; the partner pays Embr upfront | Luke |
| Usage can be **conditional on making the final cut** | Brands won't guarantee usage before the edit; talent still get paid if images are used | Luke asked; mechanism by Claude |
| Brands can **pay for talent travel** through the app | Talent shouldn't be out of pocket getting to jobs in other cities | Luke asked; mechanism by Claude |
| **Brands can upload train and coach tickets** when they book travel | Talent get their tickets in one place, on the call sheet | Luke, 17 Nov 2026 |
| **Brands can upload hotel and Airbnb bookings** when they book accommodation | Talent get the address, dates and check-in details with their tickets | Luke, 17 Nov 2026 |
| **Incentivise repeat bookings to stay on Embr** | Stop brands and talent going direct after meeting | Luke approved all of Claude's proposals |
| **No deposit reduction for trusted clients.** The deposit stays 50% for every brand; trusted status only unlocks the monthly invoice | Luke reversed the 25% trusted deposit after it was built | Luke, 17 Nov 2026 |
| **Talent can send an Embr booking link** to brands who contact them on Instagram | Safety and guaranteed payment for talent; brings new brands onto Embr | Luke, 17 Nov 2026; 5% direct fee applied by Claude |
| **v6 set:** auto sign-off, safety tools, options, shared shortlists, team booking, digitals, usage watch, Book-me page, tax pot/invoices, rate guidance | Make Embr the workflow for brands and the reason talent route work through it | Luke approved all, 17 Nov 2026 |
| **18+ only.** Talent must be ID-verified before accepting bookings | UK child performance licensing is out of scope | Luke, 17 Nov 2026 |
| **Safety is presented as tools Embr provides, never as agency-style protection** | Embr is not an agency | Luke, 17 Nov 2026 |
| **Track TV via clock numbers and posters via schedules, site photos and sightings** | Image search can't see TV or billboards | Luke ("go"), 17 Nov 2026; approach by Claude |
| **Use real contracts only where they fit Embr's market** | Luke's contracts are big-brand deals for a signed model | Luke, 17 Nov 2026 |
| **Embr stays focused on independent/new talent and newer, local brands.** Advanced protections run underneath with quiet defaults; brand screens stay short and jargon-free | Recent builds drifted toward big-agency workflows | Luke, 17 Nov 2026 |

## Product test for new screens (from v7)
Can a two-person brand book a new face on their phone in under two minutes without reading anything they don't understand? If a feature fails that, it goes behind More options or only appears when relevant.

## TV and posters tracking (v6.1): how it would work for real
- **TV:** every UK TV ad gets a Clearcast clock number; Barb identifies each measured ad by it. Airing data comes via a Barb-subscribing data bureau or Clearcast data services (licence needed; cost unknown). Not a launch feature.
- **Posters/outdoor:** no national register. Verification relies on the brand uploading the schedule and the poster company's proof-of-posting photos; undeclared campaigns can only be caught by sightings.
- **Enforcement:** booking agreement clause 5a; the charge for use outside the licence must be proportionate (solicitor to set).

## Repeat bookings and leakage (built v4 and v5)
**Key insight:** talent pay 0% commission, so they gain nothing financially by going around Embr. The brand's fee is the only money saved off-platform.

- **Fee tiers per talent** (defaults): 10% first booking → 7% from the 2nd → 5% from the 5th completed booking with the same person.
- **Roster** with "Book again", usage extensions prompted 45 days ahead, trusted-client monthly invoice.
- Talent incentives: Rebooked badge, free membership months, earnings statement, bring your own client at 5%, booking links, Book-me page.
- Guardrails: off-platform message warning, 12-month booking-through-Embr clause with a buy-out (10% of last 12 months' fees, minimum £250).

## Pay-later partner recommendation (Claude, 17 Nov 2026)
**Kriya** first choice (UK, marketplace-focused, takes credit risk, 30/60/90-day and end-of-month-following terms, on Stripe UK); get a competing quote from **Two**. Watch-out: Kriya likely pays Embr directly rather than via Stripe Connect.

## Money flow
1. Talent accepts (or the brand accepts a booking link) → brand pays a 50% deposit, plus any travel or accommodation allowance. Deposit held in Stripe; travel advance straight to talent.
2. Talent wraps (claiming any overtime) → brand signs off within 72 hours (or it signs off automatically), approves expenses and overtime, pays the balance by card, 30/60-day terms or monthly invoice. Talent paid in full at sign-off.
3. Final-cut usage, renewals and extensions are charged and paid as they're agreed.
4. Late cancellation by the brand: talent get 50% of the session fee from the deposit and keep the travel advance.
5. Disputes: funds stay held and the auto sign-off clock stops.

## Research notes (17 Nov 2026)
- Stripe doesn't provide escrow; **don't market this as "escrow"**. Confirm hold limits with Stripe.
- UK B2B pay-later typically 1.5–4% per transaction.
- Competitor: **Swipecast** (NYC, 2015). Lessons: one city first, win brands, be the workflow, verify rather than gatekeep, stay independent.
- Legal: see `embr-legal-talent-subscription.md`. Keep job-matching on the brand side so the talent subscription stays a fee for tools.

## Design system (v2+)
- White, studio-backdrop grey #ecedee, true black, graphite #5e6168, Embr orange #ff3b00 (logo and money-moving actions only). Archivo with wide titles.
- Demo photos are crops of Luke's embr_portfolio_images; replace them before showing externally.

## Still open
Membership price (£10–£18) · legal opinion on the talent subscription · test fee tiers against real retention data · solicitor review of the booking agreement (incl. 5a records, first-use backstop, renewals, AI, auto sign-off) · pay-later fees and who absorbs them · Stripe hold limits · travel-advance recovery · secure storage for tickets, accommodation, digitals and media records · VAT on recharged expenses · Pro and featured pricing · booking-link domain, expiry and anti-abuse rules · staffing for the safety line · self-billing agreements (HMRC rules) · usage watch provider cost · launch city and first 20 brands

## Production integrations needed
Auth and database · Stripe Connect (deposits, holds, transfers, payouts, saved cards for auto sign-off) · B2B pay-later partner · KYC/age and business verification · secure file storage · message scanning · email, SMS and push notifications · live location sharing · reverse image search provider · TV airing data (later) · staffed safety line · public link, Book-me and shortlist pages on a real domain · legal and accounting
