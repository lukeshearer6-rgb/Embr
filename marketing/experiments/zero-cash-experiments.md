# Zero-cash growth experiments: Manchester invite-only pilot

**Draft only. Luke sends and posts.** DRAFT: not sent. Nothing here has been posted, sent or arranged, and no one has been contacted. Task M5, drafted 2026-11-28.

Context: brand-led, invite-only pilot, Manchester first, zero cash (Decision, Luke, 2026-11-23; pilot plan in CLAUDE.md). No public teaser until the app can take a real paid booking (Decision, Luke, 2026-11-23). Every baseline below is "baseline: unverified, needs measuring". No targets and no predicted results appear in this file.

## How to read this

- Claude drafts and analyses. Luke sends, posts, contacts and signs up for anything. Nothing runs until Luke says so.
- Each experiment has one metric. Where the app is the data source, the metric is only usable once the app is live for the pilot. Where Luke's own log is the source, say so in the log header.
- Stop rules use time and evidence, not result targets. Luke can change the review period; "4 weeks" below is a review point, not a prediction.
- Do not mention fees, prices, "free", "paid instantly", "book now, pay later" or any comparison with agencies or other platforms in any copy from these experiments (R6 sections 2, 3 and 4; Decision, Luke, 2026-11-26: no fee claims in public copy). If a brand or talent asks about cost, Luke answers in conversation and does not put it in writing until he has approved the wording.
- Talent-facing wording describes tools only: a booking page to share, safe payment held through the booking, usage tracking, travel, on-time pay. Never "find work", "apply", "jobs" or "join to get work" (CLAUDE.md rule 2; Decision, Luke, 2026-11-20).
- Names of brands come from the R5 list. Tier B brands are unconfirmed on their own profiles; Luke checks before approaching.

## Summary

| # | Experiment | The one metric | Where the data comes from |
|---|---|---|---|
| 1 | Brand founder interviews | Interviews completed with notes saved | Luke's interview notes (R5 template) |
| 2 | Founding-brand invite list | Brand accounts created from invites | App (admin site) or Luke's invite tally |
| 3 | Founding talent share their booking page with brands that already book them | Brand enquiries received through booking links | App |
| 4 | Local creative community introductions | Brand introductions received | Luke's log |
| 5 | Photographers and stylists as introducers | Brands introduced by a creative who then take a call | Luke's log |
| 6 | Instagram content on Luke's account (gated) | Direct messages from brand accounts | Luke's Instagram inbox |
| 7 | Follow-up after a first booking | Brands with a second booking | App |

---

## 1. Brand founder interviews

**Hypothesis.** Founders of independent Manchester brands will give 20 minutes to talk about how they book people for shoots, and those conversations will show which parts of booking are hardest for them today.

**Steps.**
1. Claude drafts a short, plain intro message per brand from the R5 list (tier A first), using only facts from the brand's own page. No pitch, no fees, no launch date. (Claude)
2. Luke reviews, edits and chooses which brands to contact. Contacting a brand is an outward action, so it is Luke's decision. (Luke)
3. Luke sends through each brand's public business contact route listed in R5. Where R5 says "none found", Luke decides whether to use another public business route. (Luke)
4. Luke runs the 20-minute R5 script, says the consent line first, and records yes or no. (Luke)
5. Luke saves notes in the R5 template, with no personal contact details in the file. (Luke)
6. Claude summarises notes across interviews: how brands book, pay, check age and agree usage today. (Claude)

**Who does what.** Claude drafts messages and summarises. Luke contacts, interviews and decides.

**Metric.** Interviews completed with a saved note file, counted by Luke from his notes folder. One count; not split by brand type. Baseline: unverified, needs measuring.

**Stop or continue.** Review after 4 weeks of outreach. Continue while new interviews still produce new answers to the R5 questions (Claude checks the summaries for repeated answers). Stop, and rethink the approach with Luke, if outreach produces no interviews at all, which would show the message or route is wrong, not the idea. Stop immediately for any brand that says no or does not want contact.

**Copy risks (R6).**
- 3.1, 3.3: do not imply Embr is live or that the brand will get access. The interview closing line in R5 already says only that notes will be written up.
- 3.5 and 2.2: the message comes from a person, so say who Luke is and that Embr is not yet a company. Embr is not incorporated (Decision, Luke, 2026-11-18). Do not call it a "company" or "Ltd". Email to businesses still needs a check on consent and opt-out rules (R6 section 7; PECR not researched).
- Do not describe prices, fees or results (R5 script rule).

---

## 2. Founding-brand invite list

**Hypothesis.** A short, personally sent invite to brands who have already taken part in an interview, or whom Luke already knows, will lead some of them to create a brand account for the pilot.

