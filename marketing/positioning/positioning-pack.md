# Embr positioning pack: "Unsigned, not unseen"

**DRAFT: not sent, not published.** Written 2026-11-23, revised 2026-11-24 (Luke: more creative wording, marketer makes the calls) for backlog task M1. Luke reviews and approves before any line is used outside the team.

This pack is the reference every other draft (M2 invites, M3 landing, M4 posts) pulls from. It sets what Embr says, to whom, what proves it, and which claims are not allowed out yet.

**Calls made in this revision** (each explained where it appears): the people word is settled in section 9; every headline line has a recommended pick in section 4; every flagged claim has final wording in section 7.

---

## 1. Positioning in one breath

**For brands:** Embr is the UK board of unsigned models and creatives. Book today and pay the way your business already does. The people you book are paid on completion. Post a brief, Embr ranks who fits, and you choose who gets an offer. The agreement, deposit and usage terms live in one place.

**For talent:** Embr is where your bookings live. Offers, terms, usage, travel and pay in one place, and Embr takes 0% of your earnings. Let work find you.

**The platform line:** Unsigned, not unseen.

**The feeling we want:** pride in being independent. Never a dig at anyone who is signed. Signed and unsigned are both ways to work, and Embr is built for one of them.

### Positioning statement (internal, not copy)

For independent UK brands who want distinctive faces and creative talent for their own campaigns, Embr is a booking board of professional models and creatives who are unsigned. The brand searches, Embr ranks talent against the brief, and the brand makes the offer. Embr lets a brand book now and pay on its usual invoice terms, while the people booked are paid on completion, and every booking has a written agreement and agreed usage. *(Sources: decisions.md, Product and money, Agency position, Campaign; Decision (Luke, 2026-11-20 and 2026-11-23). Pilot app features: CHANGELOG 2026-11-23. The app is tested locally and is not live. Pay-later is not built: see B1.)*

The statement does not compare Embr with agencies, and it does not say talent find or get work.

---

## 2. Who we're talking to

Pilot is brand-led, invite-only, Manchester first *(Decision (Luke, 2026-11-23))*. Brands are recruited first and talent are invited to match what brands' briefs need *(campaign plan, section 3)*.

### Brands (primary)

| Segment | Who decides | What they need |
|---|---|---|
| Independent fashion and streetwear labels shooting lookbooks and drops | Founder or creative lead | A face that suits the brand, a fair day rate, usage they understand |
| Independent beauty and skincare brands | Founder or marketing lead | Content for product pages and social, with clear usage terms |
| Photographers and small studios booking for a client | The photographer | A reliable person, a shortlist the client can see, travel sorted |

Segments come from the campaign plan (section 3). Why they would switch is a **hypothesis to test in the brand interviews (R5)**, not a finding.

### Talent (invited to match brand demand)

| Segment | What they care about |
|---|---|
| Working unsigned models who already take bookings from Instagram enquiries | Moving DM enquiries onto a proper booking with the booking link |
| Models who have left representation | A clear, written booking and on-time pay |
| New faces with a professional portfolio | A professional profile and safety tools |
| Creatives: UGC creators, actors, content creators, photographers, videographers, make-up artists, stylists | One profile for every role they do |

Roles are the eight in the app: Model, UGC creator, Actor, Content creator, Photographer, Videographer, Make-up artist, Stylist *(src/ui.js `CATS`; supabase/migrations/20261123000002_multi_role.sql)*. Talent must be 18+ *(decisions.md, Agency position)*.

---

## 3. Messaging house

```
                       UNSIGNED, NOT UNSEEN
        Independent on both sides of the shoot. Booked properly.

  BRANDS                                   TALENT
  "Distinctive faces. Independent        "Let work find you."
   talent. Booked directly."

  B1  Book today, pay your way             T1  Your bookings, in one place
  B2  Independent faces                    T2  0% of your earnings
  B3  Embr ranks. You choose.              T3  One profile, every role
  B4  Booked properly                      T4  Safety tools you can see

  Foundations: UK, invite-only, Manchester first · premium and independent ·
  never agency-like · every claim sourced
```

