# Embr booking agreement: text for solicitor review

Version `pilot-2026-11-v2`, exported 2026-11-26, updated the same day for Luke's brand snag list (date ranges, every skill booked, day rate and usage fee named apart, any usage length from 1 to 120 months). Source: the `_agreement` SQL function in `supabase/migrations/20261126000002_brand_snags.sql`, function at line 92, agreement text at lines 100 to 153, values filled in at lines 154 to 176. This is the latest migration that defines `_agreement`. The test `npm run test:agreement` checks that the text below still matches that function word for word.

**Status: DRAFT.** Waiting for the BPP Enterprise Clinic review (workflow-state D4). Not shown to real brands. Research behind this version: https://claude.ai/artifact/PNFUMcKEETLqD9a22oHoC8

## For the solicitor: what this is

Embr is a UK marketplace, in an invite-only pilot, where brands (the "Client") book unsigned models and creatives (the "Talent") directly. Brands search Embr, make an offer, and the Talent accepts or declines. Embr runs the booking software and takes payments through Stripe. Embr is not incorporated yet, and the app is not online yet.

The agreement is not a fixed document. A new copy is generated for every booking, when the Client sends the offer (or when a Client books through a Talent's booking link). The parts in `{curly_brackets}` below are filled in from that booking and from Embr's settings at that moment. The filled-in text is then stored with the booking.

What changed from `pilot-2026-11`: plain-English section headings; the Talent's self-employed status in section 1; hours per day in section 2; usage picked from fixed options and written out as sentences in section 5 (where, how long from first use with a 6-month backstop, which countries, what's included, what happens when it ends, archive use, AI); a new section 11 on signing and governing law. Fees, payment, cancellation, disputes and the 12-month clause are unchanged.

How each side agrees, from the app code:

- **Client:** the offer is recorded as agreed by the Client when it is sent (`brand_agreed_at`, set in `_new_booking`, `supabase/migrations/20261126000002_brand_snags.sql`, line 197). The Client ticks "I accept the Embr booking agreement" on the offer form.
- **Talent (offers):** before accepting, the Talent sees a plain-English summary (pay, the day, photo use, cancellation), can open the full text, types their full name and ticks "I've read the agreement and I'm 18 or over. Typing my name here is my signature, the same as signing on paper." (`src/views/contract.js`, `reviewSheet`). The database refuses an acceptance without a typed name of at least two letters (`respond_offer`, `supabase/migrations/20261126000001_booking_contract.sql`, line 222).
- **Talent (booking links):** the Talent sets the terms, types their name and ticks the same statement when creating the link (`create_link`, same file, line 251). The agreement becomes binding when a Client books through the link.
- **The record:** each booking keeps the typed name, the time, the agreement version and a SHA-256 fingerprint of the exact text signed (`talent_signed_name`, `talent_agreed_at`, `agreement_version`, `agreement_sha`). Both sides can reopen the text and save a copy (a text file with the signature record) from the booking at any time.

The Talent line in section 1 names every skill the Talent is booked for, such as `Talent: {talent_name} (booked as: Model and UGC creator)`. A booking can cover several of a creative's skills.

## Where each filled-in part comes from

"Booking" means the booking record. "Settings" means Embr's single settings record (current values are the defaults in `supabase/migrations/20261123000001_embr_pilot.sql`, lines 17 to 29, with `agreement_version` now `pilot-2026-11-v2`).

| Placeholder | What it is | Where it comes from |
|---|---|---|
| `{booking_ref}` | Booking reference, such as EMB-ABC123 | Booking: generated reference |
| `{agreement_version}` | Version label | Settings: `agreement_version` |
| `{brand_name}`, `{talent_name}` | The two parties | Their Embr profiles |
| `{booked_as}` | " (booked as: Model and UGC creator)": every skill on this booking | Booking: `roles` (`_and_list`) |
| `{job_title}` | What the job is | Booking: typed by the Client |
| `{dates}` | "Saturday 5 December 2026", or for longer bookings "Thursday 10 December 2026 to Friday 11 December 2026 (2 days)" | Booking: shoot date and days (`_date_range`) |
| `{location}`, `{call_time}` | Where and when | Booking; if blank, "To be confirmed in Embr messages" |
| `{hours}` | "Up to 10 hours a day, including breaks. Anything longer must be agreed in Embr messages first." | Booking: hours per day (1 to 16); if blank, "As agreed in Embr messages" |
| `{session_fee}`, `{days}`, `{days_plural}`, `{day_rate}` | Day rate times days | Booking |
| `{usage_with_fee}` | The usage fee, then what it covers: "£150 for Own social posts, Website and shop · 18 months · UK", or "£0 (no separate usage fee) for …" | Booking: usage fee and `usage_terms` (or the older free-text `usage`) |
| `{talent_fee}`, `{embr_fee}`, `{fee_rate}`, `{fee_label}`, `{total}` | The money | Worked out from the booking; fee tiers from Settings |
| `{deposit_rate}`, `{deposit}`, `{balance}` | Deposit and balance | Settings (`deposit_rate`, 50%) and the booking |
| `{auto_signoff_hours}` | Hours to sign off or report a problem | Settings (72) |
| `{usage_terms}` | Section 5 in full: one line per place the photos can be used (each named, never "all of it"), then how long, where, what's included, what happens when it ends, archive use, AI, and that anything else needs a new booking | `_usage_clause`, line 72. Bookings made before this version show the old free-text usage instead |
| `{content_agreed}` | What the Talent agreed to do | Booking; if blank, "As described in the job above." |
| `{free_cancel_days}`, `{late_cancel_share}`, `{late_cancel_amount}` | Cancellation | Settings (7 days, 50%) and the booking |
| `{signing}` | How each side signed: by offer and typed name, or by booking link | Whether the booking came from a booking link |

