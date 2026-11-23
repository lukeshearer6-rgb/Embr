# Embr v8 and v9: visual passes from the Mobbin research (17 Nov 2026)

**Artifact:** https://claude.ai/artifact/9kKVeYTRibzcMJzeUBcfZ9 (replaces https://claude.ai/artifact/AZrKKDjDth2Q23UZkBpRBW, which this session couldn't update). Downloads capability carried over.
**File:** Documents/EMBR/Embr_MVP_App.html (earlier builds kept as Embr_MVP_App_v7.html and Embr_MVP_App_v8.html)
**Source:** Documents/EMBR/embr-source. Build chain: `cp src.v7.html src.html && python3 patch_v8.py && cp src.html src.v8.html && python3 patch_v9.py && python3 build.py`. `build.py` now runs from its own folder.
**Research doc:** "Embr: what to take from 20 top apps (Mobbin research)" (Claude Docs).

## v8: features and layout (from 20 high-engagement apps)
- **Talent profile (brand view):** Airbnb-style trust card (jobs done, rating, brands rebooked; ID-checked, reply time, base and travel, Instagram). Sticky footer with day rate, "£X deposit today · free cancellation until 7 days before", Save and Book. Hold the date and Request digitals are small links in the body.
- **Book-me page:** same trust card, price line above Book.
- **Talent Today:** Cash App-style earnings hero that taps through to Wallet; reply-time praise line (Fiverr); **Milestones** panel (Strava).
- **Wallet:** dark hero (Revolut); tax pot shown as a pot (Monzo).
- **Profile:** recommended day-rate chips (Depop); Book-me "Add to Instagram bio" and "Share".
- **Mobile nav:** Brand: Board, Jobs, Bookings, Messages, More (Roster, Account). Talent: Today, Bookings, Wallet, Messages, More (Find work, Profile, Links).

## v9: premium pass (from SSENSE, HBX, Co–Star, VSCO on Mobbin)
Luke said v8 didn't feel premium enough. The premium references share a style, and v9 applies it:
- Square corners everywhere; square uppercase buttons (orange stays for money actions).
- Small uppercase, letter-spaced labels and section headings.
- Hairline rules instead of grey or bordered boxes; to-dos and alerts marked with a thin orange rule instead of a salmon fill.
- Text-only bottom tab bar with a dot under the active tab. **Replaces v8's floating Cash App-style menu bar**, which the premium references contradicted.
- Full-bleed hero photo at the top of profiles (capped at 560px wide on desktop), with the other photos below.
- Notices appear as a full-width black strip.
- Custom select arrows, no number spinners, flat white header.
- Fixes: a v8 bug where the booking sheet footer ran off the screen on phones; columns overflowing the right margin on talent Today.

## Decisions
| Decision | Rationale | Owner |
|---|---|---|
| **Jobs must stay on the brand's main tab bar, never in More** | Posting and managing jobs is the most important thing brands do | Luke, 17 Nov 2026 (v8.1) |
| **Premium direction follows SSENSE / HBX / Co–Star / VSCO**: square, uppercase labels, hairlines, photo-first | Luke wanted it more premium and asked for the direction to come from Mobbin | Luke asked; direction from Mobbin evidence, 17 Nov 2026 (v9) |

## Checked
Headless Chromium at 390px and 1280px: brand board, brand Jobs, talent profile, booking sheet, offer form, More sheets, talent Today, Wallet, Profile with rate chips, Book-me preview. No JS errors and no horizontal overflow on Today. Screenshots use a fallback font because the sandbox can't load Google Fonts; the live page uses Archivo.

## Still to consider
Cut explanatory copy on panels (premium apps say much less) · a serif accent for headings, not tested · demo talent with no photos show grey cards on the board.

## Not built yet (from the research doc)
Thumbtack-style top-3 matching after a brief · money cards in message threads (Revolut) · ClassPass-style date strip in the offer form · monthly quests · "Your year on Embr" recap · brand moodboards.
