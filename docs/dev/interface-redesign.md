# Interface redesign, round 1 (2026-11-25)

Luke asked (2026-11-25): "use mobbin now to create the best possible interface for embr". The current look (editorial type, hairlines, Embr orange) already works, so this round keeps the design system and fixes the places where a person has to decide without the information beside them. Each change is backed by real products on Mobbin.

Before and after: `docs/dev/redesign/before-after-2026-11-25.png`.

## What changed

| Screen | Problem | Change | Mobbin references |
|---|---|---|---|
| Brand: brief, "Best fit for this brief" | The ranking rule was one paragraph above the cards, so a brand couldn't see why each person was listed. Cards were narrow enough that names wrapped. | Each person now has a short checked list: free on the shoot date, based in the city (or travels from theirs), day rate against the brief's rate (shown with a dash, not a tick, when it's over), matches the model details. Cards are wider. | [Pin](https://mobbin.com/screens/5a8800a2-0136-4d9e-a0e5-07d4ba3547f9), [Wrangle](https://mobbin.com/screens/6c237e82-6834-432d-87f5-17ea5ed042e6), [Braintrust](https://mobbin.com/screens/4c9b09e2-da0b-444d-943d-3e5d4a904e12), [Upwork](https://mobbin.com/screens/f41023df-1d3c-4475-9da3-e1badf760f1a) |
| Talent: new offer (phone) | "You get" was in the money section further down the sheet, below the fold, while Accept sat in the sticky footer. | The footer now shows "You get £X", with "0% commission · paid at sign-off", above Decline and Accept. | [inDrive](https://mobbin.com/screens/4c99dcda-0755-4328-b218-3190c91ca2cf), [Airtasker](https://mobbin.com/screens/33b33f26-c6e5-4c8b-b380-6c18697a5232), [Orb Social](https://mobbin.com/screens/06f4d8a7-6958-42c0-9ab8-2160d996842a) |
| Talent: Today | For a new profile, the next setup step sat below a £0 earnings block and the three 0 tiles. New offers to answer also sat below them. | Offers to answer and, while the profile is unfinished and nothing has been earned yet, the setup panel now come straight after the greeting. Once earning, the money leads again. | [eBay](https://mobbin.com/screens/c34eb0ce-e449-4cc2-8d71-bc495c685aae), [Shopify](https://mobbin.com/screens/fc78e9ee-0629-4e84-a80d-89090a648363), [Grailed](https://mobbin.com/screens/990269d1-9388-4ff8-a933-85ee985e1e3a), [Deel](https://mobbin.com/screens/7821ba68-6ece-441d-ba3e-490e49ac1f39) |

Not taken: match percentages or scores (Juicebox, Employment Hero). A ticked list says what is true; a score invents precision the ranking doesn't have.

## Rules kept

- No talent route to briefs or jobs; nothing new talent can apply to. The fit list is brand-only.
- Same tokens, type and components. No new colours, fonts or libraries.
- No money logic touched: the footer shows `talent_fee_p`, the figure the sheet already showed.

## Walked and kept as they are

The brand board, talent profile sheet, welcome screen and admin People list were walked and not changed this round. Candidates for a later round: brand "Jobs" tab label (vs "Briefs"), and icons on the phone tab bar.