### Brand pillars

**B1. Book today, pay your way.** *(lead brand pillar; working name "Book now, pay later")*
Book the shoot today. Pay on the invoice terms your business already runs on. The people you book are paid on completion.
- Why it leads: it lets a brand organise shoots without breaking its usual invoicing cycle, and the creatives are still paid on completion *(Decision (Luke, 2026-11-23))*. Luke earlier set out brands paying later through a plugged-in B2B pay-later provider *(imported project memory, areas/embr.md)*.
- **Not built.** The pilot app takes a 50% deposit by card and the balance at sign-off *(README.md, "What's in it"; decisions.md, Product and money)*. There is no pay-later option in the code (checked 2026-11-23).
- Open before it can be offered: which provider funds it and on what terms, whether that provider works with an unincorporated or newly incorporated company, what it costs (zero-cash budget), and how it fits the 50% deposit rule. **Unverified: needs research (R7).**
- Wording: "paid on completion" or "paid when the booking is signed off". Sign-off is automatic 72 hours after wrap *(decisions.md)*. Payout timing depends on Stripe and is unconfirmed *(campaign plan, section 2)*.
- Gated: no public or 1:1 promise of pay-later terms until the app supports it and the funding is in place (D5 and R7).

**B2. Independent faces.**
Unsigned models and creatives on one board. Models, UGC creators, actors, photographers and more, so a small shoot can be booked from one place.
- Proof: multi-role profiles, live only when every role's portfolio is filled *(Decision (Luke, 2026-11-23); CHANGELOG 2026-11-23)*. The Model role carries full comp-card measurements and briefs filter on them *(CHANGELOG 2026-11-23, migration 3)*.
- Not yet: any number of talent on the board, or "local" claims. **Unverified: needs measuring** once the pilot opens.

**B3. Embr ranks. You choose.**
Post a brief with a date, place, budget and usage. Embr ranks the talent who fit it. You decide who gets an offer.
- Proof: brands search the board and Embr ranks talent against the brief *(decisions.md, Agency position, 2026-11-20)*. Best-fit ranking is built in the pilot app *(src/views/brand.js)*.
- Don't say "the best talent", "perfect match" or "we find them for you". Embr ranks; the brand picks.

**B4. Booked properly.**
One fee, shown before you book. A 50% deposit by card, held through Stripe. The balance on completion. Usage agreed in writing.
- Proof: *decisions.md, Product and money*. Quote, deposit and usage fields are built *(src/views/brand.js, src/views/booking.js)*.
- Gated: payment and sign-off claims stay private until test-mode bookings pass (B4) and payments run live. Never say "escrow" *(campaign plan, section 2)*.

### Talent pillars

Talent copy describes tools. It never says or implies that Embr gets anyone work (CLAUDE.md, hard rule 2).

**T1. Your bookings, in one place.**
Offers, terms, call times, usage, travel and messages for every booking, in one app.
- Proof: booking view shows where, call time, usage and agreed content *(src/views/booking.js)*. Brands can book talent from other cities with travel paid by the brand *(src/views/brand.js)*.

**T2. 0% of your earnings.**
Talent get 100% of the fee. Embr's fee is charged to the brand.
- Proof: *decisions.md, Agency position and Product and money*. The app already says it: "Embr takes 0% of your fee" *(src/views/auth.js)*.
- **Pricing claim: Luke's decision, still needs the R6 CAP check before public use.** When the paid membership arrives, any page with "0% of your earnings" shows the membership price plainly too. "Let work find you" stays away from that price *(decisions.md; campaign plan, Territory B risks)*.

**T3. One profile, every role.**
Pick every role you do. Each gets its own portfolio section. Your Book-me page and booking link turn an Instagram enquiry into a proper Embr booking.
- Proof: multi-role profiles *(Decision (Luke, 2026-11-23))*; booking link and Book-me page `/@name` *(decisions.md, Product and money)*.