The fixed usage options and their wording (section 5): "Posts on the Client's own social media, such as Instagram and TikTok. Not paid ads." · "Paid ads on social media and other websites." · "The Client's website and online shop." · "The Client's emails and newsletters." · "In the Client's shops and in print, such as posters, lookbooks and flyers." · "Billboards, bus stops and other outdoor posters and screens." · "Ads on TV, streaming services and in cinemas." · "On the Client's product packaging." Periods: any whole number of months from 1 to 120 (the app offers 3, 6, 12 and 24 as presets, plus a custom length). Areas: the UK, the UK and Europe, anywhere in the world.

## The agreement text

Exactly as the function produces it, with placeholders for the filled-in parts.

<!-- agreement:start -->
```text
EMBR BOOKING AGREEMENT  {booking_ref}
Pilot version {agreement_version}. Draft for the invite-only pilot, waiting for review by a solicitor. Not legal advice.

1. Who this is between
Client: {brand_name}
Talent: {talent_name}{booked_as}
Embr provides the booking software and takes payments through its payment provider, Stripe. Embr is not an agency: it does not find work for the Talent, and the Client chose and booked the Talent.
The Talent confirms they are 18 or over, have passed Embr's ID check, and are self-employed and responsible for their own tax.

2. The job
{job_title}
{dates}
Location: {location}
Call time: {call_time}
Hours: {hours}

3. The money
Day rate for the Talent's time (basic studio fee): {session_fee} ({days} day{days_plural} at {day_rate})
Usage fee for using the photos and video: {usage_with_fee}
Talent fee: {talent_fee}. The Talent receives this in full. Embr takes no commission from the Talent.
Embr booking fee, paid by the Client: {embr_fee} ({fee_rate}, {fee_label})
Total for the Client: {total}

4. When the money moves
a) Deposit: {deposit_rate} of the total ({deposit}), paid by the Client when the Talent accepts. The booking is confirmed once it is paid. Stripe holds it until sign-off.
b) Balance: {balance}, charged to the same card at sign-off.
c) After the shoot the Talent marks the job wrapped. The Client signs off, or reports a problem, within {auto_signoff_hours} hours. If the Client does neither, the booking signs off automatically.
d) At sign-off the Talent is paid the full talent fee.

5. What the Client can do with the photos
{usage_terms}

6. What the Talent will be asked to do
{content_agreed}
Nothing outside this may be asked of the Talent on the day. The Talent may bring a chaperone.

7. If plans change
a) Client cancels {free_cancel_days} or more days before the shoot: the deposit is refunded in full.
b) Client cancels less than {free_cancel_days} days before the shoot: the Talent is paid {late_cancel_share} of the day rate ({late_cancel_amount}) from the deposit and the rest is refunded.
c) Talent cancels: the Client's deposit is refunded in full.

8. If something goes wrong
If the Client reports a problem, nothing is paid out until Embr has heard from both sides. Embr then decides how the money held is split, in line with this agreement.

9. Booking through Embr
For 12 months after this booking, the Client agrees to book this Talent through Embr.

10. The Talent's own use
Unless agreed otherwise in messages, the Talent may use the images in their portfolio after the Client has published them.

11. Signing
{signing}
Both are electronic signatures and bind each side as if signed on paper. Embr keeps the signed copy, and either side can save a copy from the booking at any time.
This agreement is governed by the law of England and Wales.
```
<!-- agreement:end -->

## Questions for the solicitor

These are only points that can be seen in the text above. They are questions, not conclusions.

1. **Who the parties are.** Embr has no legal name, address or company number yet (not incorporated). Is Embr meant to be a party, and how should it be named once incorporated?
2. **Embr's role.** Section 1 says "Embr is not an agency". Sections 8 and 9 give Embr a role in splitting held money and a 12-month booking commitment. Is that consistent?
3. **Signing.** Section 11 says the Talent's typed name and the Client's sent offer are electronic signatures that bind like paper. We relied on the Law Commission's 2019 report on electronic execution (typed names and "I accept" boxes). Is this wording right, and is the record we keep (name, time, version, SHA-256 of the text) enough evidence?
4. **Booking links.** The Talent signs when creating the link, before the Client adds the location and call time. Is a signature given in advance valid for the final text?
5. **Usage from first use.** Section 5 starts the period when the first item goes live, with a 6-month backstop from the shoot. Is this clear and enforceable?
6. **What survives the period.** Old posts may stay up; the Client may keep the photos for its archive, awards and press about the shoot. Is that scope acceptable for the Talent, and clear for the Client?
7. **Countries.** "Posts on the Client's own pages can be seen from anywhere; paid ads and posters are aimed at" the chosen area. Is that workable?
8. **AI.** "No AI changes to the Talent's face, body or voice, and nothing used to train AI, unless both sides agree in writing in Embr." Is "in writing in Embr" (a message) enough?
9. **Who owns the images.** The text grants permission to use the Talent's likeness but says nothing about copyright, which usually sits with the photographer. Should it?
10. **Automatic sign-off, cancellation, the 12-month clause and messages.** As in the 2026-11-24 export: is it clear what the Client gives up at automatic sign-off; are other cancellation cases worth covering; is section 9 enforceable without a stated consequence; can messages change the agreement?
11. **Self-employed line.** Section 1 now has the Talent confirm they are self-employed and handle their own tax. Is that appropriate here, given Embr's agency position?
12. **Governing law.** Section 11 picks England and Wales. Is that right for Talent or Clients in Scotland or Northern Ireland?
13. **The draft line.** Should "Draft for the invite-only pilot, waiting for review by a solicitor. Not legal advice." stay during the pilot?
