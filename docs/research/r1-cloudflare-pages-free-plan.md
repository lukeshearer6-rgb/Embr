# R1: Cloudflare Pages free plan and commercial use
Question: Do Cloudflare's free-plan terms allow Embr (UK booking marketplace PWA, static front end on Pages, back end on Supabase) to be hosted commercially?

Answer in short: **Unclear, leaning allowed.** The terms I could read contain no clause that bars commercial use on the Free plan, but none that expressly permits it either. The only free-plan wording found is "We may offer free or trial versions of the Services ("Free Services") from time to time." and Cloudflare "will have no liability for any harm or damage" from them. A specialist or Cloudflare confirmation is not needed for the pilot, but Luke should know the free tier carries no service guarantee. All figures checked 2026-11-24.

## Findings
- Self-Serve Subscription Agreement, s2.6 (Free & Trial Services): "We may offer free or trial versions of the Services ("Free Services") from time to time." Cloudflare has no liability for harm from Free Services. No commercial-use restriction found in the page text. Last updated 12 Sep 2025. [Cloudflare Self-Serve Subscription Agreement](https://www.cloudflare.com/terms/), checked 2026-11-24
- s2.2.1(b) prohibits conduct that would "create an undue burden on the Services or the networks"; s2.2.1(c) refers to service-specific usage limits. Same source.
- Use of the Services is "subject to the applicable provisions in the Service-Specific Terms" (s1). Same source.
- Developer Platform terms (cover Pages/Workers): "Cloudflare may temporarily limit your storage and/or the number of requests you can make" (s1); Cloudflare may change *.pages.dev subdomain names, and "will attempt to provide you with at least one week prior notice", but "this right does not apply to Customer's custom domains used for Workers/Pages" (s7). Last updated 28 Sep 2026. [Developer Platform Service-Specific Terms](https://www.cloudflare.com/service-specific-terms-developer-platform/), checked 2026-11-24
- Image/large-file serving: "Unless you are an Enterprise customer, Cloudflare offers specific Paid Services (e.g., the Developer Platform, Images, and Stream) that you must use in order to serve video and other large files via the CDN." Cloudflare may limit CDN access if you serve "video or a disproportionate percentage of pictures, audio files, or other large files" without them. The page does not mention Pages and does not say whether Pages is exempt. Last updated 28 Sep 2026. [Application Services Service-Specific Terms](https://www.cloudflare.com/service-specific-terms-application-services/), checked 2026-11-24
- Developer Platform terms: "Unlike most Cloudflare products, the Developer Platform can be used to host content." (s8). Same Developer Platform source as above.
- Static asset requests: "On both free and paid plans, requests to static assets are free and unlimited." [Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/), checked 2026-11-24

## Limits (Free plan)
| Item | Free | Source |
|---|---|---|
| Builds per month | 500 | [Pages limits](https://developers.cloudflare.com/pages/platform/limits/), 2026-11-24 |
| Concurrent builds | 1 | same |
| Build timeout | 20 minutes | same |
| Files per site | 20,000 | same |
| Max single file | 25 MiB | same |
| Custom domains per project | 100 | same |
| `_headers` rules | 100 | same |
| `_redirects` | 2,000 static + 100 dynamic | same |
| Static asset requests | Free and unlimited | [Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/), 2026-11-24 |
| Bandwidth (Pages) | Not listed on the limits page; unverified: needs measuring | Pages limits page |
| Functions/Workers requests | 100,000/day, resets midnight UTC; Functions count against it | [Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/); [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), 2026-11-24 |
| Workers CPU time | 10 ms per invocation | Workers limits |
| Subrequests | 50 per request | Workers limits |

## What this means for Embr
- A static PWA shell on Pages uses only static requests, which are unlimited. Builds (500/month) and files (20,000) are ample for a pilot (no measurement made of Embr's actual build count).
- Keep talent photos in Supabase Storage, not on Pages. The "disproportionate percentage of pictures" clause is the one real risk for an image-heavy app; it is unclear whether it applies to Pages-served assets. Only the app shell, icons and manifest should live on Pages.
- Do not use Pages Functions for the API; Supabase Edge Functions already do that, which avoids the 100,000/day and 10 ms limits.
- Free Services carry no liability and Cloudflare may limit requests. Fine for an invite-only pilot; revisit before public launch.
- Not legal advice. Embr is not incorporated; the account holder would be Luke personally until it is. Flag for later, no agency-position impact.

## Unverified / to measure
- Pages bandwidth cap on Free: not stated on pages read. Unverified: needs measuring.
- Whether the large-file/pictures clause applies to Pages: unverified; could ask Cloudflare support (needs Luke's approval to contact).
- Cloudflare's Free plan marketing page (https://www.cloudflare.com/plans/free/) and Pages pricing page were not read.
- The fetches were summarised by a tool, not read raw; re-check quotes against the live pages before relying on them in public copy.

## Sources
- https://www.cloudflare.com/terms/
- https://www.cloudflare.com/service-specific-terms-developer-platform/
- https://www.cloudflare.com/service-specific-terms-application-services/
- https://developers.cloudflare.com/pages/platform/limits/
- https://developers.cloudflare.com/pages/functions/pricing/
- https://developers.cloudflare.com/workers/platform/limits/

## Verification

Second pass on 2026-11-24 (orchestrator): every quote above was re-read word for word on the live pages linked. All found verbatim, except the notice wording for pages.dev subdomain changes, now corrected to the source's words. The 500 builds/month and 100 custom domains figures come from the limits tables, not from sentences. The Self-Serve terms page was only verified up to about section 8; later sections are unverified. Pages bandwidth is not stated on any page read: unverified, needs measuring.