**T4. Safety tools you can see.**
18+ only. A written agreement on every booking. Messages stay on the booking.
- Proof: 18+ rule *(decisions.md)*; agreement and booking-only messages *(src/views/booking.js)*.
- The ID check through Stripe Identity *(CLAUDE.md, Tech stack)* is added to this pillar only once it runs live (D2).

**Talent proof point: Founded by a model.** Approved *(Decision (Luke, 2026-11-23))*. Describe safety as tools Embr provides, never as protection or representation *(campaign plan, section 2: Luke, 2026-11-17)*.

---

## 4. Lines ready for review

Status key: **Approved** = locked by Luke. **Recommended** = my pick, for Luke to approve. **Option** = a strong alternative. **Gated** = can't go public until the named step is done.

Craft rules used: short sentences, concrete nouns, independence as a source of pride, no contrast with anyone signed, nothing that reads as "Embr gets you work".

### Locked

| Line | Use | Status |
|---|---|---|
| Unsigned, not unseen. | Platform, every channel | Approved (Luke, 2026-11-23) |
| Let work find you. | Talent product line. Never next to a price | Approved (Luke, 2026-11-20) |

### Promise line (sits under "Unsigned, not unseen.")

| Option | Reason |
|---|---|
| **Independent on both sides of the shoot. Booked properly.** (Recommended) | Gives pride to both brand and talent in one breath, and "booked properly" carries the agreement, deposit and usage promise without a comparison. |
| Independent talent and independent brands, booked properly. | Plain and safe. Fallback if "shoot" feels narrow for UGC and content work. |
| Proudly independent. Properly booked. | Shortest. Good for a caption or bio, thinner as a promise. |

### Brand hook

Luke rejected "Faces that look like your customers" on 2026-11-24: it made unsigned talent sound common. Unsigned is a status, not a level. These are professional models and creatives who happen to be independent. Every option below presents them as professional, distinctive and bookable, with no comparison and no number.

| Option | Reason |
|---|---|
| **Distinctive faces. Independent talent. Booked directly.** (Recommended) | Leads with what a brand wants (a distinctive face), makes independence the proud word, and ends on a plain fact. No comparison with anyone. |
| Models with a point of view. Booked directly. | Gives the talent character and authorship. Best for fashion and beauty. |
| Independent talent, ready to book. | Calm and professional. Good for a button or a bio. |
| Unsigned models and creatives. Booked by you. | Says the status and the brand's control in one line. Plain, less poetic. |
| Faces with their own point of view. | Short and warm. Less clear that they are bookable. |
| The distinctive faces your brand has been looking for. | Brand-centred and aspirational. Longer, and a little generic. |
| Professional talent. Independent by choice. | Pride in independence. "By choice" is true for some, not all, so use with care. |
| Independent talent. Your brief. | Tight and confident. Needs the line above it for context. |

"Distinctive" is a description of talent, not a claim about numbers or quality against others. Keep it as a style word, not a promise. The hook is a hypothesis to test in E2 and the brand interviews (R5).

### Brand benefit: book now, pay later (all gated: not built, no funding provider)

| Option | Reason |
|---|---|
| **Book today. Pay the way your business already does.** (Recommended) | Says the benefit in brand terms, makes no claim about days or lenders, and avoids the credit-sounding "pay later" in the headline. |
| Book now, pay later. | Luke's working name. Clearest, but "pay later" can read as consumer credit. Keep for internal use and 1:1 conversations once it exists. |
| Shoot on your schedule. Settle on your terms. | Warm, but vague about money. |

Support line with it: **"The people you book are paid on completion."** Never "instantly".

### Brand how-it-works

| Option | Reason |
|---|---|
| **Post a brief. Embr ranks who fits. You choose.** (Recommended) | Three beats, mirrors the product, keeps the choice with the brand. |
| Say what you need. We rank who fits. You make the offer. | More conversational. "We" is fine in brand voice, but keep "Embr ranks" in anything formal. |

### Talent lines (tools only, never "work")

