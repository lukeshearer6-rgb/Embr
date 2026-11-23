# Embr v10: poster Book-me page, story card, and compliance basics (17 Nov 2026)

**Artifact:** https://claude.ai/artifact/GvLsnj3yqEGWtVCcHh4MjY (new page; this chat couldn't update https://claude.ai/artifact/9kKVeYTRibzcMJzeUBcfZ9). Built on the v9 premium build. Downloads capability declared.
**File:** sent in chat as Embr_MVP_App.html. Luke's Mac was offline, so it isn't saved to Documents/EMBR yet. The v9 source chain in Documents/EMBR/embr-source does not include v10: the v10 changes were made directly to the built v9 file.

## Update 17 Nov 2026, 18:40: legal tucked away (Luke: "This isn't a website")
- No legal footer and no cookie banner in the app. Legal now lives in **Settings → Legal and privacy** (talent Profile, brand Account): Terms, Privacy, Cookies, Cancellations and refunds, Reviews policy, Accessibility, Company details, plus an "anonymous usage data" switch that is off by default.
- Settings panel rows: Download my data · Legal and privacy · Close my account.
- Why no banner is needed: the app only uses storage it needs to work, which doesn't need consent under PECR. Analytics stays off until the user turns it on in Settings. If a real analytics SDK is added and switched on by default, a first-launch prompt would be needed.
- Kept on purpose: (1) the Terms/Privacy tick at sign-up, because acceptance has to be recorded; (2) one small line on the **public Book-me page** (business details, Terms, Privacy). That page is a web page brands open in a browser, so the trading-disclosure rules for websites apply there; (3) fee shown in the booking bar. That's pricing, not T&Cs.
- App stores also expect a privacy policy link on the store listing and somewhere in the app; Settings covers the in-app part.

## Where the ideas came from
Two Instagram reels Luke sent (screen recording):
1. **@ayoships design reel:** subject in the middle, the name huge on top, overlap them for depth; one colour only, everything else black and "paper"; type is either huge or tiny, nothing in between.
2. **@millee.md "20 things to have Claude do so your app doesn't get sued":** privacy policy, terms, refund policy, cookie policy, cookie consent banner, form consents, no unnecessary data, audit third-party SDKs, remove dark patterns, remove hidden fees, remove fake reviews, remove unsupported claims, alt text, colour contrast, keyboard navigation, business details, age consent for kids' data, unsubscribe link in emails, licence fonts/images, data deletion requests.

## Reel 1: does the poster idea fit Embr? Verdict: yes, in two places only
- **Book-me page:** new default "Poster" style: paper background (#f2f0eb), name in giant condensed caps, photo centred and overlapping the second line, tiny uppercase details, one orange square next to "Book on Embr". Talent can switch back to "Photo" style in Profile. Talent with no photos get a type-only poster.
- **Instagram story card:** Profile → Your Book-me page → "Make an Instagram story card". 1080×1920 PNG in the same style with the Book-me link.
- **Not used elsewhere:** board, forms and booking screens stay functional.
- **For production:** real depth (name behind the person's head) needs background removal on the photo.

## Reel 2: compliance checklist, adapted to Embr (UK)
| # | Item | v10 status | Still needed before launch |
|---|---|---|---|
| 1 | Privacy policy | Plain-English draft in Settings → Legal and privacy | Solicitor review; named processor list; retention periods |
| 2 | Terms | Draft (not an agency, 18+, fees, deposits, 12-month clause, law of England and Wales) | Liability section; solicitor review |
| 3 | Refund policy | "Cancellations and refunds" draft | Decide whether Embr's fee is refunded on all pre-shoot cancellations (draft says yes) |
| 4 | Cookie policy | Draft: essential storage only; analytics only if switched on | Update if analytics added |
| 5 | Cookie banner | Replaced by an off-by-default usage-data switch in Settings (no banner needed while nothing optional runs by default) | First-launch prompt only if an analytics SDK runs by default |
| 6 | Form consents | Business sign-up: required Terms/Privacy tick; unticked optional marketing tick | Same on every future sign-up form |
| 7 | No unnecessary data | Privacy copy commits to: ID result only, no card numbers, location only while sharing | Build it that way |
| 8 | Third-party SDKs | Only Google Fonts loads externally in the prototype | Self-host fonts; list Stripe, pay-later, ID check, email/SMS, hosting |
| 9 | Dark patterns | One-tap membership cancel; no pre-ticked marketing; account closure in Settings | Re-check every new flow |
| 10 | Hidden fees | Booking bar shows "+ X% Embr fee", total per day and the deposit | Pay-later partner fee and VAT wording |
| 11 | Fake reviews | "Verified booking" + month, "Report" link, Reviews policy | Review window and edit rules; demo reviews are demo data |
| 12 | Unsupported claims | Safety copy no longer promises a call "straight away" | Don't claim features until they're real |
| 13 | Alt text | Photo grids and poster have text descriptions | Talent photo alt text field |
| 14 | Colour contrast | All text passes WCAG AA on 12 screens | Re-run on new screens |
| 15 | Keyboard navigation | Visible focus, focus into/out of dialogs, Escape closes | Screen-reader testing |
| 16 | Business details | In Legal and privacy and Company details page; one line on public Book-me page (placeholders) | Fill in from Companies House |
| 17 | Age / kids' data | 18+ only, ID-checked | Age check via ID provider |
| 18 | Unsubscribe | "Emails" panel: booking emails always on, marketing off by default | One-click unsubscribe in email provider |
| 19 | Licensed fonts/images | Archivo is open-source (SIL OFL) | **Demo photos: photographers own the copyright, so get permission or replace before showing publicly** |
| 20 | Data deletion | Settings: Download my data, Close my account; requests in Ops → "Data and reviews" with one-month reply-by date | Real deletion and export jobs |

## Legal context found (17 Nov 2026)
- DMCC Act consumer rules in force since 6 April 2025: fake reviews and drip pricing banned (B2C).
- DMCC subscription-contract rules expected January 2027; the membership flow already meets that standard.
- Trading disclosures (2015 Regulations): websites must show registered name, part of the UK registered in, company number and registered office.

## Decisions
| Decision | Rationale | Owner |
|---|---|---|
| Poster style for Book-me pages and story cards only | Marketing surfaces benefit; working screens need clarity | Claude's recommendation, 17 Nov 2026 |
| Compliance basics built in from the start | "ensure these things are built in from the start" | Luke, 17 Nov 2026 |
| Legal hidden in Settings, no footer or banner in the app | "This isn't a website" | Luke, 17 Nov 2026 |
| Keep sign-up tick and Book-me page legal line | Acceptance must be recorded; Book-me is a public web page | Claude, legal |
| Primary buttons use black text on Embr orange | White on #ff3b00 fails contrast | Claude, accessibility |
