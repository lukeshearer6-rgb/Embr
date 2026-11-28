# Book now, pay later (R7)

Question: How can a brand book now and pay later on its normal invoice cycle while talent are paid at sign-off, without Embr lending its own money? Which UK B2B pay-later partners exist, on what terms, and is it regulated?

Answer in short: The gap must be funded by a third party that pays Embr up front and then waits for the brand. Stripe lists three B2B pay-later methods that settle to the merchant on its standard payout schedule and support Connect (Kriya, Billie, Mondu), but Kriya and Mondu are early-access, and none publishes fees on the pages I could read (Billie's Stripe price is published). The credit risk sits with the provider on the pages that say so (Two, iwocaPay, Hokodo), unverified for Kriya, Billie, Mondu. The FCA perimeter excludes lending to limited companies, but sole traders and small partnerships can be inside it, so brand eligibility matters. Whether Embr's model needs its own regulatory advice is unverified: needs specialist advice. All figures below were checked on 2026-11-28. This is research, not legal advice.

## Findings

### 1. How the gap works today and who funds it

- How money flows now (code): the brand pays a 50% deposit by card via Stripe Checkout and the card is saved; the money sits in Embr's Stripe balance; at sign-off Embr charges the balance and transfers the talent fee to the talent's connected account. Embr keeps the brand fee. [payments.ts header](/home/user/embr/supabase/functions/_shared/payments.ts), read 2026-11-28.
- Decision: book now, pay later is delivered "through a plugged-in B2B 'Klarna-style' pay-later partner, not by Embr lending its own money." Decision (Luke, 2026-11-17, confirmed 2026-11-23). [decisions.md](/home/user/embr/docs/decisions.md), read 2026-11-28.
- Decision: Embr is not incorporated and has a zero cash budget. Decision (Luke, 2026-11-18 and 2026-11-23, decisions.md "Company and team"). So Embr cannot fund the gap between paying talent at sign-off and the brand's invoice date itself. (Stated from the decisions; no figures are needed.)
- Decision: Embr already carries negative balances on talent accounts and chargebacks on its own charges. Decision (Luke, 2026-11-25), decisions.md. That is existing platform-side risk, separate from brand credit risk.
- Funding pattern in the providers' own words: Hokodo: "You get paid upfront, while your customers enjoy the freedom to pay in 30, 60 or 90 days" (its page also says "We pay you following delivery of the goods", so payment follows delivery); Two: "We pay you out the next day"; iwocaPay: "You get paid as soon as they checkout"; Stripe on Mondu: "You get paid immediately". So the provider is the one that carries the wait, and (where stated) the credit risk: Two "absorb all risk on your behalf"; iwocaPay "takes on the credit risk and admin"; Hokodo: "Your business is protected against credit and fraud risks". Billie, Kriya and Mondu: Stripe's pages do not say who carries the credit risk (unverified). Sources below.
- Disputes still come back to the merchant: Stripe holds the disputed amount from the merchant's balance on Billie, Kriya and Mondu disputes until the provider decides. [Kriya on Stripe](https://docs.stripe.com/payments/kriya), checked 2026-11-28. So Embr, as merchant, still carries dispute and refund exposure, and a talent already paid at sign-off is not recoverable from the provider by that route. Needs design in D5.

### 2. UK B2B pay-later and invoice-finance providers

| Provider | What it offers | Eligibility (published) | Fees (published) | Who pays | Payout to merchant | Stripe |
|---|---|---|---|---|---|---|
| Kriya | Invoice finance, business loans, embedded "Pay Later" at checkout | Most customers "UK limited companies or LLPs with annual turnover between £1m and £25m"; invoice finance typically 2 years trading; application form: "minimum of 12 months" and one set of accounts | Invoice finance: "Service fees from 0.25% of funded turnover and discount rates from Base Rate + 2.5%"; embedded finance "Priced per transaction", no figure | Not stated for embedded | Invoice finance: "approved invoices are funded within 24 hours"; embedded: Stripe says "Standard" payout | Yes, on Stripe (GB accounts, UK customers, GBP, Connect yes, early access) |
| Billie | B2B pay by invoice, "Pay in 30" | Merchant: GB account, B2B only; Connect platforms allowed; customer in GB; domestic only; max 25,000 GBP per payment | Stripe UK list: "3.5% + 25p" per successful charge (+2% if currency conversion) | Merchant pays Stripe's fee (Stripe page lists it as the merchant's price) | "Standard payout schedule"; Stripe: "you receive the total payment immediately" | Yes, on Stripe, Connect supported (`billie_payments` capability) |
| Mondu | 30 days net terms, pay by invoice | Customers EU and UK; GBP supported for GB accounts; maximum charge 19,999.99 EUR or equivalent | Not on Stripe's UK pricing page: unverified: needs measuring | Unverified | "Standard"; Stripe: "You get paid immediately" | Yes, Connect yes, but "monduinviteonly_preview" early access |
| Two | Net terms at checkout, 30 days to 24 months | Buyer eligibility not stated; UK not listed on the page fetched, a separate "uk buyer terms" page exists | Not stated | Not stated | "We pay you out the next day" | Not mentioned; plugins for Shopify, WooCommerce, Magento, API |
| Hokodo | B2B BNPL / trade credit, 30, 60 or 90 days | "Limited companies and sole traders accepted"; UK, FR, ES, BE, NL | Not stated | Not stated | "We pay you following delivery of the goods" | Not mentioned (Magento, Shopify via SparkLayer, REST API) |
| iwocaPay | Pay later for trade customers, up to £30,000, 1, 3 or 12 months | Merchant eligibility not stated | Option 1: merchant pays "a fixed fee of the total transaction value" (figure not stated); Option 2: customer pays interest, merchant pays nothing; "No monthly or set-up fees" | Merchant (option 1) or buyer (option 2) | "You get paid as soon as they checkout" | Not mentioned |

