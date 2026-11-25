# Talent engagement: making the talent Today screen worth opening

Status: DRAFT design decision, 2026-11-25. Written by the marketer agent for the developer. Nothing here is built. No app code was changed.

Brief from Luke: once setup is done, the talent app is boring. Make it more engaging, using Mobbin and the agents, and decide rather than send options back.

## 0. The call on showing briefs (read this first)

Decision: talent never see individual briefs, not even anonymised ones. They see only past-tense, whole-pilot aggregate counts ("3 briefs posted this week"), with no titles, brand names, rates, dates, spots, or any link or button to act on them.

Why. `docs/decisions.md` (Agency position, Luke, 2026-11-20) says talent cannot apply for jobs or message brands about jobs, brands search the board, and Embr ranks talent against the brief. A list of live briefs, even view-only, gives talent something to look at and want, and the next thing they want is a way to respond. That is the shape of a jobs board, and it would weaken the Equity v Talent Systems defence the decision leans on. Aggregate counts of past activity are market information, like a host seeing demand in their area. They carry no route to pursue anything, they cannot be matched to a brief, and they do not read as vacancies. Brand names and talent names are also withheld so that talent are not tempted to contact a brand on Instagram to chase work off-platform, which would undercut both the agency rule and Embr's booking flow. "Brands make the first move" is stated on the panel itself.

Open for Luke (flag, not a blocker for the build): this framing and the brand-view counting in feature 1 should be mentioned when the BPP Legal Advice Clinic reviews the agreement (Decision, Luke, 2026-11-24).

## 1. What I studied

All screens are iOS, from Mobbin. Searches run 2026-11-25. Uber driver earnings returned no results, so nothing is claimed about it. Upwork and Vinted were not searched.

