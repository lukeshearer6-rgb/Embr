# Embr simplification pass: plan (approved by Luke, 17 Nov 2026, to do 18 Nov)

**Why:** Luke flagged that recent builds drifted towards big-agency workflows (TV clock numbers, outdoor proof of posting, options, renewals, overtime, exclusivity clauses). Embr's market is independent and new talent booked by newer, smaller, local brands. **Test:** a two-person brand can book a new face on their phone in under two minutes without reading anything they don't understand, with talent protection still running underneath.

**Source:** Documents/EMBR/embr-source (src.html, build.py, logo.b64, img/). `python3 build.py` inlines images and logo into index.html. Live artifact: https://claude.ai/artifact/AZrKKDjDth2Q23UZkBpRBW (republish over the current version). Published file: Documents/EMBR/Embr_MVP_App.html. Regression tests run2–run11 lived in the session container and may need rewriting.

## 1. Keep front and centre
Booking links and Book-me page · 50% deposit held + paid at sign-off (72 h auto sign-off) · safety (check-in, trusted contact, content agreed, 18+) · digitals on request · rate guidance · portfolio rights · tax pot and invoices.

## 2. Keep, but simplify
- **Usage in plain English.** Replace media/period/territory dropdowns with presets: "Instagram and TikTok posts", "Website and online shop", "Paid ads", "Posters and print", "All of it", each with a duration. "Final cut only" becomes "Only pay for this if we use it". Keep the detailed fields available under "Custom".
- **Team booking** stays visible (model + photographer + MUA is common for small brands).
- **Overtime, exclusivity, AI, renewals, posting rules:** apply quiet defaults (10-hour day, overtime 20% of day rate, no AI, post after launch, portfolio allowed, no exclusivity, renewal at +10%) and move them under a collapsed "More options" in the offer form. The agreement still includes them.

## 3. Hide unless relevant
- **TV and outdoor records** only show when the booking's usage includes TV or posters/print.
- **Options** and **shared shortlists** become small secondary buttons, not board sections (options list stays on talent Today).
- **Usage watch** panel on talent Today only shows when something needs a look.

## 4. Tone and demo data
- Remove jargon from brand-facing screens: OOH, clock number (say "TV ad ID" with a help line), buyout, territory.
- Re-seed demo data to Embr's market: e.g. a Birmingham streetwear label, a Manchester coffee shop, an independent skincare brand; local day rates (roughly £150–£400 for new faces); Instagram-led usage; fewer "All media" / TV examples.
- Offer form should fit comfortably on a phone; check at 390px width.

## Done when
Phone booking flow is short and jargon-free, all earlier features still work behind the scenes, everything is published and saved to the EMBR folder, and the build log is updated.
