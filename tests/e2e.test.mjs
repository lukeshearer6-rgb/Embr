// End-to-end test: drives the real app in a browser against the local test
// server (scripts/dev-server.mjs), through a full pilot booking:
// invites → talent profile, photo, ID check, payouts → brand search → offer →
// accept → deposit → wrap → sign-off and payout; then a booking link from a
// brand with no invite, a late cancellation, a reported problem resolved by
// Embr, and an automatic sign-off.
//   node tests/e2e.test.mjs   (server must be running on :8787)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import assert from 'node:assert/strict';
import fs from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8787';
const SHOTS = process.env.SHOTS || '/tmp/claude-0/shots';
fs.mkdirSync(SHOTS, { recursive: true });
let passed = 0;
const ok = (n) => { passed++; console.log('  ✓ ' + n); };
const sql = async (q, args = []) => (await fetch(BASE + '/__test/sql', { method: 'POST', body: JSON.stringify({ sql: q, args }) })).json();
const ledger = async () => (await fetch(BASE + '/__test/ledger')).json();
const iso = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

const browser = await chromium.launch();
const errors = [];
async function person(name, mobile = false) {
  const base = { locale: 'en-GB', timezoneId: 'Europe/London', reducedMotion: 'reduce' };
  const ctx = await browser.newContext(mobile ? { ...base, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { ...base, viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|Failed to load resource/.test(m.text())) errors.push(`${name} console: ${m.text()}`); });
  page.setDefaultTimeout(8000);
  return page;
}
async function signIn(page, email) {
  await page.fill('input[name=email]', email);
  await page.click('#f-email button[type=submit]');
  await page.fill('input[name=token]', '123456');
  await page.click('#f-code button[type=submit]');
}
const shot = async (page, n) => { await page.waitForTimeout(400); await page.evaluate(() => document.getElementById('toast')?.setAttribute('hidden', '')); await page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: false }); };
const toastHas = async (page, re) => { await page.waitForFunction((r) => new RegExp(r).test(document.getElementById('toast')?.textContent || ''), re.source); };

