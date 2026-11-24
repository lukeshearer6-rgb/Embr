# Embr booking agreement: text for solicitor review

Exported 2026-11-24 for task D4. Source: the `_agreement` SQL function in `supabase/migrations/20261123000001_embr_pilot.sql`, function at line 373, agreement text at lines 381 to 429, values filled in at lines 430 to 447. This is the only migration that defines `_agreement`. The test `npm run test:agreement` checks that the text below still matches that function word for word.

## For the solicitor: what this is

Embr is a UK marketplace, in an invite-only pilot, where brands (the "Client") book unsigned models and creatives (the "Talent") directly. Brands search Embr, make an offer, and the Talent accepts or declines. Embr runs the booking software and takes payments through Stripe. Embr is not incorporated yet, and the app is not online yet.

The agreement is not a fixed document. A new copy is generated for every booking, when the Client sends the offer. The parts in `{curly_brackets}` below are filled in from that booking and from Embr's settings at that moment. The filled-in text is then stored with the booking and does not change afterwards, even if the settings change later.

How each side agrees, from the app code:

- **Client:** the offer is recorded as agreed by the Client when it is sent (`brand_agreed_at` is set to the time of the offer; `supabase/migrations/20261123000002_multi_role.sql`, line 272).
- **Talent:** before accepting, the Talent sees the full text and must tick "I've read and accept the booking agreement, and I'm 18 or over." (`src/views/booking.js`, line 206). Both sides can reopen the text from the booking at any time (`src/views/booking.js`, line 149).

One change is made after the text is generated: the Talent line in section 1 also names the role they were booked for, so it reads `Talent: {talent_name} (booked as: {role})`, for example "(booked as: Model)" (`supabase/migrations/20261123000002_multi_role.sql`, lines 274 to 275). The text below shows the function's output before that change, so it can be checked against the function exactly.

## Where each filled-in part comes from

"Booking" means the booking record the Client created with the offer. "Settings" means Embr's single settings record. Current settings values are the defaults in `supabase/migrations/20261123000001_embr_pilot.sql`, lines 17 to 29 (checked 2026-11-24).

| Placeholder | What it is | Where it comes from |
|---|---|---|
| `{booking_ref}` | Booking reference, such as EMB-ABC123 | Booking: generated reference |
| `{agreement_version}` | Version label of the agreement | Settings: `agreement_version` (currently `pilot-2026-11`) |
| `{brand_name}` | The Client's name | The Client's Embr profile |
| `{talent_name}` | The Talent's name | The Talent's Embr profile |
| `{job_title}` | What the job is | Booking: title typed by the Client |
| `{shoot_date}` | Shoot date, written like "Saturday 5 December 2026" | Booking: shoot date |
| `{days_phrase}` | " for 3 days" when the booking is longer than one day, otherwise blank | Booking: number of days (1 to 14) |
| `{location}` | Shoot location | Booking; if blank, "To be confirmed in Embr messages" |
| `{call_time}` | Call time | Booking; if blank, "To be confirmed in Embr messages" |
| `{session_fee}` | Day rate times days, in pounds | Worked out from the booking |
| `{days}`, `{days_plural}` | Number of days, and "s" when more than one | Booking |
| `{day_rate}` | Day rate in pounds | Booking: day rate set in the offer |
| `{usage_with_fee}` | Usage description, then the usage fee in brackets, or "(included)" when there is no usage fee | Booking: usage text typed by the Client (if blank, "None agreed") and usage fee |
| `{talent_fee}` | Session fee plus usage fee | Worked out from the booking |
| `{embr_fee}` | Embr's booking fee, paid by the Client | Talent fee times the fee rate, rounded to the penny |
| `{fee_rate}` | Fee rate, written like "10.0%" | Settings tiers, chosen when the offer is made: first booking with this Talent, repeat booking, fifth booking onwards, or booking-link job |
| `{fee_label}` | Why that rate applies, in lower case, such as "first booking with this person", "booking 2 with this person" or "booking link rate" | Same as the fee rate |
| `{total}` | Talent fee plus Embr fee | Worked out from the booking |
| `{deposit_rate}` | Deposit share, written like "50%" | Settings: `deposit_rate` (currently 50%) |
| `{deposit}` | Total times the deposit share, rounded to the penny | Worked out from the booking |
| `{balance}` | Total minus deposit | Worked out from the booking |
| `{auto_signoff_hours}` | Hours the Client has to sign off or report a problem | Settings: `auto_signoff_hours` (currently 72) |
| `{usage_terms}` | Usage description again | Booking: usage text; if blank, "No usage agreed beyond the Client's internal use." |
| `{content_agreed}` | What the Talent has agreed to do on the day | Booking: typed by the Client; if blank, "As described in the job above." |
| `{free_cancel_days}` | Free cancellation cut-off in days (appears twice) | Settings: `free_cancel_days` (currently 7) |
| `{late_cancel_share}` | Share of the session fee paid to the Talent on a late Client cancellation, written like "50%" | Settings: `late_cancel_share` (currently 50%) |
| `{late_cancel_amount}` | Session fee times that share, in pounds | Worked out from the booking |