Notes on the table:
- Kriya (own site): [kriya.co](https://www.kriya.co), checked 2026-11-28. Kriya's Stripe page: [docs.stripe.com/payments/kriya](https://docs.stripe.com/payments/kriya), checked 2026-11-28; "Payment confirmation: Customer-initiated", "Customer locations: UK", "Payout timing: Standard", "Connect support: Yes", "Manual capture support: Yes", and "Interested in getting early access to Kriya?".
- Billie: [docs.stripe.com/payments/billie](https://docs.stripe.com/payments/billie), checked 2026-11-28: "Business model: ✓ B2B, ✗ B2C"; "Account type: ✓ Merchant, ✓ Platform or marketplace (Connect)"; "Geographic coverage: ✓ Domestic, ✗ Crossborder"; "The maximum transaction amount is 25,000 EUR or 25,000 GBP"; "Payment Intents with setup_future_usage" and "Off-session payments" are marked unsupported. Fee: [Stripe local payment methods pricing](https://stripe.com/gb/pricing/local-payment-methods), checked 2026-11-28, re-read in the verbatim page text: "3.5% + 25p per successful charge", "+ 2% if currency conversion is required".
- Mondu: [docs.stripe.com/payments/mondu](https://docs.stripe.com/payments/mondu), checked 2026-11-28.
- Two: [two.inc/sell-online](https://two.inc/sell-online), checked 2026-11-28 ("Offer net terms in under 30 seconds on your webstore"; "absorb all risk on your behalf"). The page does not list countries; whether Two serves UK merchants and brands is unverified. Two's own comparison article is marketing, so I used it only to find providers: [Two guide](https://www.two.inc/resources/two-cents-blog/the-ultimate-2026-guide-to-b2b-buy-now-pay-later-providers-in-the-uk-enterprise-smb), checked 2026-11-28.
- Hokodo: [hokodo.co](https://www.hokodo.co), checked 2026-11-28 ("Typically, 85% of your customers will be eligible" is the provider's own claim, not a measured figure for Embr's brands).
- iwocaPay: [iwoca.co.uk/iwocapay-sellers](https://iwoca.co.uk/iwocapay-sellers), checked 2026-11-28.
- Merchant eligibility (limited company, trading history) for the merchant side: Kriya states a 12-month and 2-year trading history for its invoice finance, not for Stripe embedded. Whether an unincorporated, pre-trading Embr could be accepted by any of these as a merchant is unverified: needs the provider to say; approaching them is Luke's call. Stripe's Billie page requires a GB Stripe account with a B2B business model and says nothing about incorporation.
- Merchant category fit: Kriya's Stripe page lists "Advertising Services", "Special Trade Services" and "Miscellaneous General Services" as prohibited categories; Billie lists "General Services" (MCC 1520) as prohibited; Mondu lists "Buying/Shopping Services" and "Other categories at the discretion of Mondu". Which category Embr (a talent booking marketplace) would be classed under is unverified: needs measuring with Stripe/provider.

### 3. Stripe's own options

- Stripe Invoicing: invoices with `collection_method=send_invoice` and `days_until_due` (their example: `days_until_due=30`); "For Stripe to mark an invoice as past due, you must add the days_until_due parameter." [Integrate with the Invoicing API](https://docs.stripe.com/invoicing/integration), checked 2026-11-28. This gives the brand its invoice cycle but Stripe does not advance the money: Embr would wait for the brand to pay, so it does not fund talent at sign-off. Invoice terms alone solve the paperwork, not the funding gap.
- Stripe pay-later payment methods supported for B2B: Billie, Kriya and Mondu (above), plus Klarna (a consumer product; Stripe lists customer countries AU, AT, BE, CA, FI, FR, DE, CH, not GB). [Payment method support](https://docs.stripe.com/payments/payment-methods/payment-method-support), checked 2026-11-28. Billie and Mondu lines in "Buy now, pay later product support" show Connect, Invoicing support noted for Billie.
- Product limits that bite Embr's current design: Billie "Payment Intents with setup_future_usage" and "Off-session payments" are unsupported, Kriya and Mondu are "Customer-initiated". Embr's current auto-charge of a saved card at 72-hour auto sign-off would therefore not work for the pay-later balance as designed; the brand would have to authorise the pay-later method at booking or at balance time. Whether authorise-then-capture (Billie and Kriya both list "Manual capture: Yes") can span the shoot-to-sign-off window is unverified: needs a sandbox test (Luke has allowed test-mode Stripe changes, CLAUDE.md approval gates).
- Separate charge and transfer is supported for Billie (Connect table, descriptor taken from the platform). Same pages above.

### 4. Regulation

- FCA perimeter: "Our regulatory perimeter extends to business lending where the borrowing is under £25,000" for sole traders, small partnerships (2 or 3 partners) or unincorporated bodies; "Lending to limited companies, Limited Liability Partnerships (LLPs), and partnerships with more than 3 partners" is outside it. [FCA perimeter report](https://www.fca.org.uk/publications/corporate-documents/fca-perimeter-report), checked 2026-11-28 (via page fetch).
- FCA discussion paper wording: lending of "£25,000 or less to sole traders and small partnerships, but not limited companies" falls in the perimeter (para 2.11); "Business lending above £25,000 would generally fall outside this perimeter." [FS26/2](https://www.fca.org.uk/publication/feedback/fs26-2.pdf), checked 2026-11-28. The two FCA documents differ on whether £25,000 itself is in or out; either way treat the boundary as unsettled.
- Legislation: Article 60C(3) of the Regulated Activities Order: a credit agreement is an exempt agreement if "the lender provides the borrower with credit exceeding £25,000" and it is entered "wholly or predominantly for the purposes of a business". [SI 2001/544 art 60C](https://www.legislation.gov.uk/uksi/2001/544/article/60C), checked 2026-11-28. I did not read the full article, the other exemptions or the current Consumer Credit Act reform; the FCA paper says HMT is reforming the Consumer Credit Act (para 4.5).
- Practical reading (not a legal conclusion): the regulatory position of the pay-later provider depends on who the brand is (limited company vs sole trader) and the amount. Embr's own position as an introducer or merchant in the chain: unverified: needs specialist advice. Luke's BPP clinic enquiry may be a route, but he decides what to ask (see r6).
- ASA/CAP: "Delayed payment services" guidance (25 Apr 2025) "advises advertisers on how to ensure consumers understand that the service being offered comprises a form of credit"; the page refers to consumers and does not say whether B2B ads are covered. [ASA guidance](https://www.asa.org.uk/resource/guidance-on-advertising-delayed-payment-services.html), checked 2026-11-28. Already noted in [r6-cap-code-checklist.md](/home/user/embr/docs/research/r6-cap-code-checklist.md): do not use "book now, pay later" publicly until the product exists and wording is reviewed.
- Agency position and Decision (Luke, 2026-11-20): not touched by this feature (brand side only). Do not describe it to talent as "get paid instantly" until evidence is held (r6, rule 3.7).

## What this means for Embr

- A third party must pay Embr up front for pay-later to work at zero cash. The three Stripe-listed methods do this on a standard payout, so they are the closest fit with the existing Connect code. They do not publish merchant fees (except Billie's Stripe fee) and Kriya and Mondu are early-access.
- The existing saved-card, auto-sign-off charge cannot simply be reused: Billie bars off-session payments and Kriya and Mondu are customer-initiated. D5 needs a different flow (for example brand chooses pay later at the balance step while present) and a decision on manual capture.
- Embr stays exposed to disputes on a charge it has already transferred to talent. This needs the developer to model it, and a Luke decision on who absorbs it.
- Eligibility: most providers target limited companies, so tiny or sole-trader brands may be declined. The pilot's brands are not known to be incorporated: unverified: needs measuring.
- Embr is not incorporated and may be a poor fit for a partner that checks the merchant's trading history. Luke has chosen to run as a pilot until he pays for incorporation, so this is expected to wait.

## Options

| Option | Fit | Cost to Embr | Blocker |
|---|---|---|---|
| A. Stripe-listed Kriya (UK only) | Best Stripe/Connect fit, GBP | Unverified | Early access; merchant category rules |
| B. Stripe-listed Billie | Fully documented, GB, Connect, 25,000 GBP cap | "3.5% + 25p" per charge (Stripe UK page) | Merchant pays; no off-session; category rules |
| C. Direct partner (Hokodo, Two, iwocaPay) | Strong stated risk transfer | Unverified | Needs custom integration (no Stripe on their pages); Two's UK coverage unverified |
| D. Stripe invoicing with terms only | Simple, in docs | Stripe's price: unverified | Does not fund the gap, Embr waits |
| E. Wait until incorporated | No contact needed | None | Delays the feature |

## Decisions for Luke

1. Whether to approach any partner. Approaching or signing up with a provider or requesting early access is Luke's call; I have contacted nobody.
2. Which of A, B or C to explore first, and whether Embr or the brand pays the fee (Billie lists it as the merchant's price).
3. Who absorbs disputes after talent are paid.
4. Whether to ask BPP/a specialist about the regulatory position of the partner model.
5. Whether a sandbox test of Billie or Kriya manual capture (test mode, allowed) should be run before choosing.

## Unverified / to measure

- Kriya, Mondu, Two, Hokodo fees for a merchant like Embr. Billie's "3.5% + 25p" was re-confirmed in the verbatim Stripe page text on 2026-11-28.
- Credit-risk allocation for Kriya, Billie, Mondu.
- Whether Two serves UK merchants, and whether any provider accepts an unincorporated merchant.
- Embr's merchant category and its acceptance by each provider.
- How many pilot brands are limited companies vs sole traders.
- Whether manual capture can hold across the shoot-to-sign-off window.
- Full text of the ASA PDF, the full RAO article and current FCA/HMT consumer-credit reform status; FCA's two pages I tried directly (consumer credit authorisation, business lending) failed to load.

## Sources

- https://www.hokodo.co
- https://www.kriya.co
- https://docs.stripe.com/payments/kriya
- https://docs.stripe.com/payments/billie
- https://docs.stripe.com/payments/mondu
- https://docs.stripe.com/payments/payment-methods/payment-method-support
- https://stripe.com/gb/pricing/local-payment-methods
- https://docs.stripe.com/invoicing
- https://docs.stripe.com/invoicing/integration
- https://two.inc/sell-online
- https://www.two.inc/resources/two-cents-blog/the-ultimate-2026-guide-to-b2b-buy-now-pay-later-providers-in-the-uk-enterprise-smb
- https://iwoca.co.uk/iwocapay-sellers
- https://www.fca.org.uk/publications/corporate-documents/fca-perimeter-report
- https://www.fca.org.uk/publication/feedback/fs26-2.pdf
- https://www.legislation.gov.uk/uksi/2001/544/article/60C
- https://www.asa.org.uk/resource/guidance-on-advertising-delayed-payment-services.html
- /home/user/embr/supabase/functions/_shared/payments.ts, /home/user/embr/docs/decisions.md, /home/user/embr/docs/research/r6-cap-code-checklist.md

## Verification

Re-checked 2026-11-28 by a separate page fetch of each source, quotes compared with the live text:

- Billie (docs.stripe.com/payments/billie): GB merchants, "✓ B2B, ✗ B2C", "25,000 EUR or 25,000 GBP" maximum, "✗ Off-session payments", Connect supported. Confirmed.
- Stripe UK pricing: Billie "3.5% + 25p per successful charge", "+ 2% if currency conversion is required". Confirmed (an automated summary missed the row; the verbatim text has it).
- Kriya and Mondu: early access ("kriya_preview", "monduinviteonly_preview", Mondu waitlist), "Customer-initiated", "Connect support / Yes". Confirmed.
- SI 2001/544 art 60C(3)(a) "credit exceeding £25,000" and (b) "wholly or predominantly for the purposes of a business". Confirmed; the exemption is in 60C(3).
- Hokodo: "Get paid upfront", "We pay you following delivery of the goods", protection "against credit and fraud risks". Wording corrected above.
- Two: "We pay you out the next day and take on the risk"; "absorb all risk on your behalf". Confirmed.