| App | Pattern | Link | Why it fits Embr |
|---|---|---|---|
| Fiverr (seller) | Home with a scorecard: level, rating, response rate, orders and earnings each shown as "x / target" with a progress bar; then To-Dos, then "My gigs" last-7-days stats (impressions, clicks, conversion) with up/down arrows | [home](https://mobbin.com/screens/00b6daa3-72b9-48bd-900c-32b17058bb8b), [earnings, to-dos, stats](https://mobbin.com/screens/fc807bd4-3a05-44a1-b5dd-62fcdb6efcfd) | A seven-day stats strip with a direction arrow gives sellers a reason to return. We take the strip. We do not take levels, targets or response rate: they push sellers to chase, and Embr talent do not respond to jobs. |
| Fiverr | "New Briefs" card ("No new briefs. Explore high-potential projects...") | [home, empty](https://mobbin.com/screens/51435e24-2522-477a-94d0-7f784f91e3a4) | This is the exact jobs-board pattern. Studied and rejected (section 3). |
| Fiverr | Dismissible green banner "Set up your seller profile" | [banner](https://mobbin.com/screens/b61cf1a4-5e11-43ba-b851-1a223505bdd6) | One clear next step on the home screen. We already have this as `readyPanel`; we extend it past "ready". |
| Airbnb (host) | Insights > Stats: rating, response rate, earnings, 30-day views, 30-day bookings in one block; "Tips" section that says "You're all set for now! Check back for more tips" | [stats](https://mobbin.com/screens/ec1e902b-2557-4657-913c-9d29c531a542) | "Views" is the supply-side number that moves before money does. The "all set, check back" tip is a good calm empty state. |
| Airbnb (host) | Earnings: "You've made £0.00 this month" over a six-month bar chart, then a payout prompt card | [earnings](https://mobbin.com/screens/31c6f0ae-6f71-4866-a25d-25a930e3550f), [payout prompt](https://mobbin.com/screens/38a4bdf6-3733-4ec9-8276-819f864bc5dc) | Embr's earnings hero has no history. A six-month bar view makes a zero month still look like a place that will fill. |
| Airbnb (host) | Today tab with an empty state and a sticky card "Confirm a few key details, required to publish" | [today, empty](https://mobbin.com/screens/8249f9ca-1fdc-4f97-870f-974d6811a36c), [listings](https://mobbin.com/screens/e1d8aa60-cf3f-481a-922b-24afaed2cac9) | Shows what Luke is feeling: a bare Today is dead. The sticky "finish this" card is the part worth copying. |
| Depop (seller) | Shop header strip "earned, last 30 days / potential revenue", above the listings | [shop](https://mobbin.com/screens/2cf32147-3d07-4b1e-beb5-f5b255c194a0), [empty](https://mobbin.com/screens/594bcee4-b958-4169-989e-e7503ac93d3f) | A two-figure strip pinned above the work. We use a compact stats row instead of "potential revenue", which would be a forecast and we may not estimate. |
| Strava | Weekly goal ring and a week row of days; "Your streak: 1 Weeks" | [widgets](https://mobbin.com/screens/1c996718-ab94-4247-85b3-80885bab44c9), [progress](https://mobbin.com/screens/02f8ff4a-0d9d-492b-8be8-08fb9e9fe486) | Streaks counted in weeks, not days, are gentle. We borrow the weekly rhythm for a dates check-in, with no streak and no loss. |
| Duolingo | Streak screen: "Less than 3 hours to extend your 5 day streak!", freezes, milestone markers | [streak at risk](https://mobbin.com/screens/1755644a-3b98-4a8e-906f-0ef606e166eb), [calendar](https://mobbin.com/screens/b7578a37-b5f0-4921-a9c2-3b42bad94eb9) | Loss-aversion streaks work, but they would patronise professionals. We take only the milestone marker idea (celebrate firsts). |

Take-away across the set: the apps that hold sellers have (a) one number that moves before money does (views, impressions), (b) one clear next step, (c) a money history, and (d) a calm "all set" state. Embr's Today has only (c) in a thin form.

## 2. Decisions: six features, ranked

Placement summary is in section 5. Zero-state rule for all of them: with five users most numbers will be 0 or 1, so every tile has a written zero state, and the screen never shows an empty box.

Wording rules applied throughout: no "find work", "apply", "jobs for you" or "join to get work". "Let work find you" appears once, on the This week panel, nowhere near pricing. Talent are professionals. No agency comparisons.

### 1. "Seen and saved" stats row (the main fix)

- What talent see: three tiles directly under the earnings card.
  - Tile 1: label "Seen by brands", figure = number of different brands who opened their profile in the last 7 days, sub-line "this week". If last week had any: "{n} last week".
  - Tile 2: label "Saved by brands", figure = brands who currently have them saved, sub-line "{k} new this week" when k > 0, otherwise "in total".
  - Tile 3: label "Offers", figure = offers ever received, sub-line "on Embr".
  - Footnote under the row, small: "You see how many brands, never which. Brands make the first move."
- Zero states:
  - Profile not live (`published = false`): Tile 1 and 2 read "Not live yet", sub-line "Goes live when your profile is complete", and tapping goes to the strength card. This turns a dead state into the strongest nudge.
  - Live with 0 views: figure 0, sub-line "None yet this week".
  - Offers 0: figure 0, sub-line "Brands book you from your profile".
- Data source: new table `profile_views` written by `talent_detail` (volatile, brand viewers only); new function `talent_pulse()` (section 5). Saves come from the existing `shortlist` table.
- Privacy: brand identity is never returned to talent, here or anywhere. Reason: showing which brand viewed invites talent to chase that brand off-platform (agency rule) and exposes brands' browsing. Counts are distinct brands, one per brand per day, so refreshing does not inflate them. Views by `ops` and by the talent themselves are not logged. The public `/@handle` page is not logged (anonymous visitors, out of scope). Brands should be told once that talent see counts, never names. Flag for Luke: that line is public brand-facing copy and a UK GDPR privacy-notice item.
- Source of claim: all figures are Embr's own rows. No benchmarks.

### 2. Profile strength with one next step

- What talent see: replaces the long checklist look of `readyPanel` once the four "ready" gates are done. Before that, `readyPanel` stays as is.
  - Title "Profile strength", figure "{score}%", a bar, then "Next: {step}" with one button, and up to two further steps as plain text lines.
  - At 100%: a single green "Profile complete" chip and the line "You're all set for now. Check back as bookings come in."
- Scoring (a product score, not a statistic, never presented as one): 60 points for the four existing gates (name, rate and Book-me name; every role section; ID check; payouts), shared equally, plus 40 for polish:
  - 6 or more photos in total: 10
  - bio of 80 characters or more: 8
  - 3 or more tags: 5
  - content comfort note filled in: 4
  - Instagram or TikTok added: 4
  - half-day rate set: 3
  - dates confirmed in the last 14 days (feature 4): 6
- Exact step copy:
  - "Add more photos. Six or more shows your range."
  - "Write a bio in your own words. Two or three sentences is plenty."
  - "Add three tags that describe your style."
  - "Say what content you're comfortable with, so brands know before they book."
  - "Add your Instagram or TikTok."
  - "Add a half-day rate."
  - "Confirm your dates are up to date."
- Do not write that a stronger profile gets more bookings or ranks higher. That is unverified and ranking is Embr's internal matter.
- Data source: computed in the browser from `S.me.talent` (photos, gaps, bio, tags, comfort, instagram, half_rate, verified, payouts_enabled) plus `dates_confirmed_at` from `talent_pulse()`. No new SQL. Keep it as one pure function so it can be tested.
- Privacy: none; talent's own data.

### 3. "This week on Embr" (anonymised activity)

- What talent see: a panel at the top of the right-hand column (below the main column on a phone, after Coming up).
  - Heading "This week on Embr". Up to four lines, each shown only if its count is above 0:
    - "{n} brief(s) posted by brands" (with "in Manchester" when the talent's city alone has 3 or more, otherwise "across the UK")
    - "{n} booking(s) confirmed"
    - "{n} new brand(s) joined"
    - Category line for the talent's own roles only, and only when the count is 2 or more: "{n} brief(s) asked for {role plural}", for example "2 briefs asked for UGC creators".
  - Footer, small: "Anonymised totals from Embr. Let work find you: brands make the first move, so there is nothing to apply for."
- Fallbacks so it is never empty:
  - Whole week below 3 events in total: do not show weekly numbers (small numbers could single out one brand or booking). Show lifetime lines instead: "Since the pilot began: {n} briefs posted, {m} bookings confirmed, {k} brands joined" (each only if above 0).
  - Lifetime all zero: "Brands are being invited in now. Activity will appear here as it happens."
- Data source: new function `embr_pulse()` (section 5), built from `briefs`, `bookings`/`booking_events`, `brands`.
- Privacy and agency notes: aggregates only; no per-event rows, no times, no ids, no brand or talent names, no rates, no dates, no spots. This is the deliberate answer to Luke's "ticker" idea: it reads as a ticker (short lines about what is happening) but is week-level, so it cannot identify anyone and cannot read as vacancies. No click-through of any kind from this panel.

### 4. Dates check-in (the weekly habit)

- What talent see: a panel in the right column, above Book-me.
  - "Your dates" and the line "Last confirmed {n} days ago." with button "Confirm my dates". Never confirmed: "Brands only see you for dates you're free. Check yours now." After tapping: "Confirmed today." and a toast "Dates confirmed".
  - Shown only when the profile is live. Not shown as red or overdue at any point. No streak, no counter of missed weeks (Duolingo's loss pressure was rejected for professionals).
- Why it works: one tap, a weekly rhythm (Strava weeks), and it is useful: brands are only shown people who are free, so correct dates matter. It feeds 6 points of strength.
- Data source: new column `talents.dates_confirmed_at`; new function `confirm_dates()`. Calendar editing already exists (`toggle_off_day`).
- Privacy: talent's own data. Phase 2 (not in this build, would be brand-visible and needs Luke's sign-off): a small "Dates confirmed this week" mark on the brand card.

### 5. Milestones row

- What talent see: a horizontal row of small chips at the bottom of the main column, titled "Your Embr so far". Done chips are filled with the date shown for the first only if available; not-yet chips are outlined and calm. Chips, in order:
  - "Profile live" (`published`)
  - "First brand view" (`views_total > 0`)
  - "First save" (`saves_total > 0`)
  - "First offer" (`offers_total > 0`)
  - "First booking paid" (`bookings_completed > 0`)
- Why: the early firsts are the ones likely to happen with five users, and they give a reason to return. This is Duolingo's milestone marker without the streak.
- Data source: fields already returned by `talent_pulse()`. No new SQL.
- Privacy: talent's own data.

### 6. Earnings, six months

- What talent see: under the earnings hero, a six-column bar view "Last 6 months", one bar per month of money paid to them, with the figure on each non-zero bar, and "Earned on Embr this year: {gbp}" beneath. Zero state: flat bars and the line "Paid when the brand signs off. 0% commission."
- Data source: existing `my_bookings` (completed bookings, `talent_fee_p`, month of `updated_at`, same basis as the current hero). No new SQL. Plain CSS bars, no chart library.
- Claim check: "0% commission" is Decision (Luke, 2026-11-20, "0% of your earnings"). It is an earnings claim in public-facing copy, so it needs Luke's approval before release. The in-app line already exists on the hero.
- Privacy: talent's own data.

## 3. What I rejected, and why

| Idea | Decision | Reason |
|---|---|---|
| List of posted briefs, even anonymised (title, date, rate) | Rejected | Reads as a jobs board and invites the "how do I respond" step. Agency rule (Luke, 2026-11-20). Fiverr's "New Briefs" card is the pattern we are avoiding. |
| "Interested" or "Notify me" button on any activity | Rejected | An express-interest route is the same as applying. |
| Naming the brand that viewed or saved a profile | Rejected | Invites off-platform chasing, exposes brand browsing, and breaks "brands make the first move". |
| Naming brands that joined, or talent who were booked | Rejected | Same reasons, plus identifying a talent or brand in a five-person pilot. |
| Per-event ticker rows with times | Rejected | Re-identifies people at pilot scale. Replaced by weekly aggregate lines. |
| "Jobs matched for you" or "briefs that fit you" feed | Rejected | Banned phrasing and mechanism. Embr ranks talent for brands, not briefs for talent. |
| Fiverr-style levels, targets and response rate | Rejected | Implies Embr grades talent and rewards chasing. Also needs thresholds we cannot source. |
| Daily streaks, "streak at risk" alerts | Rejected | Patronising for professionals. A weekly, loss-free dates check-in instead. |
| Leaderboards or "top talent this week" | Rejected | Comparative, discouraging with small numbers, and exposes other talent. |
| "Average day rate for your role" benchmark | Rejected for the pilot | With a handful of profiles the figure would mislead. Revisit when each role has enough real rates to be meaningful. |
| "Potential revenue" (Depop) | Rejected | A forecast. No estimated figures (CLAUDE.md hard rule 1). |
| Search impressions ("appeared in 14 searches") | Rejected for now | Writes on every search for little signal at pilot volume. Profile opens are the useful number. |
| Push or email on every profile view | Rejected | Noise, and it would turn brand browsing into a stream talent react to. Saves get one quiet in-app notification only (section 5). |
| Chat or social feed between talent | Rejected | Not what Embr is, and moderation cost. |

## 4. Wording and legal checks (for Luke)

- Needs Luke's approval before release (privacy and legal-adjacent): the one-line brand-facing notice that talent see view counts and never which brand; the earnings line "0% commission" (already in the app, Decision Luke, 2026-11-20); and the This week on Embr framing, to be mentioned to BPP with the agreement.
- Not claimed anywhere: that a fuller profile ranks higher or books more; any market size, average rate or growth figure.
- All numbers displayed come from Embr's own tables on the day. Thresholds (3 events, 2 per category, 6 photos, 14 days) are design settings, not statistics.

## 5. Build spec for the developer

New migration: `supabase/migrations/20261125000001_talent_engagement.sql`. Never edit earlier migrations. Add every new function to the `grant execute ... to authenticated` list the way the earlier migrations do (the grant statement is re-issued in each migration that adds functions).

### 5.1 Tables and columns

```sql
create table public.profile_views (
  id bigint generated always as identity primary key,
  talent_id uuid not null references public.talents (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  day date not null default current_date,
  created_at timestamptz not null default now(),
  unique (talent_id, brand_id, day)
);
create index on public.profile_views (talent_id, day desc);
alter table public.profile_views enable row level security;
-- no policies: only security definer functions read or write it
revoke all on public.profile_views from anon, authenticated;

alter table public.talents add column dates_confirmed_at timestamptz;
```

### 5.2 Change to `talent_detail(uuid)`

Re-create it (it is defined once, in `20261123000001_embr_pilot.sql`, line 715) as `volatile` (remove `stable`). Keep the body, and before the return add:

```sql
if r = 'brand' and u <> p_id and t.published then
  insert into profile_views (talent_id, brand_id) values (p_id, u)
  on conflict (talent_id, brand_id, day) do nothing;
end if;
```

`ops` views and talent self-views are not logged. The client `rpc()` needs no change. Confirm that nothing calls `talent_detail` in a loop for list rendering (cards come from `_talent_card`, which is not touched).

### 5.3 `talent_pulse() returns jsonb` (talent only, `_need('talent')`)

Security definer, `set search_path = public`, stable. Returns:

| key | value |
|---|---|
| `views_7d` | `count(distinct brand_id)` from `profile_views` where `day >= current_date - 6` |
| `views_prev_7d` | same for `day between current_date - 13 and current_date - 7` |
| `views_total` | `count(distinct brand_id)` ever |
| `saves_total` | `count(*)` from `shortlist` where `talent_id = u` |
| `saves_7d` | same, `created_at >= now() - interval '7 days'` |
| `offers_total` | `count(*)` from `bookings` where `talent_id = u` (every offer, any status; exclude any pre-offer or draft status if one exists) |
| `bookings_completed` | `count(*)` where `talent_id = u and status = 'completed'` |
| `published` | `talents.published` |
| `dates_confirmed_at` | `talents.dates_confirmed_at` |

Never return any `brand_id`.

### 5.4 `embr_pulse() returns jsonb` (talent only, `_need('talent')`)

Security definer, stable. Uses the talent's `city` and `roles`. Returns:

```json
{
  "scope": "city" | "uk",
  "week":     { "briefs": 0, "bookings": 0, "brands": 0, "total": 0 },
  "lifetime": { "briefs": 0, "bookings": 0, "brands": 0 },
  "my_roles": [ { "role": "UGC creator", "briefs": 2 } ]
}
```

- `week.briefs`: briefs with `created_at >= now() - interval '7 days'`, in the talent's city if that gives 3 or more briefs for the week, otherwise UK-wide (set `scope` accordingly). Count all briefs created in the window, open or closed.
- `week.bookings`: bookings that reached confirmed in the window. Use the confirm event in `booking_events` (developer to check the event type name); do not use `created_at` on `bookings`, which would count unaccepted offers.
- `week.brands`: `brands` rows created in the window where `name <> ''`.
- `week.total` = briefs + bookings + brands. The client shows weekly lines only when `total >= 3`; otherwise lifetime lines.
- `my_roles`: briefs created in the window whose `category` is one of the talent's roles (check how `briefs.category` maps to `talents.roles`), count of 2 or more only.
- Never return titles, ids, names, dates, rates, spots or times. Suppression of small numbers is done in SQL for `my_roles` and by the client rule above for the rest.
- Tell the developer: the data is whole-pilot aggregate, which is why a `security definer` function is used and no table is exposed to talent. Talent must still never be able to read `briefs` or create offers (CLAUDE.md coding standards). Add a test that a talent cannot `select` from `briefs` or `profile_views` directly.

### 5.5 `confirm_dates() returns timestamptz`

`_need('talent')`; `update talents set dates_confirmed_at = now() where id = u returning dates_confirmed_at`.

### 5.6 `toggle_shortlist(uuid)` change

On the insert branch only, add one quiet notification, de-duplicated:

```sql
if not exists (select 1 from notifications
               where user_id = p_talent and text = 'A brand saved your profile'
                 and created_at > now() - interval '24 hours') then
  insert into notifications (user_id, text, url, email) values (p_talent, 'A brand saved your profile', '/', false);
end if;
```

Use the existing notification helper if there is one. `email = false`: in-app only, no email. Never include the brand's name. Only when the saved profile is published.

### 5.7 Client changes (`src/views/talent.js`, `src/style.css`, `src/api.js`)

- `V.today`: also `await rpc('talent_pulse')` and `rpc('embr_pulse')` with `Promise.all` alongside `my_bookings`. If either rpc fails, render the rest without it (never block Today).
- New pure helpers in `talent.js`: `strength(t, pulse)` returns `{ score, steps: [{ label, action }] }`; `weekLines(pulse)` returns the lines for the activity panel after applying the 3-event and 2-per-role rules.
- Layout in the Today template, in this order:
  - Main column: (a) earnings hero (existing `.earn`), (b) NEW stats row `statsRow(pulse, t)` under it, full width above the columns, (c) `readyPanel(t)` while gates remain, otherwise NEW `strengthPanel`, (d) `todo` (existing), (e) Coming up (existing), (f) NEW six-month earnings bars, (g) NEW milestones row.
  - Aside: (a) NEW `This week on Embr` panel, (b) NEW `Your dates` panel (live profiles only), (c) existing "Let work find you" panel, (d) existing Book-me and booking-link panels.
- New action: `A['confirm-dates']` calls `action`/`rpc('confirm_dates')`, toasts "Dates confirmed", re-renders.
- The stats tiles, milestone chips and bars reuse existing classes (`.panel`, `.st`, `.empty`, `.cols`); add small classes only (for example `.tiles`, `.tile`, `.bar6`, `.chips`). Keep the premium look of `src/style.css`. Phone first: tiles stay three across at 360px with short labels, otherwise stack.
- The activity panel has no links or buttons.
- UK English, en-GB dates, GBP via `gbp()`.

### 5.8 Tests (each in `tests/`, plus an entry in `docs/dev/CHANGELOG.md`)

`tests/db.test.mjs`:
- A brand opening `talent_detail` twice in a day adds one `profile_views` row; a second brand adds another; `talent_pulse().views_7d` equals 2.
- Ops and the talent themselves opening it add no rows. An unpublished talent logs nothing.
- `talent_pulse` returns no brand ids anywhere in its JSON (string-search the result for the brand uuid).
- A talent cannot `select` from `profile_views` or `briefs`, cannot call `create_offer`, and a brand calling `talent_pulse` or `embr_pulse` is refused.
- `embr_pulse`: with 2 briefs this week it returns the right counts and `my_roles` is empty (below 2 per role is hidden, 2 shown); output contains no `title`, `id` or `brand_id` keys.
- `toggle_shortlist` adds one talent notification with `email = false`, a second toggle within 24 hours adds none, and the text contains no brand name.
- `confirm_dates` sets the timestamp for talent only.

`tests/e2e.test.mjs`: a fresh live talent with zero data sees all three tiles with their zero-state copy, the strength card, and the activity panel's "Brands are being invited in now" line, with no empty box and no console errors. A talent with an unpublished profile sees "Not live yet". Scan the Today HTML for the banned phrases ("find work", "apply", "jobs for you") and fail on a match.

### 5.9 Build order

1. Migration, `talent_pulse`, `profile_views` logging, tests. 2. Stats row and zero states. 3. Strength panel. 4. `embr_pulse` and activity panel. 5. Dates check-in. 6. Milestones. 7. Six-month bars. Each step ships on its own.

## Sources and claims to check

- Agency rule, 0% commission, Equity v Talent Systems reference, BPP route: `docs/decisions.md` (Agency position 2026-11-20; Legal review 2026-11-24). Read 2026-11-25.
- Existing schema and functions (`talents`, `shortlist`, `briefs`, `notifications`, `talent_detail`, `toggle_shortlist`, `my_bookings`, `search_talent`): `supabase/migrations/20261123000001_embr_pilot.sql` and later, read 2026-11-25. The developer must confirm `booking_events` event names and the `briefs.category` to roles mapping before building.
- Today view structure: `src/views/talent.js` (`V.today`, `readyPanel`), read 2026-11-25.
- Mobbin screens: links in section 1, viewed 2026-11-25. Only what is visible in those screens is described. Uber, Upwork and Vinted were not covered.
- No statistic is used. Thresholds are design settings.
- For Luke to approve before any public use: brand-facing notice about view counts, the "0% commission" line, the activity-panel framing (mention to BPP).