| Option | Reason |
|---|---|
| **Your name. Your bookings. All in one place.** (Recommended) | Puts independence first ("your name") and describes a tool. |
| Independent is a choice. Embr makes the paperwork easy. | Pride plus use. "Paperwork" sells the agreement, not a job. |
| Every enquiry, a proper booking. | Speaks to Instagram DMs becoming Embr bookings. Good for the booking-link message. |
| Keep your name. Keep your fee. | Strong, but "keep your fee" is a pricing claim: gated like T2. |

### Talent proof point

**0% of your earnings.** *(Pricing claim. Needs R6 CAP check and Luke's approval. Never beside "Let work find you" plus a membership price.)*

### Brand copy (short and long)

- **Short (recommended):** Unsigned, not unseen. Distinctive faces. Independent talent. Booked directly. Post a brief, see who fits, make the offer. Book today and pay the way your business already does. *(Pay-later sentence gated.)*
- **Short, safe version (no pay-later):** Unsigned, not unseen. Distinctive faces. Independent talent. Booked directly. Post a brief, see who fits, make the offer. One fee, shown before you book.
- **Long:** Embr is a board of unsigned models and creatives in the UK, starting in Manchester. Post a brief with your date, place, budget and usage. Embr ranks the talent who fit, and you choose who gets an offer. The agreement, the deposit and the usage terms sit in one place, and you see the fee before you book. Book today and pay the way your business already does, while the people you book are paid on completion. *(Fee and deposit wording gated on B4. Pay-later gated on D5 and R7.)*

### Talent copy (short and long)

- **Short (recommended):** Unsigned, not unseen. Your name. Your bookings. All in one place. Let work find you.
- **With pricing (gated, no "Let work find you" here):** Your bookings, terms and usage in one place. 0% of your earnings.
- **Long:** Embr is built for unsigned models and creatives. Make one profile for every role you do. When a brand books you, the offer, agreement, usage, travel and pay are in one place, and Embr takes 0% of your earnings. Got an enquiry on Instagram? Send your Embr booking link and it becomes a proper booking. Let work find you. *(0% sentence gated on R6. If a membership price is shown on the same page, drop "Let work find you" from that page.)*
- **Invite framing (pilot):** "Founding talent join free during the pilot" *(decisions.md, Campaign)*. Never pair a founding invite with "Let work find you" and a price.

### Boilerplate (for press drafts, not for release yet)

> Embr is a UK booking app where independent brands book unsigned models and creatives directly. Brands post a brief, Embr ranks the talent who fit, and the brand chooses who to book. Talent keep 100% of their fee. Embr is running an invite-only pilot in Manchester. Founded by a model.

Gated: Embr must be incorporated before public use (trading details), the pilot must be open, and "Talent keep 100% of their fee" needs R6 *(decisions.md, Company; Campaign: no public teaser until the app can take a real paid booking)*.

---

## 5. Words to use and words to avoid

| Use | Avoid (and why) |
|---|---|
| booked, bookings, your bookings | find work, get work, jobs for you, apply, browse jobs (agency reading, hard rule 2) |
| brands make offers | talent pitch, talent message brands (talent can't, decisions.md) |
| Embr ranks talent against the brief | we match you, we put you forward, we represent (agency reading) |
| board, profile, Book-me page | roster, "our models", "our talent" (sounds like representation) |
| independent, unsigned, new faces, professional, distinctive | "better than an agency", "cheaper", "Burn Agency Fees" (CAP 3.41 denigration; no like-for-like evidence; decisions.md) |
| deposit held through Stripe | escrow, guaranteed pay, paid in X days, paid instantly (until live and confirmed) |
| unsigned as a status ("professional models who are unsigned") | "faces that look like your customers", "the faces your customers actually look like" (rejected by Luke, 2026-11-24: it belittles unsigned talent and makes them sound common); "real people", "everyday", "ordinary", "relatable", "amateur", "emerging" or any wording that makes unsigned a lower level |
| paid on completion, paid on sign-off | instantly (payout timing unconfirmed) |
| safety tools, 18+ | protected, vetted, safe guaranteed |
| fee shown before you book | no fees (brands do pay a fee) |
| talent, creative(s) (see section 9) | crew (Luke, 2026-11-24) |

**Tone:** UK English, short sentences, warm, confident, premium. Pride in independence, never a dig at anyone signed.

---

## 6. Objections and answers

For 1:1 conversations and the FAQ draft (M3). Each answer uses only decided or built facts.

| Objection | Answer |
|---|---|
| Talent: "How do I get booked on Embr?" | "Brands search the board and post briefs. Embr ranks profiles against each brief, and brands send offers. Keep your profile full and your dates up to date." (No promise of bookings.) |
| Talent: "What does it cost?" | "Founding talent are free during the pilot, and Embr never takes a cut of your fee." (Membership price not set; don't quote one.) |
| Talent: "Is it safe?" | "Embr is for people aged 18 and over, every booking has a written agreement, and the brand pays a deposit before the shoot." Add the ID check once D2 is live. |
| Talent: "I already get enquiries on Instagram." | "Keep them. Send your Embr booking link and the enquiry becomes a proper booking with agreed terms and a deposit." |
| Talent: "I'm signed. Is this for me?" | "Embr is built for unsigned people. If your situation changes, it's here." (Never imply signed talent are doing anything wrong.) |
| Brand: "Why not just DM models?" | "You can. Embr puts the agreement, deposit and usage in one place and shows you who fits your brief." (Don't criticise DMs or agencies.) |
| Brand: "We pay suppliers on 30 or 60 days. Can we still use it?" | Once built: "Yes. Book today and pay on your usual terms; the people you book are paid on completion." Until then: "That's something we're building. Today it's a 50% deposit and the balance at sign-off." Don't quote any number of days. |
| Brand: "What does it cost?" | "A booking fee on top of the talent's fee, shown before you book." Tiers (10%, 7%, 5%) are in the pilot app and still need Luke's confirmation *(decisions.md)*. Don't quote them. |
| Anyone: "Is Embr an agency?" | "No. Embr is a booking app. Brands choose who to book, and Embr doesn't represent anyone." (Keep it that short. Specialist opinion pending, R3.) |

---

## 7. Proof-point readiness and final wording

| Claim | Final wording (my call) | Source | Private 1:1 now? | Public when |
|---|---|---|---|---|
| 0% of your earnings | "Embr takes 0% of your earnings." Follow with "The brand pays Embr's fee." One sentence, no stacking with other claims. | Decision (Luke, 2026-11-20); app copy in `src/views/auth.js` | Yes | Luke approves + R6 CAP check. Membership price shown beside it once it exists |
| Deposit, balance, sign-off | "A 50% deposit by card, held through Stripe. The balance on completion. Signed off automatically 72 hours after wrap, unless a problem is reported." The "unless" is in the app (`src/views/brand.js`) so we say it. | decisions.md, Product and money | Yes, as "how it will work" | B4 test bookings pass + live payments |
| 18+ and ID check | Public: "Embr is for people aged 18 and over." Add "with an ID check through Stripe Identity" only when D2 passes. Never "vetted" or "verified safe". | decisions.md; CLAUDE.md, Tech stack | Yes, as "how it will work" | 18+ line at pilot open; ID check after D2 |
| Brand fee tiers | Public copy never quotes percentages. Say "One fee, shown before you book." Numbers live in the app, where the brand sees its own fee. My call: no tier numbers in marketing even after Luke confirms, so a change doesn't date the copy. | decisions.md (tiers need confirmation) | Only as "draft" | Luke confirms tiers (app only); marketing line is free to use at pilot open |
| Brand hook | "Distinctive faces. Independent talent. Booked directly." Describes the talent, makes no comparison or number. Test in E2. | Marketer wording, Luke to approve | Yes | Pilot open |
| "Is Embr an agency?" | "No. Embr is a booking app. Brands choose who to book, and Embr doesn't represent anyone." | decisions.md, Agency position; `src/views/brand.js` already says "Embr is not an agency." | Yes, short | After specialist opinion (R3) |
| Book now, pay later; talent paid on completion | "Book today. Pay the way your business already does. The people you book are paid on completion." Never "instantly", never "escrow". | Decision (Luke, 2026-11-23); **not in the app** | No, only as "we're building it" | D5 built and tested **and** R7 funding provider in place |

Already clear:

| Claim | Source | Private 1:1 now? | Public when |
|---|---|---|---|
| Unsigned, not unseen / Let work find you | Decisions | Yes | Pilot open |
| Multi-role profiles, Book-me page, booking link | Decision + pilot app | Yes, "in the pilot app" | App live (B3) |
| Embr ranks talent against the brief | Decision + pilot app | Yes | App live (B3) |
| "Founded by a model" | Decision (Luke, 2026-11-23) | Yes | Use with pilot copy |
| Any count of talent, brands, bookings, or "local" | None | No | Real counts from the database |
| Testimonials, booking stories | None | No | Real pilot users, written consent |

---

## 8. Three quick checks to run on any new line

1. **Agency test:** could a reader think Embr gets talent work, puts them forward, or that talent can apply? If yes, rewrite.
2. **Source test:** is every fact in decisions.md, the CHANGELOG, the code or a dated research brief? If no, cut it or mark "unverified: needs measuring".
3. **Respect test:** (a) does the line get its energy by making someone else look worse? If yes, rewrite. (b) Would an unsigned model feel proud reading it? Does it treat unsigned as a status, not a level, and avoid "common", "everyday", "real people" or "relatable"? If not, rewrite.

---

## 9. Decision: "talent" and "creative"

**Decision (marketer, 2026-11-24, for Luke to confirm):** keep **talent** as the system word. Use **creatives** (and "models and creatives") as the warm public word for the people themselves. A deliberate split, with one rule:

- **"Talent"** names the role, the board and the product: "I'm talent", "talent profile", "Search talent", "Founding talent join free". Short, one word, works for a single person.
- **"Creatives"** (plural) and **"models and creatives"** name the people in headline and story copy: "unsigned models and creatives". It is already how the app describes itself.
- A single person is "a model", "a photographer" or "a creative", by their role. Never "a talent".
- Never possessive: not "our talent", "our creatives", "our models". That reads as a roster.

**Evidence**

| Evidence | What it shows | Source |
|---|---|---|
| The app already says "talent" everywhere | 338 mentions in `supabase/migrations/` and 131 in `src/views/` (counted with grep, 2026-11-24); table and role names are `talent`. "Creative" appears 0 times in migrations. | `grep -ri` over `supabase/migrations/`, `src/views/` |
| The app's public sentence already uses the split | "Brands book models and creatives directly... Talent keep everything they earn" | `src/views/auth.js` line 18; `index.html` meta description |
| Sign-up buttons | "I'm talent" and "I'm a brand" | `src/views/auth.js` lines 20, 99 |
| Eight roles, not all "creatives" | Model, Actor, UGC creator, Content creator, Photographer, Videographer, Make-up artist, Stylist. "Creative" alone can feel like it excludes models and actors; "talent" alone can feel like it excludes photographers and stylists. The pair covers all eight. | `src/ui.js` `CATS` |
| Comparable platforms use "talent" for the people hired | Spotlight (UK) speaks to performers as talent and to casting directors and agents as hirers; Backstage's own page calls the people hired "talent" and also says "creatives" | https://www.spotlight.com (checked 2026-11-24); https://www.backstage.com/discover/on-brand-talent-all-in-one-place-75446/ (checked 2026-11-24) |
| Others prefer "freelancers" or "experts" | Twine's main labels are "freelancer" and "expert" | https://www.twine.net/blog/best-platforms-for-hiring-freelance-creatives (checked 2026-11-24). Not used: it reads like a generic freelance site, not a booking board for faces |
| StarNow and a UK model directory | Could not be fetched on 2026-11-24 (page text and robots.txt blocked) | **Unverified: needs measuring** |
| Brand readability | Brand briefs and rankings already say "talent" in the app. Whether brands prefer "talent" or "creatives" in a headline is a hypothesis | **Unverified: needs measuring** in the brand interviews (R5) |
| Agency-law reading | "Talent" alone doesn't imply representation. The risk comes from possessives and rosters ("our talent", "join our roster"), which stay on the avoid list. Specialist view pending (R3). | decisions.md, Agency position; CLAUDE.md, hard rule 2 |

**Why not one word.** "Talent" everywhere sounds like a casting trade term and is cold in headlines. "Creative" everywhere is warm but is a weak label for a model, an actor, or a single person, and would force a rename of every table, string and migration for no proven gain. The split keeps the code as it is and gives the copy warmth.

**What the app's UI would need (not changed, for Luke to decide).** Nothing is required. Optional later: the sign-up button "I'm talent" (`src/views/auth.js` line 20 and 99) could become "I'm a model or creative"; the brand-side "Find and book talent" can stay. Table and column names stay as they are.

**Test:** in the founding-talent chats and brand interviews (R5), note the word people use about themselves. No cost.

---

## Sources and claims to check

- `docs/decisions.md` (read 2026-11-24): campaign lines, agency position, 0% of earnings, fee tiers, deposit, 72-hour sign-off, 18+, multi-role, founding talent free, "Founded by a model", invite-only Manchester pilot, no public teaser until a real paid booking.
- `docs/dev/CHANGELOG.md` (read 2026-11-23): multi-role profiles, model measurements, admin site; shipped in the pilot app, tested locally, not deployed.
- Pilot app code (read 2026-11-24): role list `src/ui.js` `CATS`; migration `supabase/migrations/20261123000002_multi_role.sql`; ranking, quote and usage `src/views/brand.js` (including "unless a problem is reported" and "Embr is not an agency"); booking detail `src/views/booking.js`; sign-up and "0% of your fee" `src/views/auth.js`; `index.html` meta description.
- Word counts for "talent" and "creative" came from grep over `supabase/migrations/` and `src/` on 2026-11-24.
- Campaign plan (provisional), https://claude.ai/artifact/CzJgtfXvCefoRdZ3AnNKHC (read 2026-11-23): segments, Territory A (its hook line is rejected, see section 5), message hierarchy, Burn Agency Fees assessment, CAP 3.41 and 3.32 to 3.34, "never call it escrow".
- Spotlight, https://www.spotlight.com (checked 2026-11-24). Backstage, https://www.backstage.com/discover/on-brand-talent-all-in-one-place-75446/ (checked 2026-11-24). Twine, https://www.twine.net/blog/best-platforms-for-hiring-freelance-creatives (checked 2026-11-24). Used only for how they word their audiences.
- `docs/research/`: empty as of 2026-11-24, so no market figures appear in this pack. R4 and R6 feed the next revision.
- `README.md` and app code (checked 2026-11-23): no pay-later or invoice-terms payment in the pilot app.
- Imported project memory `areas/embr.md`: Luke's earlier note on brand pay-later through a plugged-in B2B provider.

Claims for Luke to approve before any public use (final wording in section 7):
1. "0% of your earnings" (pricing claim; Luke's decision; R6 CAP check pending).
2. Deposit, balance and sign-off wording (gated on B4 and live payments).
3. "ID check" wording (gated on D2; 18+ line can go earlier).
4. Brand fee tiers (Luke to confirm; no percentages in marketing copy).
5. Brand hook "Distinctive faces. Independent talent. Booked directly." ("distinctive" is a style word, not a comparison; test in E2). The earlier hook was rejected by Luke, 2026-11-24.
6. "Is Embr an agency? No." (legal-adjacent; R3 pending).
7. "Book today. Pay the way your business already does. The people you book are paid on completion." (gated on D5 and R7; never "instantly" or "escrow").
- Approved: "Founded by a model" (Decision (Luke, 2026-11-23)).
- For Luke to confirm: the talent/creative split in section 9, and the recommended picks in section 4.