try {
  console.log('Embr end-to-end test');
  await sql('truncate auth.users cascade');
  await sql('truncate public.invites, public.stripe_events cascade');
  const [{ c: opsCode }] = await sql('select public.first_ops_invite() c');

  // ---------------------------------------------------------------- Embr staff + invites
  const luke = await person('luke');
  await luke.goto(`${BASE}/join?invite=${opsCode}`);
  await signIn(luke, 'luke@embr.test');
  await luke.waitForSelector('#f-onboard');
  await luke.click('#f-onboard button[type=submit]');
  await luke.waitForSelector('h1:has-text("Overview")');
  ok('Embr staff account from the first invite, lands on the admin overview');
  await luke.click('nav.main >> text=Invites');
  await luke.selectOption('#f-invite [name=role]', 'talent');
  await luke.fill('#f-invite [name=note]', 'Amara');
  await luke.click('#f-invite button[type=submit]');
  await luke.waitForSelector('.item .ttl:text-matches("^T-")');
  await luke.selectOption('#f-invite [name=role]', 'brand');
  await luke.fill('#f-invite [name=note]', 'Rivet');
  await luke.click('#f-invite button[type=submit]');
  await luke.waitForSelector('.item .ttl:text-matches("^B-")');
  const tCode = await luke.textContent('.item .ttl:text-matches("^T-")');
  const bCode = await luke.textContent('.item .ttl:text-matches("^B-")');
  await shot(luke, '01-ops-invites');
  ok('staff create talent and brand invites');

  // ---------------------------------------------------------------- talent onboarding (phone)
  const amara = await person('amara', true);
  await amara.goto(`${BASE}/`);
  await amara.waitForSelector('text=Unsigned, not unseen.');
  await shot(amara, '02-welcome-phone');
  await amara.goto(`${BASE}/join?invite=${tCode}&as=talent`);
  await signIn(amara, 'amara@test.com');
  await amara.waitForSelector('#f-onboard[data-role=talent]');
  assert.equal(await amara.inputValue('#f-onboard [name=invite]'), tCode);
  await amara.fill('#f-onboard [name=name]', 'Amara Okafor');
  await amara.fill('#f-onboard [name=dob]', '1999-04-02');
  await amara.click('#f-onboard button[type=submit]');
  await amara.waitForSelector('#f-profile');
  ok('talent signs in with an emailed code and joins with the invite link');
  await amara.fill('#f-profile [name=handle]', 'amara');
  await amara.fill('#f-profile [name=day_rate]', '250');
  await amara.fill('#f-profile [name=height]', '5\'10"');
  await amara.fill('#f-profile [name=bio]', 'Manchester model. Streetwear, beauty and editorial.');
  await amara.fill('#f-profile [name=tags]', 'streetwear, beauty');
  await amara.click('#f-profile button[type=submit]');
  await toastHas(amara, /Saved/);
  await amara.setInputFiles('input[type=file][data-change=photos]', ['/tmp/claude-0/test-photo-0.jpg', '/tmp/claude-0/test-photo-1.jpg']);
  await toastHas(amara, /Photos added/);
  await amara.waitForSelector('.phs .p >> nth=1');
  let [tRow] = await sql("select published from talents where handle = 'amara'");
  assert.equal(tRow.published, true);
  ok('profile saved, photos compressed and uploaded, profile goes live');
  await amara.click('.panel button[data-a=verify]');
  await amara.waitForURL(/__fake_stripe\/identity/);
  await amara.click('#verify');
  await amara.waitForURL(/\/profile/);
  await amara.waitForSelector('text=Verified 18+');
  ok('ID check with Stripe Identity: verified 18+');
  await amara.click('.botnav >> text=Wallet');
  await amara.click('button[data-a=payouts]');
  await amara.waitForURL(/__fake_stripe\/onboard/);
  await amara.click('#submit');
  await amara.waitForURL(/\/wallet/);
  await amara.waitForSelector('.panel >> text=Set up');
  ok('payouts set up with Stripe Connect');
  await amara.click('.botnav >> text=Today');
  await amara.waitForSelector('text=Let work find you');
  assert.equal(await amara.locator('text=Get ready to be booked').count(), 0);
  await shot(amara, '03-talent-today-phone');
  ok('talent Today: ready to be booked, "Let work find you"');

  // ---------------------------------------------------------------- brand: search, brief, offer
  const rivet = await person('rivet');
  await rivet.goto(`${BASE}/join?invite=${bCode}&as=brand`);
  await signIn(rivet, 'sam@rivet.test');
  await rivet.waitForSelector('#f-onboard[data-role=brand]');
  await rivet.fill('#f-onboard [name=name]', 'Rivet Studio');
  await rivet.fill('#f-onboard [name=contact_name]', 'Sam');
  await rivet.click('#f-onboard button[type=submit]');
  await rivet.waitForSelector('h1:has-text("Find talent")');
  await rivet.waitForSelector('.comp >> text=Amara Okafor');
  await shot(rivet, '04-brand-board');
  ok('brand joins and finds talent on the board');
  await rivet.click('nav.main >> text=Jobs');
  await rivet.click('button[data-a=postjob]');
  await rivet.fill('#f-job [name=title]', 'Drop 4 lookbook');
  await rivet.fill('#f-job [name=shoot_date]', iso(10));
  await rivet.fill('#f-job [name=day_rate]', '240');
  await rivet.click('button[form=f-job]');
  await rivet.waitForSelector('h3:has-text("Best fit for this brief")');
  await rivet.waitForSelector('.sheet .comp >> text=Amara Okafor');
  await shot(rivet, '05-brief-best-fit');
  ok('brand posts a brief and Embr ranks who fits');
  await rivet.click('.sheet button[data-a=offer]');
  await rivet.waitForSelector('#f-offer');
  await rivet.waitForSelector('#quote >> text=Embr fee, 10%');
  await rivet.fill('#f-offer [name=day_rate]', '250');
  await rivet.fill('#f-offer [name=usage_fee]', '50');
  await rivet.fill('#f-offer [name=location]', 'Ancoats studio');
  await rivet.fill('#f-offer [name=call_time]', '9am');
  await rivet.fill('#f-offer [name=content_agreed]', 'Streetwear, no swimwear');
  await rivet.waitForFunction(() => /£330/.test(document.getElementById('quote')?.textContent || ''));
  await shot(rivet, '06-offer-form');
  ok('offer form shows the live quote: £300 to talent + 10% = £330');
  await rivet.check('#f-offer [name=agree]');
  await rivet.click('button[form=f-offer]');
  await rivet.waitForSelector('.sheet .st:has-text("Offer sent")');
  ok('offer sent with the booking agreement');

  // ---------------------------------------------------------------- talent accepts
  await amara.reload();
  await amara.waitForSelector('.todo >> text=Review offer');
  await amara.click('.todo >> text=Review offer');
  await amara.waitForSelector('.sheet >> text=You get');
  await shot(amara, '07-talent-offer-phone');
  await amara.click('.sheet button[data-a=accept]');
  await amara.check('#f-accept [name=agree]');
  await amara.click('button[form=f-accept]');
  await amara.waitForSelector('.sheet .st:has-text("Accepted, awaiting deposit")');
  ok('talent reviews the offer and accepts the agreement');

  // ---------------------------------------------------------------- deposit
  await rivet.goto(`${BASE}/board`);
  await rivet.click('.todo button[data-a=pay]');
  await rivet.waitForURL(/__fake_stripe\/checkout/);
  assert.match(await rivet.textContent('h1'), /£165\.00/);
  await rivet.click('#pay');
  await rivet.waitForURL(/\/booking\//);
  await rivet.waitForSelector('.sheet .st:has-text("Confirmed")');
  await shot(rivet, '08-booking-confirmed');
  ok('brand pays the £165 deposit through Stripe Checkout; booking confirmed');

  // messages
  await rivet.fill('#f-msg [name=body]', 'See you at 9! Bring white trainers.');
  await rivet.click('#f-msg button[type=submit]');
  await rivet.waitForSelector('.bubble.me >> text=white trainers');
  const [{ id: b1 }] = await sql("select id from bookings where title = 'Drop 4 lookbook'");
  await amara.goto(`${BASE}/booking/${b1}`);
  await amara.waitForSelector('.bubble.them >> text=white trainers');
  ok('brand and talent message inside the booking');

  // ---------------------------------------------------------------- wrap and sign off
  await sql('update bookings set shoot_date = current_date where id = $1', [b1]);
  await amara.reload();
  await amara.click('.sheet button[data-a=wrap]');
  await amara.click('[data-a=cd-yes]');
  await amara.waitForSelector('.sheet .st:has-text("Wrapped")');
  ok('talent marks the job wrapped on the day');
  await rivet.goto(`${BASE}/booking/${b1}`);
  await rivet.click('.sheet button[data-a=signoff]');
  await rivet.click('[data-a=cd-yes]');
  await rivet.waitForSelector('.sheet .st:has-text("Paid")');
  let L = (await ledger()).ledger.filter((x) => x.booking === b1);
  assert.deepEqual(L.map((x) => [x.type, x.amount]), [['charge', 16500], ['charge', 16500], ['transfer', 16500], ['transfer', 13500]]);
  ok('sign-off charges the £165 balance and transfers £300 to the talent (Embr keeps £30)');
  await amara.goto(`${BASE}/wallet`);
  await amara.waitForSelector('.vault >> text=£300');
  await shot(amara, '09-talent-wallet-phone');
  ok('talent wallet shows £300 paid, 0% commission');

  // ---------------------------------------------------------------- booking link: new brand, no invite
  await amara.goto(`${BASE}/invite`);
  await amara.click('button[data-a=linknew]');
  await amara.fill('#f-link [name=title]', 'Café menu shoot');
  await amara.fill('#f-link [name=shoot_date]', iso(12));
  await amara.fill('#f-link [name=day_rate]', '220');
  await amara.click('button[form=f-link]');
  await amara.waitForSelector('text=Send your booking link');
  const linkUrl = await amara.inputValue('.dialog input[readonly]');
  ok('talent creates a booking link with a ready-written reply');
  const cafe = await person('cafe', true);
  await cafe.goto(linkUrl);
  await cafe.waitForSelector('text=has invited you to book through Embr');
  await cafe.waitForSelector('text=£231');
  await shot(cafe, '10-link-landing-phone');
  await cafe.click('button[data-a=pub-join]');
  await signIn(cafe, 'owner@cafe.test');
  await cafe.waitForSelector('#f-onboard[data-role=brand]');
  await cafe.fill('#f-onboard [name=name]', 'Northern Café');
  await cafe.fill('#f-onboard [name=contact_name]', 'Jo');
  await cafe.click('#f-onboard button[type=submit]');
  await cafe.waitForSelector('#f-acceptlink');
  ok('a brand with no invite joins from the link and comes back to it');
  await cafe.check('#f-acceptlink [name=agree]');
  await cafe.click('#f-acceptlink button[type=submit]');
  await cafe.waitForURL(/__fake_stripe\/checkout/);
  await cafe.click('#pay');
  await cafe.waitForSelector('.sheet .st:has-text("Confirmed")');
  const [{ fee_rate: linkFee }] = await sql("select fee_rate from bookings where title = 'Café menu shoot'");
  assert.equal(Number(linkFee), 0.05);
  ok('link booking accepted and deposit paid at the 5% link fee');

  // ---------------------------------------------------------------- late cancellation by the brand
  const [{ id: b2 }] = await sql("select id from bookings where title = 'Café menu shoot'");
  await sql('update bookings set shoot_date = current_date + 3 where id = $1', [b2]);
  await cafe.reload();
  await cafe.waitForSelector('.sheet button[data-a=cancel]');
  await cafe.click('.sheet button[data-a=cancel]');
  await cafe.waitForSelector('text=less than 7 days');
  await cafe.fill('#cd-field', 'Café closed for repairs');
  await cafe.click('[data-a=cd-yes]');
  await cafe.waitForSelector('.sheet .st:has-text("Cancelled")');
  L = (await ledger()).ledger.filter((x) => x.booking === b2);
  // deposit 50% of £231 = £115.50; talent gets 50% of £220 session = £110; £5.50 refunded
  assert.deepEqual(L.map((x) => [x.type, x.amount]), [['charge', 11550], ['refund', 550], ['transfer', 11000]]);
  ok('late cancellation: talent paid £110 from the deposit, £5.50 refunded');

  // ---------------------------------------------------------------- problem reported, Embr resolves
  const b3 = (await sql(`insert into bookings (ref, brand_id, talent_id, title, shoot_date, day_rate, fee_rate, fee_label, session_p, talent_fee_p, embr_fee_p, total_p, deposit_p, balance_p, agreement_version, agreement_text, status)
    select 'EMB-TEST01', b.id, t.id, 'Problem shoot', current_date, 200, .07, 'x', 20000, 20000, 1400, 21400, 10700, 10700, 'v', 'text', 'accepted' from brands b, talents t where b.name = 'Rivet Studio' limit 1 returning id`))[0].id;
  await rivet.goto(`${BASE}/booking/${b3}`);
  await rivet.click('.sheet button[data-a=pay]');
  await rivet.click('#pay');
  await rivet.waitForSelector('.sheet .st:has-text("Confirmed")');
  await rivet.click('.sheet button[data-a=problem]');
  await rivet.fill('#cd-field', 'Talent arrived two hours late');
  await rivet.click('[data-a=cd-yes]');
  await rivet.waitForSelector('.sheet .st:has-text("Problem reported")');
  await luke.goto(`${BASE}/overview`);
  await luke.waitForSelector('text=Problem shoot');
  await luke.click('.item >> text=Problem shoot');
  await luke.click('.sheet button[data-a=resolve]');
  await luke.fill('#f-resolve [name=talent]', '80');
  await luke.fill('#f-resolve [name=note]', 'Agreed partial payment after speaking to both');
  await luke.click('button[form=f-resolve]');
  await luke.waitForSelector('.sheet .st:has-text("Paid")');
  L = (await ledger()).ledger.filter((x) => x.booking === b3);
  assert.deepEqual(L.map((x) => [x.type, x.amount]), [['charge', 10700], ['refund', 2700], ['transfer', 8000]]);
  await shot(luke, '11-ops-resolved');
  ok('problem reported pauses payment; Embr splits the deposit (£80 to talent, £27 refunded)');

  // ---------------------------------------------------------------- automatic sign-off after 72 hours
  const b4 = (await sql(`insert into bookings (ref, brand_id, talent_id, title, shoot_date, day_rate, fee_rate, fee_label, session_p, talent_fee_p, embr_fee_p, total_p, deposit_p, balance_p, agreement_version, agreement_text, status)
    select 'EMB-TEST02', b.id, t.id, 'Auto shoot', current_date, 200, .07, 'x', 20000, 20000, 1400, 21400, 10700, 10700, 'v', 'text', 'accepted' from brands b, talents t where b.name = 'Rivet Studio' limit 1 returning id`))[0].id;
  await rivet.goto(`${BASE}/booking/${b4}`);
  await rivet.click('.sheet button[data-a=pay]');
  await rivet.click('#pay');
  await rivet.waitForSelector('.sheet .st:has-text("Confirmed")');
  await amara.goto(`${BASE}/booking/${b4}`);
  await amara.click('.sheet button[data-a=wrap]');
  await amara.click('[data-a=cd-yes]');
  await amara.waitForSelector('.sheet .st:has-text("Wrapped")');
  await sql("update bookings set auto_signoff_at = now() - interval '1 minute' where id = $1", [b4]);
  const cron = await (await fetch(BASE + '/__test/cron')).json();
  assert.equal(cron.results[0].ok, true);
  const [{ status: s4, signoff_kind }] = await sql('select status, signoff_kind from bookings where id = $1', [b4]);
  assert.equal(s4, 'completed'); assert.equal(signoff_kind, 'auto');
  ok('the scheduler signs off automatically 72 hours after wrap and pays the talent');

  // ---------------------------------------------------------------- the rest
  const { emails } = await ledger();
  assert.ok(emails.length >= 10, 'emails sent: ' + emails.length);
  assert.ok(emails.some((e) => e.to === 'amara@test.com' && /New offer from Rivet Studio/.test(e.subject)));
  ok(`emails go out for each step (${emails.length} sent, e.g. "${emails.find((e) => /New offer/.test(e.subject)).subject}")`);
  const bm = await person('visitor', true);
  await bm.goto(`${BASE}/@amara`);
  await bm.waitForSelector('h1:has-text("Amara Okafor")');
  await shot(bm, '12-bookme-phone');
  ok('public Book-me page at /@amara');
  await luke.goto(`${BASE}/people`);
  await luke.waitForSelector('text=18+ verified');
  await shot(luke, '13-ops-people');
  await rivet.goto(`${BASE}/bookings`);
  await shot(rivet, '14-brand-bookings');
  ok('admin People shows ID and payout status');

  // talent must never see briefs: no Jobs tab, no route
  await amara.goto(`${BASE}/jobs`);
  await amara.waitForSelector('h1');
  assert.ok(!(await amara.textContent('main')).includes('Drop 4 lookbook brief'));
  assert.equal(await amara.locator('nav >> text=Jobs').count(), 0);
  ok('talent have no Jobs tab and nothing to apply for');

  if (errors.length) { console.log('\nBrowser errors:\n' + errors.join('\n')); throw new Error(errors.length + ' browser errors'); }
  console.log(`\n${passed} checks passed. Screenshots in ${SHOTS}`);
} catch (e) {
  console.error('\n✗ FAILED:', e.message);
  let i = 0;
  for (const c of browser.contexts()) for (const pg of c.pages()) { await pg.screenshot({ path: `${SHOTS}/fail-${i++}.png` }).catch(() => {}); console.log('  page', i - 1, pg.url(), (await pg.textContent('#toast').catch(() => '')) || ''); }
  if (errors.length) console.log('Browser errors:\n' + errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
}
