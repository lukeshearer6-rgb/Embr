# Embr positioning pack: "Unsigned, not unseen"

**DRAFT: not sent, not published.** Written 2026-11-23 for backlog task M1. Luke reviews and approves before any line is used outside the team.

This pack is the reference every other draft (M2 invites, M3 landing, M4 posts) pulls from. It sets what Embr says, to whom, what proves it, and which claims are not allowed out yet.

Word choice: this pack says **talent** throughout, because Luke has not picked a replacement. Section 9 shows how "Crew" would read.

---

## 1. Positioning in one breath

**For brands:** Embr is the UK board of unsigned models and creatives. Post a brief, Embr ranks who fits, and you choose who gets an offer. The booking, agreement, deposit and usage terms live in one place.

**For talent:** Embr is where your bookings live. Offers, terms, usage, travel and pay in one place, and Embr takes 0% of your earnings. Let work find you.

**The platform line:** Unsigned, not unseen.

### Positioning statement (internal, not copy)

For independent UK brands who want faces and creatives that look like their own customers, Embr is a booking board of unsigned models and creative talent where the brand searches, Embr ranks talent against the brief, and the brand makes the offer. Unlike booking through DMs and WhatsApp, every Embr booking has a written agreement, a held deposit and agreed usage. *(Sources: decisions.md, Product and money, Agency position, Campaign; Decision (Luke, 2026-11-20 and 2026-11-23). Shipped in the pilot app: CHANGELOG 2026-11-23. The app is tested locally and is not live yet.)*

Note what the statement does not say: it does not compare Embr with agencies, and it does not say talent find or get work.

---

## 2. Who we're talking to

Pilot is brand-led, invite-only, Manchester first *(Decision (Luke, 2026-11-23))*. Brands are recruited first and talent are invited to match what brands' briefs need *(campaign plan, section 3)*.

### Brands (primary)

| Segment | Who decides | What they need |
|---|---|---|
| Independent fashion and streetwear labels shooting lookbooks and drops | Founder or creative lead | A face that suits the brand, a fair day rate, usage they understand |
| Independent beauty and skincare brands | Founder or marketing lead | Content for product pages and social, with clear usage terms |
| Photographers and small studios booking for a client | The photographer | A reliable person, a shortlist the client can see, travel sorted |

Segments come from the campaign plan (section 3). The reasons they would switch are **hypotheses to test in the brand interviews (R5)**, not findings.

### Talent (invited to match brand demand)

| Segment | What they care about |
|---|---|
| Working unsigned models who already get paid jobs from Instagram enquiries | Moving DM enquiries onto a proper booking with the booking link |
| Models who have left representation | A fair, written booking and on-time pay |
| New faces with a usable portfolio | Safety and a professional profile |
| Creatives: UGC creators, actors, content creators, photographers, videographers, make-up artists, stylists | One profile for every role they do |

Roles are the eight in the app: Model, UGC creator, Actor, Content creator, Photographer, Videographer, Make-up artist, Stylist *(src/ui.js `CATS`; supabase/migrations/20261123000002_multi_role.sql `role_rules`)*. Talent must be 18+ *(decisions.md, Agency position)*.

---

## 3. Messaging house

```
                      UNSIGNED, NOT UNSEEN
        Independent talent and independent brands, booked properly.

  BRANDS                                   TALENT
  "The faces your customers                "Let work find you."
   actually look like."

  Pillar B1  Independent faces             Pillar T1  Your bookings, in one place
  Pillar B2  Embr ranks. You choose.       Pillar T2  0% of your earnings
  Pillar B3  Booked properly               Pillar T3  Your profile, every role
                                           Pillar T4  Safety tools you can see

  Foundations: UK, invite-only, Manchester first · premium and independent ·
  never agency-like · every claim sourced
```

### Brand pillars

**B1. Independent faces.**
Unsigned models and creatives, many of them local, on one board. Models, UGC creators, actors, photographers and more, so a small shoot can be booked from one place.
- Proof: multi-role profiles, live only when every role's portfolio is filled *(Decision (Luke, 2026-11-23); CHANGELOG 2026-11-23)*. The Model role carries full comp-card measurements and briefs filter on them *(CHANGELOG 2026-11-23, migration 3)*.
- Not yet: any number of talent on the board. **Unverified: needs measuring** once the pilot opens.

