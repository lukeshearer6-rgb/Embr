# Embr mobile design rules

Read this before any UI task: a new screen, a layout change, a component, or a redesign. It sets how Embr looks and behaves on a phone, based on what leading marketplace and media apps do.

- **Sources:** iOS screens on Mobbin from Airbnb, Fiverr, Peerspace, Behance and Spotify, checked 2026-11-25. Each rule links the screens behind it. Mobbin has no Android library, so the Android notes come from Google's own guidance (linked).
- **Numbers:** a size is only stated when it comes from a platform guideline (linked) or from Embr's own `src/style.css`. Mobbin screenshots are previews and are not measured.
- **Brand:** black, white and Embr orange (`--embr: #ff3b00`). Premium and independent. Talent are professionals, shown as such. Never say "Crew". All copy follows `CLAUDE.md` (no "find work", "apply" or "jobs for you" for talent).
- **Where Embr differs today:** each section ends with a "Current app" note, read from `src/style.css` at commit `7265a87` (the interface round 2 redesign, PR #25). These are not fixed in this change. Fix them as part of a UI task, with a test and a changelog entry.

Screen key used below (all iOS, open on Mobbin):

| App | Screens |
|---|---|
| Airbnb | [A1 Explore map + results sheet](https://mobbin.com/screens/fca1741d-8901-4f82-8ef8-1d3fb0d45589) · [A2 Experiences list](https://mobbin.com/screens/f6ef9054-224d-4319-bb9d-1ae4b9d1bd95) · [A3 Listing detail](https://mobbin.com/screens/f1844799-974d-4ebb-a65c-1923b9c092be) · [A4 Trip over map](https://mobbin.com/screens/f062fe34-de67-40e2-9658-3920dfc8d890) · [A5 Search modal](https://mobbin.com/screens/ead18293-e327-4fbd-b5ca-d87de116d6f2) · [A6 Add details page sheet](https://mobbin.com/screens/fc9ef507-2c8f-41c4-9d2f-5b88fb646574) · [A7 Search, "Who?" step](https://mobbin.com/screens/f2412f95-4654-44a0-87c3-3169828a3f4a) |
| Fiverr | [F1 Seller profile tabs](https://mobbin.com/screens/fca9922a-0f7c-47e2-9fc4-23734ac4b501) · [F2 Seller dashboard](https://mobbin.com/screens/fc807bd4-3a05-44a1-b5dd-62fcdb6efcfd) · [F3 Date range sheet](https://mobbin.com/screens/e01170cc-81d3-4441-bd4d-5b722f280a20) · [F4 Profile menu](https://mobbin.com/screens/dc363815-f40c-459b-828b-5ee5eecb46ac) · [F5 Saved lists](https://mobbin.com/screens/db7cbae9-4cf7-4b09-b0bc-c40b431a6bf9) · [F6 Filters modal](https://mobbin.com/screens/fd25b895-034c-493f-b185-a5f0f6875b88) · [F7 Create an offer sheet](https://mobbin.com/screens/f887bc4f-39dc-4737-9fde-383381684b3f) · [F8 Inbox filter sheet](https://mobbin.com/screens/f1eb9bb0-24c0-4eda-8a71-422bafc0356c) · [F9 Feedback sheet](https://mobbin.com/screens/efa146f5-d091-4670-92f3-aba7c37e61da) |
| Peerspace | [P1 Search results](https://mobbin.com/screens/ff68d759-0377-41ae-8d5b-5ab062c72a0c) · [P2 Two-column results](https://mobbin.com/screens/dbc164c5-a63d-408c-a95d-7cc09324c679) · [P3 Save to board sheet](https://mobbin.com/screens/e995ca9b-239e-4a24-9de8-29051ff1447f) · [P4 Start booking sheet](https://mobbin.com/screens/f4259faa-1610-439c-b8e5-14b38552f1f8) · [P5 Checkout](https://mobbin.com/screens/f41cd816-e078-4bed-a2fd-c3dda826f4ac) · [P6 Booking complete](https://mobbin.com/screens/f2991d25-baf3-4c7c-9960-1f0d69c34a5c) · [P7 Booking details form](https://mobbin.com/screens/f0afadec-ae65-4467-853d-2ac9936fad9e) |
| Behance | [B1 Search grid](https://mobbin.com/screens/ffd9cd79-59cc-45e7-a441-44418f1317f0) · [B2 Live video](https://mobbin.com/screens/fe529d50-f0a6-4aca-b448-af470952af32) · [B3 Empty profile](https://mobbin.com/screens/fd99fb48-bce9-4635-8f02-4e0a6b3f08b8) · [B4 Profile with work](https://mobbin.com/screens/fc7aaaf0-8af3-4abc-8304-f3de37597322) · [B5 Messages](https://mobbin.com/screens/f9e2c86f-b770-437e-be91-ec8e362ceded) |
| Spotify | [S1 Audiobook chapters](https://mobbin.com/screens/fd498ff8-14d9-4eb1-ab2e-3210802ed6b3) · [S3 What's New](https://mobbin.com/screens/f8a0fbb8-7f2c-450f-b1c7-a7bf881b8869) · [S4 Venue page](https://mobbin.com/screens/eac1da56-d1fa-44e3-908e-d12fbaad3572) · [S5 Your Library](https://mobbin.com/screens/ea3aa1f4-68fd-4890-b99c-29c84094f6b1) · [S6 Artist options sheet](https://mobbin.com/screens/fafd2ec5-561a-484d-948e-53f0ff34c6dd) · [S7 Track options sheet](https://mobbin.com/screens/facdc774-78cf-4c5f-a873-b70201c92bed) · [S8 Queue sheet](https://mobbin.com/screens/f86dc1c9-50a6-4dda-a162-85f41f167386) · [S9 Now playing (video)](https://mobbin.com/screens/ff775fbc-a302-4fa2-a4b7-4008628ced33) · [S10 Lyrics player](https://mobbin.com/screens/ff9f0bbc-a1da-490e-b875-8ac01e9300c7) |

---

## 1. Bottom tab bar

**What the apps do**

| App | Tabs | Style | Evidence |
|---|---|---|---|
| Airbnb | Explore, Wishlists, Trips, Messages, Profile | icon + label; active tab in brand colour; dot badge on Wishlists | A1, A2, A4 |
| Peerspace | Search, Inbox, Bookings, Boards, Account | icon + label; active tab in brand colour; number badge on Inbox | P1, P2 |
| Spotify | Home, Search, Your Library, Create | icon + label; active tab white, others grey | S1, S4, S5 |
| Fiverr | 4 or 5, icon only | floating rounded bar; active tab sits on a grey pill | F2, F4, F5 |
| Behance | 5, icon only; last tab is the user's avatar | flat bar on white | B1, B3, B5 |

**Rules**

1.1 Use **4 or 5 tabs**. Every app above does. If a role has more destinations, put the rest in the last tab (Account or Profile), not in a sixth tab or a "More" tab. Airbnb, Peerspace and Fiverr all end on Profile or Account (A1, P1, F4).

1.2 **Order:** the main discovery or home screen first, Account or Profile last. Messages sits in the middle in Airbnb, Peerspace and Behance (A1, P1, B5).

1.3 **Show an icon and a short label** on every tab. Three of the five apps do this, and these are the marketplaces closest to Embr (Airbnb, Peerspace) plus Spotify. Icon-only bars (Fiverr, Behance) rely on people already knowing the app. Embr is invite-only and new, so labels help. Labels are sentence case, one word where possible.

1.4 **Active state:** one change only, either the colour of icon and label (Airbnb, Peerspace, Spotify) or a pill behind the icon (Fiverr). For Embr, active = black icon and label, inactive = `--mist` grey. Do not use orange for the active tab: orange is kept for "needs you" (see 4.3).

1.5 **Badges:** a small dot for "something new" (Airbnb Wishlists, A2) and a number only for unread messages (Peerspace Inbox, P2). Embr uses its orange dot (`.flag`) for these.

1.6 **Hide the tab bar** on screens where a person is committing to something: listing detail and checkout show a sticky action bar instead (A3, P5, P7). Spotify keeps its bar on browse and detail pages (S1, S4) because those are still browsing.

1.7 Suggested Embr tabs (4 or 5 each, labels are a starting point for the developer and marketer to confirm):
- Brand: Board, Bookings, Messages, Shortlist, Account (briefs reached from Board or Account).
- Talent: Today, Bookings, Wallet, Messages, Profile (invite links inside Profile).

**Current app** (`src/style.css` lines 486-496, `src/main.js` line 28, `src/state.js` lines 15-19)
- Phone tab bar is **text only**: icons are hidden (`.botnav button svg{display:none}`), labels are uppercase at 10.5px, active tab marked by a 4px black dot. All five apps show an icon (rule 1.3).
- Brand and talent each have **6 destinations**, so the phone bar shows 4 plus a "More" button (rule 1.1).

## 2. Safe areas and touch targets

**Platform minimums (verified 2026-11-25)**
- Apple: default control size **44x44 pt** on iOS, minimum 28x28 pt. Source: [Apple HIG, Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) (table "Default control size / Minimum control size").
- Android: touch targets of **at least 48x48 dp**. Source: [Android Developers, Make apps more accessible](https://developer.android.com/guide/topics/ui/accessibility/apps) and [Compose accessibility defaults](https://developer.android.com/develop/ui/compose/accessibility/api-defaults).
- Embr's rule is **48 CSS px for anything tappable**: the larger of the two platform figures, so one rule covers iPhone and Android.

**What the apps do**
- Primary actions sit in a **full-width button pinned to the bottom**, above the home indicator, with content scrolling behind: Peerspace Checkout, Next and Start booking (P4, P5, P7), Fiverr Show Results (F6), Airbnb Done (A6).
- Listing detail pins a **price + action bar** at the bottom: "Add dates for prices" beside "Check availability" (A3).
- Icons over photos (back, share, save) sit in a **solid round button**, never bare on the image: Peerspace heart and share (P1, P4), Airbnb heart (A2), Fiverr back button (F3, F6).
- Fiverr's floating tab bar keeps a gap from the screen edges and the home indicator (F2, F4); the flat bars (Airbnb, Peerspace, Behance) run edge to edge with the home indicator area below the icons (P1, B1).
- List rows are full-width tap targets with a chevron, not a small link: Fiverr profile menu (F4), Peerspace checkout rows (P5), Airbnb trip rows (A4).

**Rules**

2.1 `index.html` keeps `viewport-fit=cover`. Every fixed element touching an edge pads by the matching `env(safe-area-inset-*)`: tab bar and sticky footers at the bottom, the header at the top.

2.2 Every tappable thing is **at least 48x48px** including padding: buttons, inputs, chips, icon buttons, tab bar items, list rows. A visually smaller icon gets a larger invisible hit area.

2.3 One primary action per screen, full width, pinned to the bottom on phone, inside the safe area. A secondary action sits to its left as text (Airbnb "Clear all", A5) or as a price/summary (A3).

2.4 Icon buttons on photos use a solid round white (or black) background so they read on any image.

2.5 Side padding on phone stays consistent across screens (currently 18px in `.sheet` on phone, `src/style.css` line 326). Do not let text or buttons touch the screen edge. Photos may go edge to edge.

2.6 Leave enough bottom padding on scrolling pages that the last item clears the tab bar and the home indicator (`main.shell{padding-bottom:110px}` today, line 494).

**Current app**
- Meets the rules: `.btn` and `.in` are 48px tall (lines 458, 463); tab bar items 56px (line 489); tab bar, sheet footer and toast add `env(safe-area-inset-bottom)` (lines 488, 495, 532).
- Below 48px: `.chip` is **30px** tall (line 469); the save heart on talent cards (`.comp-wrap .save`) is **34px** (line 543). Give both a 48px hit area.
- The header only adds `env(safe-area-inset-top)` when installed to the home screen (line 541). In a normal browser tab this is fine, but check any new full-screen view (photo viewer, sheet) adds its own top inset.

## 3. Bottom sheets vs full-screen modals

**What the apps do**

*Bottom sheets* (rounded top corners, grabber bar, page dimmed behind, swipe down to close):
- Short action lists for one item: Spotify track and artist options (S6, S7), Fiverr "Create an offer" (F7), Fiverr feedback (F9).
- One quick choice: Fiverr date range (F3), Fiverr inbox filters (F8), Peerspace "Save to board" (P3).
- Start of a booking while keeping the listing photo in view: Peerspace "Start booking" with price, rating, date and one button (P4).
- Results over a map, dragged up and down: Airbnb (A1, A4).
- A working panel that relates to what is playing: Spotify queue (S8).

*Full-screen or near-full-screen modals* (X to close at top, sticky action at bottom):
- Filters with many groups: Fiverr Filters with X, "Clear All" and "Show Results" (F6).
- Multi-step search: Airbnb Where, When, Who with X, "Clear all" and "Search" (A5, A7).
- Picking from a long set: Airbnb "Add details" page sheet with X and "Done" (A6).
- Immersive media: Spotify now playing and lyrics, closed by a down chevron (S9, S10).

*Pushed full screens* (back chevron, no tab bar):
- Committing money or details: Peerspace booking details, then checkout, then confirmation (P7, P5, P6).

**Rules**

3.1 **Bottom sheet** when the task is short, about one item, and the person should still see where they came from: item options, a single choice, saving, a quick confirm. Up to about one screen of content. Always show the grabber and rounded top corners, dim the page behind, and close on swipe down, tap outside, or a visible close button.

3.2 **Full-screen modal** (X at top left or right, sticky primary action at bottom) when the task has several fields or groups but is still a side task: brief filters, search, editing a section of a profile. Offer "Clear all" when it resets choices.

3.3 **Pushed full screen** (back chevron, tab bar hidden) for anything that commits money or a booking: making an offer, accepting, paying, signing off. Each step gets its own screen with one primary action (P7, P5). End with a confirmation screen that summarises the booking (P6).

3.4 **Full-screen dark viewer** for photos, video reels and audio (see 4.5). Close with a down chevron or swipe down (S9).

3.5 Never stack a sheet on a sheet. If a sheet needs a second step, push a full screen instead.

3.6 For Embr: brand "Make an offer" and talent "Accept" follow 3.3. Saving talent to a shortlist, quick status changes and "more options" follow 3.1. Board filters follow 3.2.

**Current app** (`src/style.css` lines 161-171, 416-419, 502-503)
- `.dialog` becomes a bottom sheet with a grabber at 820px and below, but at **560px and below (most phones) it loses its rounded corners and grabber** (`.dialog{border-radius:0}`, `.dialog:before{display:none}`). Every sheet observed keeps both (rule 3.1). Square corners can stay elsewhere for the brand look, but a sheet needs the grabber so people know it can be swiped away.
- `.sheet` (booking and profile detail) is a full-screen panel that slides in from the right. This matches rule 3.3 for booking steps.

## 4. Neutral palettes that let photos, video and audio stand out

**What the apps do**
- **White surface, one brand colour used sparingly.** Airbnb uses its pink only for the active tab and the main button (A1, A3, A5). Peerspace uses its purple only for the active tab, links and the main button (P1, P4, P5). Behance keeps everything white and black so the project thumbnails carry all the colour, with blue only on the add button (B1, B3).
- **Black as the strong neutral.** Fiverr's main buttons are black (F6, F2). Peerspace uses black for "Next" and for price pills over photos (P1, P7). Airbnb's "Done" is black (A6).
- **Light grey for cards and backgrounds**, not colour: Fiverr dashboard cards (F2), Airbnb trip rows (A4).
- **Dark surface for audio and video.** Spotify's app is near-black with white text; green appears only on play buttons and the active item (S1, S3, S7). Album and podcast art supply the colour (S5). Detail headers and the player take a colour from the artwork (S4, S10).
- **Photos lead the card.** Large photo first, then title, rating and price in plain text below (P1, P2, A2). Overlays on photos are small: a white "Guest favorite" pill (A1), a black price pill and a white heart (P1).
- **Photo grids** use tight gutters and let images fill the tile (B1, P2, F5).

**Rules**

4.1 Embr's surfaces are **white (`--paper`) and light grey (`--backdrop`, `--backdrop2`)**. Text is black (`--ink`) and grey (`--graphite`, `--mist`). Lines are `--line`. Nothing else forms a large background behind photos.

4.2 **Black is the main action colour** (primary buttons, selected chips, price pills over photos). This matches Fiverr and Peerspace and keeps Embr's premium look.

4.3 **Orange (`--embr`) is rare and means "needs you" or "new"**: the orange action block, notification dots, and a saved state. At most one large orange area on a screen. Never use orange as a page or card background behind talent photos, and never as the active tab colour. Use `--embr-text` (`#c42d00`) when orange is used for text on white.

4.4 **Talent photos lead.** On the board and in profiles, the photo is the biggest thing on the card, shown at a consistent portrait ratio, with name, roles and location in plain black text below. Text on top of a photo is limited to small solid pills (price, "Available") and round icon buttons. No gradients, filters or coloured frames over a professional's photos.

4.5 **Video reels and audio use a black viewer.** When Embr shows a showreel, a video, or a voice or music track, open it full screen on black with white controls (S9, S10). Photos opened full size use the same black viewer. The rest of the app stays white.

4.6 Status colours (`--ok`, `--warn`, `--bad`) are for status text and small badges only, never large fills.

4.7 Dark sections (the black header and money areas from PR #25) are fine as bands. Keep photos off coloured backgrounds; place them on white, light grey or black.

**Current app** (`src/style.css` lines 1-7 and PR #25)
- Matches the pattern: white and grey surfaces, black primary actions, one accent (`--embr`).
- No full-screen black viewer exists yet for photos, reels or audio (rule 4.5). Add one when talent media beyond photos is built.

---

## How agents use this file

- **developer** and **app-builder**: read this before changing anything in `src/` that people see. Follow the rules, or write in the task note why a rule does not fit. Run a fresh Mobbin search when a screen type is not covered here, and add the evidence to this file.
- **marketer**: follow section 4 (colour and photo rules) for any app screenshot or mock-up used in marketing.
- When a "Current app" gap is fixed, delete that line here in the same pull request.
- Changing a rule needs new evidence (Mobbin screens or a platform guideline, linked and dated) or a decision from Luke, cited as "Decision (Luke, date)".