**Steps.**
1. After experiment 1, Luke picks brands he is happy to invite. Only brands who have spoken to him, or whom he knows, go on the list. (Luke)
2. Claude drafts one invite per brand: what the pilot is (invite-only, Manchester, brand-led), what the brand can do in the app today (search the board, make an offer, hold a booking), how to join. Only features listed in `docs/dev/CHANGELOG.md` as shipped; Claude checks this before drafting. (Claude)
3. Luke sends each invite himself, by direct message or email he chooses. (Luke)
4. Luke notes in a simple list who he invited and on what date. (Luke)

**Who does what.** Claude drafts after checking the changelog. Luke selects, sends and keeps the list.

**Metric.** Brand accounts created from invites. Source: the app's brand account list on the admin site (`/admin`) once the pilot app is live. Whether the admin site shows which invite a signup came from is unverified: ask the developer agent. If it does not, use Luke's invite list and match account names by hand. Baseline: unverified, needs measuring.

**Stop or continue.** Review after 4 weeks from the first invite sent. Continue with a brand segment (for example jewellery, streetwear, skincare) only if brands in it have created accounts. Stop inviting a segment where none have, and ask the interviewed brands why. Never send a reminder more than once to the same person.

**Copy risks (R6).**
- Do not name any fee, any "free" offer or any "first booking" deal. The fee-free first booking for founding brands is still an open decision (decisions.md, Campaign).
- Do not say "book now, pay later" (R6 section 4; not built, credit status unverified).
- Do not call the app available to everyone: say invite-only and Manchester first (3.9, 3.10).
- Do not promise a launch date or access.
- Do not use real brand names in published material; the invite itself is private to the recipient.

---

## 3. Founding talent share their booking page with brands that already book them

**Hypothesis.** Founding talent who already take enquiries by Instagram message will share their Embr booking page with brands they already work with, and some of those brands will start a booking through it.

**Steps.**
1. Luke decides which founding talent to ask. They must be 18+ (Decision, Luke, 2026-11-20). (Luke)
2. Claude drafts a short message to those talent, in tool terms: your booking page (`/@name`) lets a brand you already work with book you, hold the payment safely through the booking, and agree usage in one place. No mention of fees or earnings. (Claude)
3. Luke sends the message to each talent person. (Luke)
4. Talent decide whether to share the page, and with whom. Embr does not give talent a list of brands or ask them to approach brands they do not know. This keeps the experiment on the booking-link route, not on talent seeking work. (Talent)
5. Claude drafts a short brand-side note that talent may choose to forward: what the brand will see when it opens the page. Luke approves before talent get it. (Claude, Luke)

**Who does what.** Claude drafts both messages. Luke approves and sends. Talent choose whether to share.