**B2. Embr ranks. You choose.**
Post a brief with a date, place, budget and usage. Embr ranks the talent who fit it. You decide who gets an offer.
- Proof: brands search the board and Embr ranks talent against the brief *(decisions.md, Agency position, 2026-11-20)*. Best-fit ranking is built in the pilot app *(src/views/brand.js)*.
- Don't say "the best talent", "perfect match" or "we find them for you". Embr ranks; the brand picks.

**B3. Booked properly.**
One fee shown before you book. A 50% deposit held through Stripe, the balance on completion. Usage agreed in writing. Automatic sign-off 72 hours after wrap.
- Proof: *decisions.md, Product and money*. Quote, deposit and usage fields are built *(src/views/brand.js, src/views/booking.js)*.
- Gated: payment and sign-off claims can't go public until test-mode bookings pass (B4) and payments run live. Never say "escrow" *(campaign plan, section 2)*.

### Talent pillars

Talent copy describes tools. It never says or implies that Embr gets anyone work (CLAUDE.md, hard rule 2).

**T1. Your bookings, in one place.**
Offers, terms, call times, usage, travel and messages for every booking, in one app.
- Proof: booking view shows where, call time, usage and agreed content *(src/views/booking.js)*. Brands can book talent from other cities with travel paid by the brand *(src/views/brand.js)*.

**T2. 0% of your earnings.**
Talent get 100% of the fee. Embr's fee is charged to the brand.
- Proof: *decisions.md, Agency position and Product and money*.
- **Pricing claim: needs Luke's approval and the R6 CAP check before public use.** When the paid membership arrives, any page with "0% of your earnings" must show the membership price plainly too, and "Let work find you" must stay away from that price *(decisions.md; campaign plan, Territory B risks)*.

**T3. Your profile, every role.**
Pick every role you do. Each gets its own portfolio section. Your Book-me page and booking link turn an Instagram enquiry into a proper Embr booking.
- Proof: multi-role profiles *(Decision (Luke, 2026-11-23))*; booking link and Book-me page `/@name` *(decisions.md, Product and money)*.

**T4. Safety tools you can see.**
18+ only, with an ID check through Stripe Identity. Written agreement on every booking. Messages stay on the booking.
- Proof: 18+ rule *(decisions.md)*; Stripe Identity *(CLAUDE.md, Tech stack)*.
- Gated: "ID-checked" can't be public until Stripe Identity runs live (D2). Describe safety as tools Embr provides, never as protection or representation *(campaign plan, section 2: Luke, 2026-11-17)*.

---

## 4. Lines ready for review

Status key: **Approved** = locked by Luke. **Proposed** = for Luke to approve. **Gated** = can't be public until the named step is done.

### Platform and taglines

| Line | Use | Status |
|---|---|---|
| Unsigned, not unseen. | Platform, every channel | Approved (Luke, 2026-11-23) |
| Let work find you. | Talent product line. Never next to a price | Approved (Luke, 2026-11-20) |
| The faces your customers actually look like. | Brand hook | Proposed (campaign plan, Territory A; to test in E2) |
| Independent talent and independent brands, booked properly. | Promise, under the platform line | Proposed |
| Post a brief. Embr ranks who fits. You choose. | Brand how-it-works | Proposed |
| 0% of your earnings. | Talent proof point | Proposed, pricing claim, needs R6 |

### Brand copy (short and long)

- **Short:** Unsigned, not unseen. Book independent models and creatives for your next shoot. Post a brief, see who fits, make the offer.
- **Long:** Embr is a board of unsigned models and creatives in the UK, starting in Manchester. Post a brief with your date, location, budget and usage. Embr ranks the talent who fit, and you choose who gets an offer. The agreement, deposit and usage terms sit in one place, and you see the fee before you book. *(Fee and deposit wording gated on B4.)*

### Talent copy (short and long)

