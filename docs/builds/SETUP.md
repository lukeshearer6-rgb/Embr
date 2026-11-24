# Putting the Embr pilot online

This is the order to do it in. Everything here is on a free plan, and Stripe stays in **test mode** (fake cards, no real money) until you switch it on after incorporating. Allow an evening. Claude can do the command-line parts on your Mac if you prefer: just say so.

You'll make four accounts: **Supabase**, **Stripe**, **Resend** and **Cloudflare**. Use an Embr email address if you have one.

Keep a note open as you go. You'll collect these values:

| Value | Where it comes from |
|---|---|
| Supabase project URL and anon key | Supabase, step 1 |
| Supabase project ref (the bit before `.supabase.co`) | Supabase, step 1 |
| Stripe secret key (`sk_test_…`) | Stripe, step 2 |
| Stripe webhook secrets (`whsec_…`, two of them) | Stripe, step 5 |
| Resend API key (`re_…`) | Resend, step 3 |
| Two random secrets you make up | Step 4 |

---

## 1. Supabase (database, logins, photos)

1. Sign up at supabase.com and create a project called `embr-pilot`. Region: **London (eu-west-2)**. Save the database password somewhere safe.
2. **Project Settings → API**: copy the **Project URL** and the **anon public** key.
3. **Authentication → Sign In / Providers → Email**: keep Email on, turn **Confirm email** on.
4. **Authentication → Email Templates → Magic Link**: replace the body with:
   ```
   <h2>Your Embr sign-in code</h2>
   <p>Enter this code in Embr: <b style="font-size:22px;letter-spacing:4px">{{ .Token }}</b></p>
   <p>It works for one hour. If you didn't ask for it, ignore this email.</p>
   ```
   Do the same for **Confirm signup**. (Embr signs people in with a 6-digit code, which works better than links on a home-screen app. New projects send 8 digits: under **Sign In / Providers → Email**, set **Email OTP Length** to 6. The app accepts either.)
5. **Authentication → URL Configuration**: set Site URL to your app address once you have it (step 6), for example `https://embr-pilot.pages.dev`.

Note: free Supabase projects pause after a week with no activity. During the pilot, any sign-in keeps it awake.

## 2. Stripe (deposits, payouts, ID checks)

1. Sign up at stripe.com. You can use test mode straight away without incorporating. Leave the **Test mode** switch on.
2. **Developers → API keys**: copy the **Secret key** (`sk_test_…`).
3. **Connect → Get started**: choose **Platform or marketplace**, and that you'll onboard sellers/service providers with **Express** accounts. Set the platform name to Embr.
4. **Settings → Identity** (Stripe Identity): turn it on. The first 50 checks are free, then £1.25 each.

## 3. Resend (emails)

1. Sign up at resend.com and create an API key (`re_…`).
2. Until you own a domain, Resend only sends to your own email address. That's fine for testing. Once you buy the domain, add it in **Domains**, add the DNS records it shows you, and use `Embr <bookings@yourdomain>` as the sender.
3. Back in Supabase, **Project Settings → Authentication → SMTP Settings**: turn on custom SMTP with host `smtp.resend.com`, port `465`, user `resend`, password = your Resend API key. Without this, Supabase only sends a handful of sign-in emails an hour.

## 4. Deploy the database and server functions

On your Mac, in the `embr-pilot` folder (Terminal):

```sh
npm install
npx supabase login
npx supabase link --project-ref <PROJECT-REF>
npx supabase db push                     # creates the tables, rules and booking logic

# make up two long random secrets (run this twice and keep both)
openssl rand -hex 24

npx supabase secrets set \
  STRIPE_SECRET_KEY=sk_test_... \
  APP_URL=https://embr-pilot.pages.dev \
  RESEND_API_KEY=re_... \
  EMAIL_FROM="Embr <onboarding@resend.dev>" \
  EMAIL_HOOK_SECRET=<first random secret> \
  CRON_SECRET=<second random secret>

npx supabase functions deploy api
npx supabase functions deploy stripe-webhook --no-verify-jwt
npx supabase functions deploy cron --no-verify-jwt
npx supabase functions deploy send-email --no-verify-jwt
```

Then open **SQL Editor** in Supabase, paste `supabase/setup/after-deploy.sql`, replace the three values in angle brackets, and run it. The last line gives you your **staff invite code**. Keep it.

## 5. Stripe webhooks (how Stripe tells Embr a payment went through)

In Stripe, **Developers → Webhooks → Add endpoint**, twice:

1. **Your account** events. URL: `https://<PROJECT-REF>.supabase.co/functions/v1/stripe-webhook`. Events: `checkout.session.completed`, `checkout.session.expired`, `charge.dispute.created`, `charge.dispute.closed`, `identity.verification_session.verified`, `identity.verification_session.requires_input`, `identity.verification_session.canceled`.
2. **Connected accounts** events. Same URL. Events: `account.updated`, `account.application.deauthorized`, `payout.failed`.

Copy each endpoint's **Signing secret**, then:

```sh
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_... STRIPE_CONNECT_WEBHOOK_SECRET=whsec_...
```

## 6. Host the app (Cloudflare Pages)

1. Create `.env.production` from `.env.example` with your Supabase URL and anon key, then run `npm run build`. This makes a `dist` folder.
2. Sign up at cloudflare.com. **Workers & Pages → Create → Pages → Upload assets**. Name it `embr-pilot` and drag in the `dist` folder. You get `https://embr-pilot.pages.dev`.
3. If that address differs from what you used for `APP_URL`, update the secret and the Supabase Site URL.
4. Later, add your own domain in Pages → Custom domains.

Check Cloudflare's current terms allow a commercial app on the free plan before launch (Vercel's free plan doesn't, which is why it isn't used here).

## 7. First sign-in and a test booking

1. Open the **admin website** on a computer at `https://embr-pilot.pages.dev/admin/join?invite=<your staff code>` and sign in with your email. You land on the Embr admin **Overview**. The app itself (`/`) is only for talent and brands; staff always use `/admin`.
2. **Invites**: create a talent invite and a brand invite. Use a second email address for each (Gmail's `you+talent@gmail.com` trick works).
3. As talent: pick what you do, fill in the profile and every role section (for Model: photos plus the full model details), add photos, do the ID check (Stripe's test mode lets you pick a test result), and set up payouts (test mode: use Stripe's test bank details, sort code `108800`, account `00012345`).
4. As the brand: find the talent, send an offer. As talent: accept. As the brand: pay the deposit with card `4242 4242 4242 4242`, any future date, any CVC.
5. Change the booking's date to today in Supabase's **Table Editor** (bookings → shoot_date), mark it wrapped as talent, sign off as the brand. Check the transfer appears in Stripe under **Connect → the talent's account**.

The plan says the pilot opens after five test bookings run end to end, including a cancellation and a refund. Stripe's test mode is where those happen first.

## 8. Going live (after incorporating)

1. Activate your Stripe account with the company details, then repeat steps 2.2, 2.3 and 5 in **live mode** and update the secrets with the live keys.
2. Have a solicitor review the booking agreement in `supabase/migrations/…_embr_pilot.sql` (function `_agreement`), and get the agency-law opinion before charging talent anything.
3. Put the app on your own domain and update `APP_URL`, the Supabase Site URL and the Resend sender.

## On a phone

Open the app in Safari (iPhone) or Chrome (Android) and choose **Add to Home Screen**. It then opens full-screen like an app.