**Metric.** Brand enquiries received through booking links (a brand starting a booking from a talent's booking page). Source: the app. If the app does not yet count these, ask the developer agent to confirm what a query on bookings or enquiries with a link source can return. Baseline: unverified, needs measuring.

**Stop or continue.** Review when at least one real paid booking has been possible through the app, then after 4 weeks. Continue if enquiries are arriving that Luke did not prompt personally. Stop and ask founding talent what stopped them sharing if enquiries stay at zero while talent confirm they shared the page.

**Copy risks (R6 and Embr rules).**
- Never write "get work", "get booked by new brands", "find clients" or similar. Describe the page as a tool for brands that already book the talent (CLAUDE.md rule 2).
- Do not use "free" for talent. Founding talent are free during the pilot (decisions.md, Campaign), but "free" claims need the commitment and end explained (3.23, 3.24). Leave it out of written copy and let Luke say it in conversation.
- Keep "Let work find you" out of this message, since it sits close to a money topic.
- 0% / no-commission claims: do not use (R6 section 4; needs evidence and "who pays" wording first).
- No "paid instantly" (R6 section 4). Use "paid through the booking" only if Luke approves that wording.
- Any quote from talent about this: 3.44 to 3.50 apply (genuine, written permission, contact details held, incentives disclosed).

---

## 4. Local creative community introductions

**Hypothesis.** Manchester creative communities (photography groups, university fashion and design courses, studio spaces, makers' markets) already have trusted relationships with local brands, and some members will introduce Luke to brands.

**Steps.**
1. Luke picks 3 to 5 communities he already belongs to or can reach through people he knows. Claude does not search for or list private individuals. Public organisation pages only. (Luke)
2. Claude drafts a short, honest note for a community organiser: what Embr is, that it is a pilot and not yet live, and one specific ask, such as a 15-minute chat or an introduction to a brand that books shoots. (Claude)
3. Luke sends the note himself and records the reply. (Luke)
4. Where Luke is invited to speak or post, Claude drafts the talking points, and Luke says what he is comfortable saying. (Claude, Luke)

**Who does what.** Claude drafts notes and talking points. Luke selects communities, sends, attends and logs.

**Metric.** Brand introductions received: the number of times someone from a community names a brand and offers to introduce Luke. Source: Luke's log, one line per introduction with the date. Baseline: unverified, needs measuring.

**Stop or continue.** Review after 4 weeks. Continue with a community that produced an introduction. Stop approaching communities that did not reply after one follow-up. Do not post to a community's public channels without Luke's approval and without checking the community's own rules.

**Copy risks (R6).**
- Do not describe Embr as live, launched or available (3.1).
- No talent-facing "find work" wording in a message that talent in the community will also read.
- If anything is offered in return (a mention, a shared post), disclose it (3.45 by analogy for incentivised reviews; keep it simple and say it plainly).
- Do not claim endorsement by any university, group or venue unless they give written permission (3.50 by analogy).
- No agency or competitor names (3.41).

---

## 5. Photographers and stylists as introducers

**Hypothesis.** Photographers, stylists, hair and make-up artists who already work with Manchester brands can introduce Luke to those brands, because they already hear what goes wrong when brands book people.

**Steps.**
1. Luke lists creatives he knows personally who work with local brands. Claude drafts nothing for people Luke does not know. (Luke)
2. Claude drafts a short message: Embr is a pilot, brand-led, for booking unsigned talent and creatives; here is what is built today; would you be willing to introduce one brand you work with, if you think it would help them? (Claude)
3. Luke sends it himself. (Luke)
4. For any brand introduced, Luke follows up with the experiment 1 interview request and the R5 consent line. (Luke)

**Who does what.** Claude drafts the message. Luke chooses, sends, and follows up.

**Metric.** Brands introduced by a creative who then take a call with Luke. Source: Luke's log. Count a brand once. Baseline: unverified, needs measuring.

**Stop or continue.** Review after 4 weeks. Continue with creatives whose introductions led to calls. Stop with any creative who says introductions are awkward for them. Do not chase.

**Copy risks (R6 and Embr rules).**
- Creatives are also talent on Embr (multi-role profiles, decisions.md Product and money). Do not describe the introduction as a way for them to get bookings or work; describe it as a favour to a brand they already know. No "refer and earn" or any reward, which would also raise disclosure and money questions.
- Do not state fees or paid membership.
- Do not use any quote or name publicly without written permission (3.47, 3.50).

---

## 6. Instagram content on Luke's account (GATED: do not run yet)

**Gate.** Do not draft public teaser copy for release, and do not post, until the app can take a real paid booking (Decision, Luke, 2026-11-23). Check `docs/workflow-state.md` for the current state before starting. Until then, this is only a plan.

**Hypothesis.** Once the app can take a real paid booking, short posts on Luke's own account about unsigned talent and independent brands, under the "Unsigned, not unseen" platform, will prompt brands in his network to message him.

**Steps.**
1. Luke confirms the gate is met. (Luke)
2. Claude drafts 3 captions and a Canva visual brief each, as drafts only: a short story about one decision a brand has to make when booking someone (using interview notes with the brand's permission, no names unless agreed); a behind-the-scenes post about building Embr; a post on usage rights in plain words. Canva designs stay as drafts until Luke approves. (Claude)
3. Luke edits and posts from his own account. (Luke)
4. Luke labels each post upfront as promotion for his own project, visible before people engage (R6 section 6; ASA brand-owned social advice; 2.1, 2.3). (Luke)

**Who does what.** Claude drafts captions and visual briefs. Luke approves and posts.

**Metric.** Direct messages from brand accounts that mention a post. Source: Luke's Instagram inbox, counted by Luke. Whether Luke's account shows other useful numbers (reach, link taps) depends on the account type: unverified. Baseline: unverified, needs measuring.

**Stop or continue.** Review after 4 weeks of posting. Continue the post type that brought brand messages. Stop a type that brought none after Luke has posted it at least twice. Stop all posting if the app can no longer take real bookings.

**Copy risks (R6 and Embr rules).**
- The upfront label for Luke's personal account (2.1, 2.3); trader identity should be clear, and Embr is not incorporated yet.
- No "paid instantly", "0% of your earnings", "no commission", "free" or "book now, pay later" (R6 section 4).
- No agency or competitor mentions; "Burn Agency Fees" is not a headline (decisions.md).
- Any statistic about the industry needs a source and a checked date (CLAUDE.md rule 1) or it is cut.
- Talent-facing posts: tools only, no "find work", "apply" or "jobs". "Let work find you" stays away from any membership or money line.
- Photos of real people need their written permission.
- Any app screenshot or mock-up follows `DESIGN_RULES.md` section 4.

---

## 7. Follow-up after a first booking (GATED: needs a real booking)

**Gate.** Starts only after a brand has completed a real paid booking through the app. There is nothing to follow up on before that.

**Hypothesis.** A brand that has had a smooth first booking, and that Luke thanks and asks one open question, is more likely to book again, and its answer shows what to fix.

**Steps.**
1. When a booking is signed off, Claude drafts a short thank-you and one open question ("What would have made that easier?") for Luke. (Claude)
2. Luke sends it himself within a few days. (Luke)
3. Claude records the answers in a note and passes anything about the product to the developer agent. (Claude)
4. If the brand agrees in writing, Luke may ask for a short comment for later use. Claude holds the written permission and contact details on file. (Luke, Claude)

**Who does what.** Claude drafts and records. Luke sends and decides.

**Metric.** Brands with a second booking. Source: the app (a brand with two or more bookings). Baseline: unverified, needs measuring.

**Stop or continue.** Review once several brands have had the chance to book twice; the number of brands and the time window are Luke's call, set when the first booking completes. Continue the follow-up if brands reply and the notes lead to product changes. Stop sending the question if brands say it is unwelcome.

**Copy risks (R6).**
- Testimonials: 3.44 to 3.50. Written permission, contact details on file, quote unedited, any incentive disclosed, no testimonial alone as evidence for a claim (ASA substantiation advice).
- Do not turn a thank-you into a hidden sales message; if a brand asks about fees, answer in conversation.
- Do not publish "brands rebook" as a claim without the evidence on file (3.7).

---

## Claims and rule checks

| Check | Result |
|---|---|
| Any number, price, fee or result claimed? | None. All baselines are "unverified, needs measuring". Review periods ("4 weeks") are working suggestions for Luke to confirm, not results. |
| Talent copy says find work, apply, jobs? | No. Experiments 3 and 5 explicitly avoid it. |
| "Let work find you" near pricing? | Not used next to money. Kept out of experiments 3 and 6 money-adjacent copy. |
| Comparative or pricing claims? | None. Competitors and agencies are not named. |
| Outward actions? | All are Luke's: sending, posting, contacting, attending. Claude drafts only. |
| Zero cash? | Yes. No ads, paid tools or boosts. Canva is used for drafts only. |

## Sources and claims to check

- Pilot is brand-led, invite-only, Manchester first, no public teaser before a real paid booking: Decision (Luke, 2026-11-23), [docs/decisions.md](/home/user/embr/docs/decisions.md), read 2026-11-28.
- Talent cannot apply or message brands for work: Decision (Luke, 2026-11-20), same file.
- "Let work find you" and "Unsigned, not unseen": Decisions (Luke, 2026-11-20 and 2026-11-23), same file.
- Talent 18+ only; booking link and Book-me page (`/@name`); multi-role profiles; admin site at `/admin`: same file.
- Founding talent are free during the pilot: decisions.md, Campaign (undated line). Not used in any copy here (R6 3.23, 3.24).
- No fee claims in public copy: Decision (Luke, 2026-11-26), same file.
- Embr not incorporated: Decision (Luke, 2026-11-18), same file. Luke pays incorporation when ready; Embr stays a pilot until then (2026-11-26).
- Brand targets, contact routes, interview script, consent line and note template: [docs/research/r5-brand-interview-kit.md](/home/user/embr/docs/research/r5-brand-interview-kit.md), sources checked 2026-11-27. Tier B brands unverified on their own profiles. Companies House not checked.
- CAP Code rules 2.1, 2.3, 3.1, 3.3, 3.5, 3.7, 3.9, 3.10, 3.23, 3.24, 3.41, 3.44 to 3.50 and the Instagram labelling advice: [docs/research/r6-cap-code-checklist.md](/home/user/embr/docs/research/r6-cap-code-checklist.md), checked 2026-11-25, second pass 2026-11-25. Re-open the live pages before quoting externally. PECR and email consent rules: not researched (unverified).
- Competitor context (not used for any claim here): [docs/research/r4-competitor-brief.md](/home/user/embr/docs/research/r4-competitor-brief.md), 2026-11-26.
- To confirm with the developer agent before running experiments 2, 3 and 7: whether the admin site or the app can show invite source, booking-link source and per-brand booking counts.
- To confirm from `docs/dev/CHANGELOG.md` before any invite copy: that each feature named has actually shipped.
- Needs Luke's approval before use: the word "free", any mention of fees, the 4-week review points, and any post or message.

## Verification

Orchestrator check on 2026-11-28: the decisions cited (no public teaser until a real paid booking, founding talent free during the pilot, talent cannot apply) match docs/decisions.md lines 37, 38 and the agency position. A scan found no talent-facing "find work", "apply" or "jobs" copy, and no fee, "free" or "paid instantly" claims outside the rule notes. No numeric targets or predictions.