- **Short:** Unsigned, not unseen. Your bookings, terms and pay in one place. 0% of your earnings. Let work find you.
- **Long:** Embr is built for unsigned models and creatives. Make one profile for every role you do. When a brand books you, the offer, agreement, usage, travel and pay are all in one place, and Embr takes 0% of your earnings. Got an enquiry on Instagram? Send your Embr booking link and it becomes a proper booking. Let work find you.
- **Invite framing (pilot):** "Founding talent join free during the pilot" *(decisions.md, Campaign)*. Never pair a founding invite with "Let work find you" and a price.

### Boilerplate (for press drafts, not for release yet)

> Embr is a UK booking app where independent brands book unsigned models and creatives directly. Brands post a brief, Embr ranks the talent who fit, and the brand chooses who to book. Talent keep 100% of their fee. Embr is running an invite-only pilot in Manchester.

Gated: needs Embr to be incorporated before any public use (trading details), and the pilot to be open *(decisions.md, Company; Campaign: no public teaser until the app can take a real paid booking)*.

---

## 5. Words to use and words to avoid

| Use | Avoid (and why) |
|---|---|
| booked, bookings, your bookings | find work, get work, jobs for you, apply, browse jobs (agency reading, hard rule 2) |
| brands make offers | talent pitch, talent message brands (talent can't, decisions.md) |
| Embr ranks talent against the brief | we match you, we put you forward, we represent (agency reading) |
| board, profile, Book-me page | roster of ours, our models, our talent (sounds like representation) |
| independent, unsigned, new faces | "better than an agency", "cheaper", "Burn Agency Fees" (CAP 3.41 denigration; no like-for-like evidence; decisions.md) |
| deposit held through Stripe | escrow, guaranteed pay, paid in X days (until live and confirmed) |
| safety tools, 18+ ID check | protected, vetted, safe guaranteed |
| fee shown before you book | no fees (brands do pay a fee) |

**Tone:** UK English, short sentences, warm and confident, premium and independent. Pride in independence, never a dig at anyone signed.

---

## 6. Objections and answers

These are for 1:1 conversations and the FAQ draft (M3). Each answer uses only decided or built facts.

| Objection | Answer |
|---|---|
| Talent: "How do I get booked on Embr?" | "Brands search the board and post briefs. Embr ranks profiles against each brief, and brands send offers. Keep your profile full and your dates up to date." (No promise of bookings.) |
| Talent: "What does it cost?" | "Founding talent are free during the pilot, and Embr never takes a cut of your fee." (Membership price not set; don't quote one.) |
| Talent: "Is it safe?" | "Everyone booked is 18+ and ID-checked, every booking has a written agreement, and the brand pays a deposit before the shoot." (Gated on D2 and B4 for public copy.) |
| Talent: "I already get enquiries on Instagram." | "Keep them. Send your Embr booking link and the enquiry becomes a proper booking with agreed terms and a deposit." |
| Brand: "Why not just DM models?" | "You can. Embr puts the agreement, deposit and usage in one place and shows you who fits your brief." (Don't criticise DMs or agencies.) |
| Brand: "What does it cost?" | "A booking fee on top of the talent's fee, shown before you book." Tiers (10%, 7%, 5%) are in the pilot app but still need Luke's final confirmation for launch *(decisions.md)*. Don't quote them publicly yet. |
| Anyone: "Is Embr an agency?" | "No. Embr is a booking app. Brands search and choose; Embr doesn't represent anyone." (Keep it short; specialist opinion still pending, R3.) |

---

## 7. Proof-point readiness

| Claim | Where it comes from | Private 1:1 now? | Public copy when |
|---|---|---|---|
| Unsigned, not unseen / Let work find you | Decisions | Yes | Pilot open |
| 0% of your earnings | Decision | Yes | Luke approves + R6 CAP check |
| Multi-role profiles, Book-me page, booking link | Decision + pilot app | Yes, as "in the pilot app" | App live (B3) |
| Embr ranks talent against the brief | Decision + pilot app | Yes | App live (B3) |
| 50% deposit, balance on completion, 72-hour sign-off | Decision + pilot app | Yes, as "how it will work" | B4 test bookings pass + live payments |
| 18+, ID-checked | Decision + Stripe Identity code | Yes, as "how it will work" | D2 passes against Stripe |
| Brand fee tiers | Pilot app | Only as "draft" | Luke confirms tiers |
| Any count of talent, brands, bookings | None | No | Real counts from the database |
| Testimonials, booking stories | None | No | Real pilot users, written consent |
| "Founded by a model" (campaign plan, message hierarchy) | **Unverified** | Luke to confirm | Luke confirms |

---

## 8. Two quick checks to run on any new line

1. **Agency test:** could a reader think Embr gets talent work, puts them forward, or that talent can apply? If yes, rewrite.
2. **Source test:** is every fact in it in decisions.md, the CHANGELOG or a dated research brief? If no, cut it or mark "unverified: needs measuring".

---

## 9. How "Crew" would read

Luke is weighing a word to replace "talent". Nothing changes until he chooses. Here is the same copy both ways.

| Context | With "talent" | With "Crew" |
|---|---|---|
| Brand how-it-works | Post a brief. Embr ranks the talent who fit. | Post a brief. Embr ranks the crew who fit. |
| Talent invite | Founding talent join free during the pilot. | Founding crew join free during the pilot. |
| Board | Search unsigned talent in Manchester. | Search unsigned crew in Manchester. |
| Sign-up | Join as talent / Join as a brand | Join the crew / Join as a brand |
| Profile | Talent profile | Crew profile |
| Platform | Unsigned, not unseen. | Unsigned, not unseen. (no change) |

**What Crew does well:** it covers every role at once (a model, a photographer and a stylist on one shoot are a crew), which fits multi-role profiles. It feels warmer and more like a scene than a category.

**What to watch:**
- In film and TV, "crew" usually means behind-camera roles. Models and actors may not see themselves in it. *Unverified: worth asking in the founding-talent conversations.*
- "Join the crew" can read as joining Embr's team or roster, which nudges towards the representation reading Embr avoids. Prefer "crew" as a description ("crew who fit your brief") over a membership ("our crew", "join the crew").
- "Crew who fit" reads fine; "a crew" (singular person) does not, so copy needs "crew member" for one person, which is longer than "talent".

**Suggestion:** test it before switching. Use both words in a few founding-talent conversations and the brand interviews (R5) and note which people use themselves. No cost.

---

## Sources and claims to check

- `docs/decisions.md` (read 2026-11-23): campaign lines, agency position, 0% of earnings, fee tiers, deposit, 72-hour sign-off, 18+, multi-role, founding talent free, invite-only Manchester pilot, no public teaser until a real paid booking.
- `docs/dev/CHANGELOG.md` (read 2026-11-23): multi-role profiles, model measurements, admin site; all shipped in the pilot app, tested locally, not deployed.
- Pilot app code (read 2026-11-23): role list `src/ui.js` and `supabase/migrations/20261123000002_multi_role.sql`; ranking, shortlist, quote and usage `src/views/brand.js`; booking detail and Book again `src/views/booking.js`.
- Campaign plan (provisional), https://claude.ai/artifact/CzJgtfXvCefoRdZ3AnNKHC (read 2026-11-23): audience segments, Territory A lines, message hierarchy, Burn Agency Fees assessment, CAP 3.41 and 3.32–3.34 references, "never call it escrow".
- `docs/research/`: **empty as of 2026-11-23.** No market figures are used in this pack for that reason. R4 (competitors) and R6 (CAP checklist) will feed the next revision.

Claims for Luke to approve before any public use:
1. "0% of your earnings" / "keep 100% of your fee" (pricing claim; R6).
2. Deposit, sign-off and payment wording (gated on B4 and live payments).
3. "ID-checked" (gated on D2).
4. Brand fee tiers (Luke to confirm).
5. "Founded by a model" (unverified; Luke to confirm or drop).
6. "The faces your customers actually look like" (subjective brand line; to test in E2).
7. "Is Embr an agency? No." answer (legal-adjacent; specialist opinion pending, R3).
