# Cloudflare Pages free plan: commercial use and limits

Question: Do Cloudflare's terms allow Embr (a commercial marketplace, not yet incorporated) to host its pilot app on the free plan of Cloudflare Pages, and do the free-plan limits cover the pilot's needs?

Answer in short: None of Cloudflare's current terms or plan pages restricts the free plan to personal or non-commercial use, and none says commercial use is allowed either. The one free-plan rule that touches Embr is section 2.2.1(h) of the Self-Serve Subscription Agreement: no collecting or processing credit card information on a web property that gets Free Services. Embr's app sends every card, bank and ID entry to pages hosted by Stripe, so it does not collect card details itself. That is our reading of the wording, not a ruling from Cloudflare. The pilot uses a small fraction of every Pages free-plan limit.

## Findings

### Terms

- The agreement for self-serve and free customers is the Cloudflare Self-Serve Subscription Agreement. It "governs the use of Cloudflare's cloud-based solutions that are provided as part of a subscription or require a Cloudflare account" (§1). Page dated "Last Updated September 12, 2025". [Self-Serve Subscription Agreement](https://www.cloudflare.com/terms/), checked 2026-11-23
- No personal, hobby, non-commercial or commercial-use wording about the free plan appears in the Self-Serve Subscription Agreement, the Service-Specific Terms or the Free plan page. [Self-Serve Subscription Agreement](https://www.cloudflare.com/terms/), [Developer Platform terms](https://www.cloudflare.com/service-specific-terms-developer-platform/), [Free plan page](https://www.cloudflare.com/plans/free/), all checked 2026-11-23
- §2.2.1 opens: "Unless otherwise expressly permitted in writing by Cloudflare, you will not and you have no right to:" and item (h) reads: "(h) process or collect personal or business credit card information on any web property that is receiving Free Services (as defined below);". [Self-Serve Subscription Agreement](https://www.cloudflare.com/terms/), checked 2026-11-23
- §2.6 defines Free Services: "We may offer free or trial versions of the Services ("Free Services") from time to time." A free service can end on "(c) termination of the Free Service by Cloudflare in our sole discretion", and "We will have no liability for any harm or damage arising out of or in connection with any Free Services." [Self-Serve Subscription Agreement](https://www.cloudflare.com/terms/), checked 2026-11-23
- §8 lets Cloudflare suspend or terminate an account "with or without notice for any reason or no reason at all." [Self-Serve Subscription Agreement](https://www.cloudflare.com/terms/), checked 2026-11-23
- The Developer Platform terms name Cloudflare Pages and say: "Unlike most Cloudflare products, the Developer Platform can be used to host content." Page dated "Last updated: September 28, 2026". [Developer Platform terms](https://www.cloudflare.com/service-specific-terms-developer-platform/), checked 2026-11-23
- The same page says Cloudflare "may change Cloudflare Workers/Pages subdomain names of projects hosted at workers.dev or pages.dev for any or no reason" (custom domains are not covered by this), that it "may temporarily limit your storage and/or the number of requests you can make or receive", and that it "has no obligation to retain the Customer Content you upload to the Developer Platform following the expiration or termination of your trial or subscription." [Developer Platform terms](https://www.cloudflare.com/service-specific-terms-developer-platform/), checked 2026-11-23
- The old "section 2.8" limit on serving non-HTML content was replaced. The current rule sits in the CDN section of the Application Services terms: outside Enterprise, Cloudflare offers paid services "(e.g., the Developer Platform, Images, and Stream) that you must use in order to serve video and other large files via the CDN", and may limit use of the CDN "to serve video or a disproportionate percentage of pictures, audio files, or other large files." Whether a free Pages project counts as one of those services is not stated. [Application Services terms](https://www.cloudflare.com/service-specific-terms-application-services/), [Cloudflare blog: Goodbye, section 2.8](https://blog.cloudflare.com/updated-tos/), checked 2026-11-23

### Pages free-plan limits (page dated "Last updated Nov 19, 2026")

All from [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/), checked 2026-11-23:

- Builds per month: "500". Builds at once: "1 build at a time". "Builds will timeout after 20 minutes."
- Files: "up to 20,000 files on the Free plan". Single file: "The maximum file size for a single Cloudflare Pages site asset is 25 MiB."
- Custom domains per project (Free): "100". Projects: "a limit of 100 projects per account".
- `_headers`: "a maximum of 100 header rules". `_redirects`: "a maximum of 2,000 static redirects and 100 dynamic redirects, for a combined total of 2,100 redirects."
- Deployments kept: the "100 most recent" plus the current production deployment, for "30 days".
- Functions: "Requests to Pages functions count towards your quota for Workers plans".

### Requests and Functions (page dated "Last updated Nov 18, 2026")

From [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), checked 2026-11-23:

- "Requests to static assets are free and unlimited."
- Pages Functions "are billed as Workers". Workers Free plan: "100,000 per day" requests and "10 milliseconds of CPU time per invocation".

### What the pilot needs (measured in this repo, 2026-11-23)

- `npm run build` output: 18 files, 536 KB in total. Largest file: `assets/common-*.js` at 269,293 bytes.
- No Pages Functions: the app is static. All server code runs on Supabase Edge Functions (`docs/dev/architecture.md`).
- `public/_headers`: 3 rules. `public/_redirects`: 3 rules.
- Photos are stored in Supabase Storage (`src/api.js`), not on Cloudflare. Video is added as links to other sites (`src/views/common.js`).
- Card payments use Stripe Checkout sessions created on the server and opened by redirect (`supabase/functions/_shared/payments.ts`, `src/views/booking.js`). ID checks use Stripe Identity's hosted page and payouts use Stripe Connect onboarding links, both by redirect. No Stripe.js or embedded card form is loaded on Embr's pages.

## What this means for Embr

1. **Commercial use:** nothing found forbids it on the free plan. This is an absence of a restriction, not a written permission.
2. **Card details (§2.2.1(h)):** keep every card entry on Stripe-hosted pages (Checkout, Identity, Connect onboarding) for as long as Embr is on the free plan. Do not add an embedded card form (Stripe Elements or embedded Checkout) to the Pages site without first moving to a paid plan or getting Cloudflare's written OK. Whether a redirect to Stripe counts as "process or collect" on Embr's web property is our reading, not Cloudflare's. A written answer from Cloudflare would remove the doubt (contacting them is Luke's call).
3. **Limits:** the pilot uses 18 of 20,000 files, a largest file of about 1% of 25 MiB, 3 of 100 header rules, 3 of 2,100 redirects and zero Function requests. Static requests are free and unlimited. Builds are not a concern for drag-and-drop uploads.
4. **Video and large files:** not a Cloudflare issue today, because photos sit in Supabase and videos are external links.
5. **Risk to plan for:** Cloudflare can end a Free Service or suspend an account at its discretion, can rename a `pages.dev` subdomain, and keeps no copy of content after termination. Keep the source in GitHub (already done) so the site can be redeployed anywhere in minutes, and put the app on Embr's own domain once Luke approves buying one (task R2), since custom domains are protected from the subdomain rename.
6. **Agency position:** not touched by this question.

## Unverified / to measure

- Whether Cloudflare treats a redirect to Stripe-hosted Checkout as "process or collect" credit card information under §2.2.1(h): unverified: needs a written answer from Cloudflare.
- Whether a free Pages project is one of the "Paid Services" the CDN section names: not stated in the terms.
- Whether direct (drag-and-drop) uploads count towards the 500 builds a month: not stated on the limits page.
- SETUP.md says Vercel's free plan does not allow commercial use: unverified: no source recorded.
- Parts of the Self-Serve agreement after §8 and part of the 2.8 blog post were read from summaries, not verbatim. Nothing quoted above comes from those parts.

## Sources

- [Cloudflare Self-Serve Subscription Agreement](https://www.cloudflare.com/terms/) (Last Updated September 12, 2025), checked 2026-11-23
- [Service-Specific Terms: Developer Platform](https://www.cloudflare.com/service-specific-terms-developer-platform/) (Last updated September 28, 2026), checked 2026-11-23
- [Service-Specific Terms: Application Services](https://www.cloudflare.com/service-specific-terms-application-services/) (Last updated September 28, 2026), checked 2026-11-23
- [Cloudflare Free plan](https://www.cloudflare.com/plans/free/) (no date shown), checked 2026-11-23
- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/) (Last updated Nov 19, 2026), checked 2026-11-23
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) (Last updated Nov 18, 2026), checked 2026-11-23
- [Cloudflare blog: Goodbye, section 2.8 and hello to Cloudflare's new terms of service](https://blog.cloudflare.com/updated-tos/) (published 2023-05-16), checked 2026-11-23
- [Cloudflare Website Terms of Use](https://www.cloudflare.com/website-terms/) (Effective August 1, 2025; these do not cover Pages), checked 2026-11-23