Amounts are shown in pounds with a £ sign, with no pence when the amount is whole (for example £1,200 or £12.50).

## The agreement text

Exactly as the function produces it, with placeholders for the filled-in parts. Line breaks are as in the generated text.

<!-- agreement:start -->
```text
EMBR BOOKING AGREEMENT  {booking_ref}
Pilot version {agreement_version}. Draft for the invite-only pilot, to be reviewed by a solicitor. Not legal advice.

1. Parties
Client: {brand_name}
Talent: {talent_name}
Embr provides the booking software and takes payments through its payment provider, Stripe. Embr is not an agency: it does not find work for the Talent, and the Client chose and booked the Talent.
The Talent confirms they are 18 or over and has passed Embr's ID check.

2. The job
{job_title}
{shoot_date}{days_phrase}
Location: {location}
Call time: {call_time}

3. Fees
Session: {session_fee} ({days} day{days_plural} at {day_rate})
Usage: {usage_with_fee}
Talent fee: {talent_fee}. The Talent receives this in full. Embr takes no commission from the Talent.
Embr booking fee, paid by the Client: {embr_fee} ({fee_rate}, {fee_label})
Total for the Client: {total}

4. Payment
a) Deposit: {deposit_rate} of the total ({deposit}), paid by the Client when the Talent accepts. The booking is confirmed once it is paid. Stripe holds it until sign-off.
b) Balance: {balance}, charged to the same card at sign-off.
c) After the shoot the Talent marks the job wrapped. The Client signs off, or reports a problem, within {auto_signoff_hours} hours. If the Client does neither, the booking signs off automatically.
d) At sign-off the Talent is paid the full talent fee.

5. Usage
{usage_terms}
Any other use needs a new booking through Embr.

6. Content agreed
{content_agreed}
Nothing outside this may be asked of the Talent on the day. The Talent may bring a chaperone.

7. Cancellation
a) Client cancels {free_cancel_days} or more days before the shoot: the deposit is refunded in full.
b) Client cancels less than {free_cancel_days} days before the shoot: the Talent is paid {late_cancel_share} of the session fee ({late_cancel_amount}) from the deposit and the rest is refunded.
c) Talent cancels: the Client's deposit is refunded in full.

8. Problems
If the Client reports a problem, nothing is paid out until Embr has heard from both sides. Embr then decides how the money held is split, in line with this agreement.

9. Booking through Embr
For 12 months after this booking, the Client agrees to book this Talent through Embr.

10. Portfolio
Unless agreed otherwise in messages, the Talent may use the images in their portfolio after the Client has published them.
```
<!-- agreement:end -->

## Questions for the solicitor

These are only points that can be seen in the text above. They are questions, not conclusions.

1. **Who the parties are.** Section 1 names the Client and the Talent and describes what Embr does, but Embr has no legal name, address or company number (Embr is not incorporated yet). Is Embr meant to be a party to this agreement, and how should it be named once it is incorporated?
2. **Embr's role.** Section 1 says "Embr is not an agency". Sections 8 and 9 give Embr a role: it decides how held money is split if there is a problem, and the Client agrees to book the Talent through Embr for 12 months. Is the text clear and consistent about what Embr is and does?
3. **Who holds the money.** Section 4a says "Stripe holds it until sign-off". Is this the right way to describe where the deposit sits before it is paid out?
4. **Automatic sign-off.** Section 4c says the booking signs off automatically if the Client does nothing within {auto_signoff_hours} hours. Is it clear enough what the Client gives up when that happens?
5. **Usage.** Sections 3 and 5 use free text typed by the Client, with "internal use" as the fallback. The text does not say who owns the images. Is the usage wording enough to describe what the Client may do with them?
6. **Content agreed and chaperone.** Section 6 says nothing outside the agreed content may be asked of the Talent and that the Talent may bring a chaperone. Is this worded clearly enough to rely on?
7. **Cancellation.** Section 7 covers the Client cancelling early, the Client cancelling late, and the Talent cancelling. Are other cases, or what the Talent receives when the Talent cancels, worth covering?
8. **Booking through Embr for 12 months.** Section 9 states the commitment but no consequence for breaking it. Is the clause enforceable as written?
9. **Changes made in messages.** Section 10 lets the portfolio term be changed "in messages", and sections 2 and 6 rely on details given in Embr messages. Can messages inside the app change or add to the agreement?
10. **Agreeing.** The Client agrees by sending the offer and the Talent by ticking a box (see "How each side agrees" above). Is that enough to show both sides agreed to this version?
11. **The draft line.** The second line of every generated copy says "Draft for the invite-only pilot, to be reviewed by a solicitor. Not legal advice." Should that line stay during the pilot, and what should replace it after review?
12. **Age and ID.** Section 1 has the Talent confirm they are 18 or over and have passed Embr's ID check. Is that wording right for what it is meant to confirm?
