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
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.BASE || 'http://localhost:8787';
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'embr-shots');
fs.mkdirSync(SHOTS, { recursive: true });
let passed = 0;
const ok = (n) => { passed++; console.log('  ✓ ' + n); };
const sql = async (q, args = []) => (await fetch(BASE + '/__test/sql', { method: 'POST', body: JSON.stringify({ sql: q, args }) })).json();
const ledger = async () => (await fetch(BASE + '/__test/ledger')).json();
const iso = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

const browser = await chromium.launch();

// Test photos: made on the fly so the test needs no files outside the repo.
const PHOTOS = [0, 1, 2].map((i) => path.join(os.tmpdir(), `embr-test-photo-${i}.jpg`));
{
  const p = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  for (const [i, file] of PHOTOS.entries()) {
    await p.setContent(`<body style="margin:0;background:hsl(${i * 120 + 15},55%,55%)"><div style="font:bold 200px sans-serif;color:#fff;padding:400px 300px">${i + 1}</div></body>`);
    await p.screenshot({ path: file, type: 'jpeg', quality: 80 });
  }
  await p.close();
}
const errors = [];
async function person(name, mobile = false) {
  const base = { locale: 'en-GB', timezoneId: 'Europe/London', reducedMotion: 'reduce' };
  const ctx = await browser.newContext(mobile ? { ...base, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { ...base, viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|Failed to load resource|Pick at least one thing you do/.test(m.text())) errors.push(`${name} console: ${m.text()}`); });
  page.setDefaultTimeout(8000);
  return page;
}
async function signIn(page, email, code = '123456', haveCode = false) {
  await page.fill('input[name=email]', email);
  await page.click(haveCode ? '#f-email [data-a=have-code]' : '#f-email button[type=submit]');
  await page.fill('input[name=token]', code);
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
  await luke.goto(`${BASE}/`);
  await luke.waitForSelector('text=Unsigned, not unseen.');
  assert.equal(await luke.locator('text=/staff|work at Embr/i').count(), 0);
  ok('the app\'s welcome screen offers brand and talent only, no staff option');
  assert.equal(await luke.locator('text=/0% of your fee|keep everything they earn/i').count(), 0);
  ok('the welcome screen makes no fee claim (Luke, 2026-11-26)');
  await luke.goto(`${BASE}/admin/join?invite=${opsCode}`);
  await luke.waitForSelector('h1:has-text("Embr admin")');
  await signIn(luke, 'luke@embr.test');
  await luke.waitForSelector('#f-staff');
  assert.equal(await luke.inputValue('#f-staff [name=invite]'), opsCode);
  await luke.click('#f-staff button[type=submit]');
  await luke.waitForSelector('h1:has-text("Overview")');
  assert.match(luke.url(), /\/admin\/overview$/);
  assert.equal(await luke.locator('.botnav').count(), 0);
  await luke.goto(`${BASE}/`);
  await luke.waitForSelector('text=You\'re signed in as Embr staff');
  await luke.goto(`${BASE}/admin`);
  await luke.waitForSelector('h1:has-text("Overview")');
  ok('Embr staff join on the separate admin website, not the app');
  await luke.setViewportSize({ width: 760, height: 860 });
  assert.ok(await luke.isVisible('nav.main >> text=Invites'), 'admin menu shows on a narrow window');
  await luke.setViewportSize({ width: 1280, height: 860 });
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
  await luke.click('button[data-a=copy] >> nth=0');
  await luke.waitForFunction(() => /Copied|join\?invite=/.test(document.getElementById('toast')?.textContent || ''));
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
  await amara.waitForSelector('#f-onboard [name=agency] + span >> text=/not under an exclusive contract/');
  await amara.check('#f-onboard [name=agency]');
  await amara.click('#f-onboard button[type=submit]');
  await toastHas(amara, /Pick at least one/);
  await amara.click('#f-onboard [data-role="Model"]');
  await amara.click('#f-onboard [data-role="UGC creator"]');
  await amara.click('#f-onboard [data-role="Actor"]');
  await amara.click('#f-onboard [data-role="Actor"]');
  await shot(amara, '02b-signup-roles-phone');
  await amara.click('#f-onboard button[type=submit]');
  await amara.waitForSelector('#f-profile');
  let [tRow] = await sql("select roles, agency_declared_at, agency_declaration from talents where name = 'Amara Okafor'");
  assert.deepEqual(tRow.roles, ['Model', 'UGC creator']);
  assert.ok(tRow.agency_declared_at); assert.match(tRow.agency_declaration, /^agency-v1/);
  ok('talent confirm their agency status at sign-up, and the wording they agreed is stored');
  ok('talent signs in with an emailed code, joins with the invite link and picks every role that applies');
  await amara.waitForSelector('[data-role-sec="Model"]');
  await amara.waitForSelector('[data-role-sec="UGC creator"]');
  await amara.fill('#f-profile [name=handle]', 'amara');
  await amara.fill('#f-profile [name=bio]', 'Manchester model and UGC creator. Streetwear, beauty and editorial. <img src=x onerror="window.__xss=1">');
  await amara.fill('#f-profile [name=tags]', 'streetwear, beauty');
  await amara.waitForSelector('#f-profile >> text=/"Around my region" from Manchester means Liverpool and Leeds/');
  await amara.selectOption('#f-profile [name=travel_range]', 'region');
  await amara.selectOption('#f-profile [name=travel_costs]', 'nearby_included');
  await amara.click('#f-profile button[type=submit]');
  await toastHas(amara, /Fill in your work sections/);
  await amara.waitForSelector('[data-role-sec="Model"] .need >> text=/which sizes you model/');
  // a brand-new profile: photos first, then rates; an empty photo section is one big add tile
  await amara.waitForSelector('#newp .estate >> text=Show brands your work');
  assert.doesNotMatch(await amara.textContent('#newp'), /find work|apply|jobs for you/i);
  await amara.waitForSelector('[data-role-sec="Model"] label.p-first >> text=Add your first modelling photos');
  await amara.waitForSelector('[data-role-sec="UGC creator"] label.p-first >> text=Add your first stills');
  for (const sel of ['#newp .estate label.btn', '#newp .estate [data-a=rates-edit]']) assert.ok((await amara.locator(sel).boundingBox()).height >= 48, sel + ' is at least 48px tall');
  await amara.evaluate(() => document.getElementById('newp').scrollIntoView());
  await shot(amara, '28-new-profile-phone');
  await amara.evaluate(() => window.scrollTo(0, 0));
  ok('a section per role, and the profile stays hidden until each is filled');
  {
    // Rates and availability: a summary card on Profile opens a full-screen editor with X and one sticky Save
    assert.equal(await amara.locator('#f-profile [name=day_rate]').count(), 0);
    await amara.waitForSelector('.ratecard >> text=No rate yet');
    await amara.waitForSelector('#ready >> text=Set your day rate');
    await amara.click('.ratecard [data-a=rates-edit]');
    await amara.waitForSelector('.sheet #f-rates');
    assert.ok(await amara.locator('#pe-half .pe-fields').isHidden(), 'half days start switched off when there is no half-day rate');
    await amara.fill('#f-rates [name=day_rate]', '250');
    await amara.fill('#f-rates [name=full_includes]', 'Two looks');
    await amara.click('#pe-half .switch');
    await amara.fill('#f-rates [name=half_rate]', '150');
    await amara.selectOption('#f-rates [name=half_hours]', '4');
    await amara.fill('#f-rates [name=half_includes]', 'One look, natural make-up');
    await amara.waitForSelector('#pe-preview .pkg >> text=One look, natural make-up');
    assert.match(await amara.textContent('#pe-preview'), /Full day.*Up to 8 hours.*Two looks.*£250.*Half day.*Up to 4 hours.*£150/s);
    for (const sel of ['#f-rates [name=day_rate]', '#f-rates [name=full_hours]', '#pe-half .switch', '#f-block [name=from]', '#f-block button[type=submit]', '.sheet .ft .btn.primary']) assert.ok((await amara.locator(sel).boundingBox()).height >= 48, sel + ' is at least 48px tall');
    await amara.locator('.sheet .bd').evaluate((el) => { el.scrollTop = 0; });
    await shot(amara, '02e-rates-editor-phone');
    // blocking a range saves straight away and lists it; the month grid shows the days struck through
    await amara.fill('#f-block [name=from]', iso(38));
    await amara.fill('#f-block [name=to]', iso(40));
    await amara.click('#f-block button[type=submit]');
    await amara.waitForSelector('#blk-list li >> text=3 days');
    assert.equal(await amara.locator('#cal .d.off').count(), 3);
    await amara.locator('#blk').scrollIntoViewIfNeeded();
    await shot(amara, '02f-blocked-dates-phone');
    // a single day can be freed from the grid, and the range list follows
    await amara.click(`#cal .d.off[data-d="${iso(40)}"]`);
    await amara.waitForSelector('#blk-list li >> text=2 days');
    await amara.click(`#cal .d.free[data-d="${iso(40)}"]`);
    await amara.waitForSelector('#blk-list li >> text=3 days');
    await amara.click('.sheet .ft .btn.primary');
    await toastHas(amara, /Rates saved/);
    await amara.waitForSelector('.ratecard >> text=Half day');
    assert.match(await amara.textContent('.ratecard'), /Full day.*£250.*Half day.*£150.*Blocked dates.*3 days/s);
    const [r] = await sql("select day_rate, half_rate, packages, (select count(*)::int from talent_off_days o where o.talent_id = t.id) off from talents t where handle = 'amara'");
    assert.deepEqual(r, { day_rate: 250, half_rate: 150, packages: { full: { hours: 8, includes: 'Two looks' }, half: { hours: 4, includes: 'One look, natural make-up' } }, off: 3 });
    ok('Rates and availability: talent set full-day and half-day packages and block a date range from one editor');
  }
  [tRow] = await sql("select travel_range, travel_costs, travels from talents where handle = 'amara'");
  assert.deepEqual(tRow, { travel_range: 'region', travel_costs: 'nearby_included', travels: true });
  ok('travel is saved as how far plus how costs work');
  // phone number: optional, needs its own consent tick, and is never shown on the profile or Book-me page
  await amara.fill('#f-phone [name=phone]', '07700 900123');
  await amara.click('#f-phone button[type=submit]');
  await toastHas(amara, /Tick the box/);
  assert.equal((await sql("select phone from talents where handle = 'amara'"))[0].phone, null);
  await amara.check('#f-phone [name=consent]');
  await amara.click('#f-phone button[type=submit]');
  await toastHas(amara, /Brands see it once a booking is confirmed/);
  assert.equal((await sql("select phone from talents where handle = 'amara'"))[0].phone, '+447700900123');
  assert.equal(await amara.inputValue('#f-phone [name=phone]'), '+447700900123');
  await amara.locator('#f-phone').scrollIntoViewIfNeeded();
  await shot(amara, '03d-talent-phone');
  ok('talent add a phone number with a consent tick; it saves in UK +44 form');
  await amara.fill('#f-profile [name=instagram]', '@amara.unsaved');
  await amara.setInputFiles('[data-role-sec="Model"] input[type=file]', PHOTOS);
  await toastHas(amara, /Photos added/);
  await amara.waitForSelector('[data-role-sec="Model"] .phs .p >> nth=2');
  assert.equal(await amara.inputValue('#f-profile [name=instagram]'), '@amara.unsaved');
  await amara.fill('#f-profile [name=instagram]', '');
  ok('uploading photos keeps details typed but not yet saved');
  await amara.selectOption('#f-stats [name=sizing]', 'womenswear');
  await amara.waitForSelector('#f-stats [name=bust_in]');
  await amara.fill('#f-stats [name=height_cm]', '178');
  await amara.fill('#f-stats [name=bust_in]', '32');
  await amara.fill('#f-stats [name=waist_in]', '24');
  await amara.click('#f-stats button[type=submit]');
  await toastHas(amara, /Still needed for modelling: your hips, dress size, shoe size, hair colour, eye colour/);
  ok('height alone isn\'t enough: every core model measurement is required');
  await amara.fill('#f-stats [name=hips_in]', '35');
  await amara.selectOption('#f-stats [name=dress_uk]', '8');
  await amara.selectOption('#f-stats [name=shoe_uk]', '6.5');
  await amara.selectOption('#f-stats [name=hair]', 'Black');
  await amara.selectOption('#f-stats [name=eyes]', 'Brown');
  await amara.fill('#f-stats [name=bra]', '32B');
  await amara.click('#f-stats button[type=submit]');
  await amara.waitForSelector('[data-role-sec="Model"] .done');
  await amara.locator('#f-stats').scrollIntoViewIfNeeded();
  await shot(amara, '02d-model-details-phone');
  await amara.fill('[data-addlink="UGC creator"] [name=url]', 'https://www.tiktok.com/@amara/video/1');
  await amara.fill('[data-addlink="UGC creator"] [name=title]', 'Skincare ad');
  await amara.click('[data-addlink="UGC creator"] button');
  await amara.waitForSelector('[data-role-sec="UGC creator"] .linkcard >> text=Skincare ad');
  [tRow] = await sql("select published from talents where handle = 'amara'");
  assert.equal(tRow.published, false);
  await amara.fill('[data-addlink="UGC creator"] [name=url]', 'https://vimeo.com/2');
  await amara.fill('[data-addlink="UGC creator"] [name=title]', 'Trainers unboxing');
  await amara.click('[data-addlink="UGC creator"] button');
  await toastHas(amara, /profile is live/);
  [tRow] = await sql("select published from talents where handle = 'amara'");
  assert.equal(tRow.published, true);
  await amara.locator('#work').scrollIntoViewIfNeeded();
  await shot(amara, '02c-profile-sections-phone');
  assert.equal((await amara.textContent('#newp')).trim(), '', 'the new-profile card goes once there are photos');
  assert.equal(await amara.locator('[data-role-sec="Model"] label.p-first').count(), 0);
  ok('modelling photos compressed and uploaded, UGC video links added, profile goes live');
  await amara.click('.panel button[data-a=verify]');
  await amara.waitForURL(/__fake_stripe\/identity/);
  await amara.click('#verify');
  await amara.waitForURL(/\/profile/);
  await amara.waitForSelector('text=Verified 18+');
  ok('ID check with Stripe Identity: verified 18+ (date of birth asked for by name, as real Stripe needs)');
  await amara.click('.botnav >> text=Wallet');
  await amara.click('button[data-a=payouts]');
  await amara.waitForURL(/__fake_stripe\/onboard/);
  await amara.click('#submit');
  await amara.waitForURL(/\/wallet/);
  await amara.waitForSelector('.panel >> text=Set up');
  ok('payouts set up with Stripe Connect');
  // phone tab bar: Profile sits in the bar, Today moves into More (snag list 2026-11-26)
  assert.deepEqual(await amara.locator('.botnav button span:not(.flag)').allTextContents(), ['Bookings', 'Wallet', 'Messages', 'Profile', 'More']);
  await amara.click('.botnav button[data-a=more]');
  await amara.click('button.item[data-tab=today]');
  await amara.waitForSelector('text=Let work find you');
  assert.equal(await amara.locator('text=Get ready to be booked').count(), 0);
  await amara.waitForSelector('.tiles .tile >> text=Seen by brands');
  assert.equal(await amara.locator('.tiles .tile').count(), 3);
  await amara.waitForSelector('.tile >> text=None yet this week');
  await amara.waitForSelector('text=Profile strength');
  // the money and the seen/saved counts sit together in one block
  assert.equal(await amara.locator('.moneyblk .earn').count(), 1); assert.equal(await amara.locator('.moneyblk .tiles').count(), 1);
  // new talent: the next setup step sits above the money, not below it
  assert.ok(await amara.evaluate(() => !!(document.querySelector('.needs .panel')?.compareDocumentPosition(document.querySelector('.earn')) & Node.DOCUMENT_POSITION_FOLLOWING)));
  await amara.waitForSelector('.panel:has-text("This week on Embr") >> text=Brands are being invited in now');
  assert.equal(await amara.locator('.panel:has-text("This week on Embr") a, .panel:has-text("This week on Embr") button').count(), 0);
  await shot(amara, '03-talent-today-phone');
  ok('talent Today: ready to be booked, "Let work find you"');
  await amara.click('.panel:has-text("Your dates") button[data-a=confirm-dates]');
  await toastHas(amara, /Dates confirmed/);
  await amara.waitForSelector('.panel:has-text("Your dates") >> text=Confirmed today.');
  ok('talent Today: seen-and-saved counts, profile strength, this week on Embr (nothing to click), one-tap dates check');

  // ---------------------------------------------------------------- brand: search, brief, offer
  const rivet = await person('rivet');
  await rivet.goto(`${BASE}/join?invite=${bCode}&as=brand`);
  await signIn(rivet, 'sam@rivet.test', '12345678'); // newer Supabase projects send 8-digit codes
  await rivet.waitForSelector('#f-onboard[data-role=brand]');
  await rivet.fill('#f-onboard [name=name]', 'Rivet Studio');
  await rivet.fill('#f-onboard [name=contact_name]', 'Sam');
  await rivet.click('#f-onboard button[type=submit]');
  await rivet.waitForSelector('h1:has-text("Find talent")');
  await rivet.waitForSelector('.cc >> text=Amara Okafor');
  // photos lead on the board: the day rate sits on a small pill on the photo, name, roles and city below it
  assert.match(await rivet.textContent('.feed .cc .cc-rate'), /£250 a day/);
  assert.match(await rivet.textContent('.feed .cc .cc-body'), /Amara Okafor.*Model and UGC creator.*Manchester/s);
  // CreativeCard: her 3 photos swipe, then her first video link as a black play tile, with a dot for each
  assert.equal(await rivet.locator('.feed .cc >> nth=0 >> .cc-slide img').count(), 3);
  assert.match(await rivet.textContent('.feed .cc .cc-video'), /Skincare ad.*TikTok/s);
  assert.equal(await rivet.locator('.feed .cc >> nth=0 >> .cc-dots i').count(), 4);
  assert.equal(await rivet.locator('.feed .cc >> nth=0 >> .cc-badge').count(), 1);
  // no reviews exist yet, so no star rating is shown (no made-up numbers)
  assert.equal(await rivet.locator('.feed .cc-rating').count(), 0);
  assert.match(await rivet.textContent('.feed .cc .cc-add'), /Add to shoot/);
  assert.equal(await rivet.locator('.band [name=q]').count(), 1);
  assert.equal(await rivet.getAttribute('.cats [data-cat=""]', 'aria-pressed'), 'true');
  assert.match(await rivet.textContent('#frow'), /Filters.*Any date.*Manchester.*Any day rate/s);
  await shot(rivet, '04-brand-board');
  ok('brand joins and finds talent on the board');
  await rivet.click('.cats [data-cat="UGC creator"]');
  await rivet.waitForFunction(() => document.querySelector('.cats [data-cat="UGC creator"]').getAttribute('aria-pressed') === 'true');
  await rivet.waitForSelector('.cc >> text=Amara Okafor');
  assert.equal(await rivet.getAttribute('.cats [data-cat=""]', 'aria-pressed'), 'false');
  await rivet.click('.cc >> text=Amara Okafor');
  await rivet.waitForSelector('.sheet .role-sec h3:has-text("UGC creator")');
  await rivet.waitForSelector('.sheet .linkcard >> text=Skincare ad');
  await rivet.waitForSelector('.sheet .rolebadges >> text=Model');
  await rivet.waitForSelector('.sheet .stats-grid >> text=5\'10" (178cm)');
  await rivet.waitForSelector('.sheet .stats-grid >> text=UK 8');
  // text people type is shown as text, never run as code
  assert.match(await rivet.textContent('.sheet .measure'), /<img src=x onerror=/);
  assert.equal(await rivet.evaluate(() => window.__xss), undefined);
  await rivet.locator('.sheet .role-sec >> nth=0').scrollIntoViewIfNeeded();
  await shot(rivet, '04b-brand-profile-roles');
  await rivet.keyboard.press('Escape');
  await rivet.click('.cats [data-cat=""]');
  ok('brand switches to UGC creators with a role pill and sees each role\'s work on the profile');
  {
    // on a phone the board's filters live in one bottom sheet; pills and hearts are 48px to tap
    const phone = await person('rivet-phone', true);
    await phone.goto(`${BASE}/signin`);
    await signIn(phone, 'sam@rivet.test', '12345678');
    await phone.waitForSelector('.feed .cc');
    for (const sel of ['.cats .cat', '.frow .fpill', '.cc .save', '.cc .cc-add']) assert.ok((await phone.locator(sel).first().boundingBox()).height >= 48, sel + ' is at least 48px tall');
    await phone.click('.frow [data-sec=rate]');
    await phone.waitForSelector('.dialog.fsheet [data-a=fapply]:has-text("Show 1 person")');
    const sheet = await phone.evaluate(() => { const d = document.querySelector('.dialog.fsheet'); return { radius: getComputedStyle(d).borderTopLeftRadius, grabber: getComputedStyle(d, '::before').display }; });
    assert.deepEqual(sheet, { radius: '16px', grabber: 'block' });
    await phone.fill('#f-filters [name=max_rate]', '200');
    await phone.waitForSelector('[data-a=fapply]:has-text("No one matches")');
    await phone.fill('#f-filters [name=max_rate]', '300');
    await phone.click('#f-filters [data-k=date][data-v="' + iso(0) + '"]');
    await phone.waitForSelector('#f-filters [data-k=date][data-v="' + iso(0) + '"][aria-pressed=true]');
    await phone.waitForSelector('[data-a=fapply]:has-text("Show 1 person")');
    await shot(phone, '04c-board-filters-phone');
    await phone.click('[data-a=fapply]');
    await phone.waitForFunction(() => /Today.*Up to £300/s.test(document.getElementById('frow').textContent));
    assert.match(await phone.textContent('#frow .fbadge'), /^3$/);
    assert.match(await phone.textContent('#count'), /^1 person$/);
    await phone.click('.fbtn');
    await phone.click('[data-a=fclear]');
    await phone.waitForSelector('#f-filters [data-k=city][data-v=""][aria-pressed=true]');
    await phone.click('[data-a=fapply]');
    await phone.waitForFunction(() => /Any date.*Anywhere.*Any day rate/s.test(document.getElementById('frow').textContent));
    assert.equal(await phone.locator('#frow .fbadge').count(), 0);
    await phone.close();
    ok('on a phone, brands switch roles with pills and narrow the board in one filter sheet with a live count');
  }
  {
    // Phone polish: skeletons while the board and a profile load, and empty states with a clear next step
    const phone = await person('rivet-polish', true);
    await phone.goto(`${BASE}/signin`);
    await signIn(phone, 'sam@rivet.test', '12345678');
    await phone.waitForSelector('.feed:not(.skel) .cc');
    // a slow search shows card-shaped skeletons; the search box and pills stay usable
    const slow = async (route) => { await new Promise((r) => setTimeout(r, 900)); await route.continue(); };
    await phone.route('**/rest/v1/rpc/search_talent', slow);
    await phone.click('.cats [data-cat="Model"]');
    await phone.waitForSelector('#results[aria-busy=true] .feed.skel .cc .cc-frame.sk-b');
    assert.equal(await phone.locator('#results .feed.skel .cc').count(), 4);
    assert.ok(await phone.isEnabled('.band [name=q]'));
    await shot(phone, '24-board-skeleton-phone');
    await phone.waitForSelector('.feed:not(.skel) .cc');
    assert.equal(await phone.getAttribute('#results', 'aria-busy'), null);
    // a slow profile opens a skeleton sheet at once, then the real one replaces it (no sheet on a sheet)
    await phone.route('**/rest/v1/rpc/talent_detail', slow);
    await phone.click('.feed .cc .cc-nm');
    await phone.waitForSelector('.sheet .cd-hero.skel');
    await shot(phone, '25-creative-detail-skeleton-phone');
    await phone.waitForSelector('.sheet .cd-name');
    assert.equal(await phone.locator('.sheet').count(), 1);
    assert.equal(await phone.locator('.sheet .skel').count(), 0);
    // every close button is a 48px target
    assert.ok((await phone.locator('.sheet .xbtn').boundingBox()).height >= 48, 'close button is at least 48px');
    await phone.click('.sheet .xbtn');
    await phone.unroute('**/rest/v1/rpc/search_talent');
    await phone.unroute('**/rest/v1/rpc/talent_detail');
    // zero results for a search: say so with the words searched, and offer Clear search
    await phone.fill('.band [name=q]', 'zzqx');
    await phone.waitForSelector('.estate >> text=No one matches “zzqx”');
    for (const sel of ['.estate [data-a=board-clearq]', '.estate [data-a=board-allroles]']) assert.ok((await phone.locator(sel).boundingBox()).height >= 48, sel + ' is at least 48px tall');
    await shot(phone, '26-board-no-results-phone');
    await phone.click('.estate [data-a=board-clearq]');
    await phone.waitForSelector('.feed .cc');
    assert.equal(await phone.inputValue('.band [name=q]'), '');
    // a role with nobody yet: one button back to every role
    await phone.click('.cats [data-cat="Nail technician"]');
    await phone.waitForSelector('.estate >> text=No nail technicians match these filters');
    await phone.click('.estate [data-a=board-allroles]');
    await phone.waitForSelector('.cats [data-cat=""][aria-pressed=true]');
    await phone.waitForSelector('.feed .cc');
    // filters that rule everyone out: Clear filters brings people back
    await phone.click('.frow [data-sec=rate]');
    await phone.fill('#f-filters [name=max_rate]', '10');
    await phone.waitForSelector('[data-a=fapply]:has-text("No one matches")');
    await phone.click('[data-a=fapply]');
    await phone.waitForSelector('.estate >> text=No one matches these filters');
    await phone.click('.estate [data-a=board-reset]');
    await phone.waitForSelector('.feed .cc');
    // an empty Shoot Roster keeps the shoot and points at the board on the shoot date
    await phone.click('.feed .cc .cc-add');
    await phone.click('.shootsheet .shoot-row >> text=A new shoot');
    await phone.waitForSelector('#rosterbar .rbar');
    await phone.waitForTimeout(300);
    if (!(await phone.locator('.sheet #f-roster').count())) await phone.click('#rosterbar .rbar');
    await phone.fill('#f-roster [name=title]', 'Spring shoot');
    await phone.fill('#f-roster [name=date]', iso(20));
    await phone.dispatchEvent('#f-roster [name=date]', 'change');
    await phone.click('.rr-x');
    await phone.waitForSelector('.rcrew .estate >> text=No one on this shoot yet');
    assert.equal(await phone.locator('.rneed').count(), 0);
    assert.equal(await phone.locator('.sheet .ft').count(), 0);
    assert.equal(await phone.inputValue('#f-roster [name=title]'), 'Spring shoot');
    for (const b of await phone.locator('.rcrew .estate .btn').all()) assert.ok((await b.boundingBox()).height >= 48, 'empty roster buttons are 48px');
    await shot(phone, '27-empty-roster-phone');
    await phone.click('.rcrew .estate [data-a=roster-find][data-role="Photographer"]');
    await phone.waitForFunction(() => document.querySelector('.cats [data-cat="Photographer"]')?.getAttribute('aria-pressed') === 'true');
    assert.equal(await phone.locator('.sheet #f-roster').count(), 0);
    await phone.close();
    ok('Phone polish: skeletons while the board and a profile load, empty states with a next step for no results, an empty role and an empty Shoot Roster, 48px close buttons');
  }
  await rivet.click('nav.main >> text=Jobs');
  await rivet.click('button[data-a=postjob]');
  await rivet.fill('#f-job [name=title]', 'Drop 4 lookbook');
  await rivet.fill('#f-job [name=shoot_date]', iso(10));
  await rivet.fill('#f-job [name=day_rate]', '240');
  await rivet.selectOption('#f-job [name=sizing]', 'womenswear');
  await rivet.fill('#f-job [name=height_min]', '172');
  await rivet.fill('#f-job [name=height_max]', '183');
  await rivet.click('#f-job [data-name=dress][data-v="8"]');
  await rivet.click('#f-job [data-name=dress][data-v="10"]');
  // usage on the brief: several uses at once, a custom length, and a usage fee apart from the day rate (Luke's snag list)
  await rivet.click('#f-job [data-grp=where][data-k=web]');
  await rivet.click('#f-job [data-grp=months][data-k=custom]');
  await rivet.fill('#f-job [name=usage_months]', '5');
  await rivet.waitForSelector('#f-job .usage-say >> text=/Own social posts and website and shop, for 5 months/');
  assert.equal(await rivet.locator('#f-job [name=day_hours]').count(), 0);
  await rivet.fill('#f-job [name=usage_fee]', '40');
  await rivet.locator('#f-job .usagepick').scrollIntoViewIfNeeded();
  await shot(rivet, '05b-brief-usage');
  await rivet.locator('#f-job [data-specs]').scrollIntoViewIfNeeded();
  await shot(rivet, '05a-brief-model-details');
  await rivet.click('button[form=f-job]');
  await rivet.waitForSelector('.sheet >> text=Womenswear · 172–183cm · dress UK 8, 10');
  await rivet.waitForSelector('h3:has-text("Best fit for this brief")');
  await rivet.waitForSelector('.sheet >> text=Usage: Own social posts, Website and shop · 5 months · UK · usage fee £40 per person');
  ok('a brief takes several usages, a custom 5-month length and a usage fee separate from the day rate');
  await rivet.waitForSelector('.sheet .comp >> text=Amara Okafor');
  // each person in the best-fit list says why they fit, checked against the brief
  const fit = await rivet.textContent('.sheet .fit');
  assert.match(fit, /Free /); assert.match(fit, /Based in Manchester/); assert.match(fit, /£250 a day, £10 over yours/); assert.match(fit, /Matches your model details/);
  await rivet.locator('.sheet button[data-a=offer]').scrollIntoViewIfNeeded();
  await shot(rivet, '05-brief-best-fit');
  ok('brand posts a brief and Embr ranks who fits, with the reasons beside each person');
  {
    // "Add to shoot" on the card: a short sheet with the brand's open briefs; picking one opens the offer form filled from it
    const phone = await person('rivet-phone2', true);
    await phone.goto(`${BASE}/signin`);
    await signIn(phone, 'sam@rivet.test', '12345678');
    await phone.waitForSelector('.feed .cc');
    // brand phone tab bar: Account sits in the bar; Jobs and Shortlist are under More
    assert.deepEqual(await phone.locator('.botnav button span:not(.flag)').allTextContents(), ['Board', 'Bookings', 'Messages', 'Account', 'More']);
    // swiping the photos moves the dots
    await phone.locator('.feed .cc >> nth=0 >> .cc-media').evaluate((m) => { m.scrollLeft = m.clientWidth * 3; });
    await phone.waitForFunction(() => document.querySelectorAll('.feed .cc .cc-dots i')[3]?.classList.contains('on'));
    await shot(phone, '04d-creative-card-reel-phone');
    await phone.locator('.feed .cc >> nth=0 >> .cc-media').evaluate((m) => { m.scrollLeft = 0; });
    await phone.waitForFunction(() => document.querySelectorAll('.feed .cc .cc-dots i')[0]?.classList.contains('on'));
    await shot(phone, '04e-creative-card-phone');
    await phone.click('.feed .cc >> nth=0 >> .cc-add');
    await phone.waitForSelector('.dialog.shootsheet >> text=Add Amara to a shoot');
    await phone.waitForSelector('.shootsheet .shoot-row >> text=Drop 4 lookbook');
    await phone.waitForSelector('.shootsheet .shoot-row >> text=A new shoot');
    assert.ok((await phone.locator('.shootsheet .shoot-row').first().boundingBox()).height >= 48);
    await shot(phone, '04f-add-to-shoot-phone');
    // Shoot Roster: picking the brief starts a roster for it, adds her, and keeps the brand on the board with a roster bar
    await phone.click('.shootsheet .shoot-row >> text=Drop 4 lookbook');
    await phone.waitForSelector('#rosterbar .rbar >> text=Drop 4 lookbook');
    assert.equal(await phone.locator('.dialog.shootsheet').count(), 0);
    assert.match(await phone.textContent('#rosterbar'), /1 person.*£250.*day rates/s);
    assert.ok((await phone.locator('#rosterbar .rbar').boundingBox()).height >= 48);
    // the bar sits above the tab bar, not over it
    const [bar, nav] = await Promise.all([phone.locator('#rosterbar').boundingBox(), phone.locator('.botnav').boundingBox()]);
    assert.ok(bar.y + bar.height <= nav.y, 'roster bar clears the tab bar');
    await shot(phone, '04g-roster-bar-phone');
    // adding her again says so instead of adding her twice; the sheet now lists the roster first
    await phone.click('.feed .cc >> nth=0 >> .cc-add');
    await phone.waitForSelector('.shootsheet h3:has-text("Your shoot rosters")');
    await phone.click('.shootsheet .shoot-row >> text=already in');
    await toastHas(phone, /already in this shoot/);
    // the roster: shared date from the brief, her as a model, missing roles, the combined cost
    await phone.click('#rosterbar .rbar');
    await phone.waitForSelector('.sheet #f-roster');
    assert.equal(await phone.inputValue('#f-roster [name=title]'), 'Drop 4 lookbook');
    assert.equal(await phone.inputValue('#f-roster [name=date]'), iso(10));
    assert.equal(await phone.getAttribute('.rperson .skillpick [data-k="Model"]', 'aria-pressed'), 'true');
    assert.equal(await phone.locator('.rrow').count(), 1);
    assert.equal(await phone.inputValue('.rperson [data-k=usage_fee]'), '40');
    assert.equal(await phone.getAttribute('#f-roster [data-grp=months][data-k=custom]', 'aria-pressed'), 'true');
    ok('a roster from a brief carries its usage, custom length and each model\'s usage fee');
    const need = await phone.locator('.rneed b').allTextContents();
    assert.deepEqual(need, ['Need a photographer?', 'Need a make-up artist?', 'Need a hair stylist?']);
    await phone.waitForSelector('#rquote >> text=Total for 1 person');
    await phone.fill('.rperson [data-k=usage_fee]', '0');
    await phone.waitForFunction(() => /£275/.test(document.querySelector('.sheet .ft')?.textContent || ''));
    assert.match(await phone.textContent('.sheet .ft'), /£275.*Send offer/s);
    for (const sel of ['.rneed', '.rr-x', '.rr-money .in', '.rperson .skillpick .chip', '.sheet .ft .btn.primary']) assert.ok((await phone.locator(sel).first().boundingBox()).height >= 48, sel + ' is at least 48px tall');
    await phone.fill('#f-roster [name=location]', 'Ancoats studio');
    await shot(phone, '04h-shoot-roster-phone');
    // a two-day shoot: the dates read as a range, and each person is booked for the days picked under their name
    await phone.fill('#f-roster [name=days]', '2');
    await phone.dispatchEvent('#f-roster [name=days]', 'change');
    await phone.waitForSelector('.rperson .rr-days .chip >> nth=1');
    assert.match(await phone.textContent('#rrange'), / – /);
    assert.match(await phone.textContent('#rosterbar'), / – /);
    assert.equal(await phone.locator('.rperson .rr-days .chip[aria-pressed=true]').count(), 2);
    await phone.waitForSelector('#rquote >> text=/2 days at £250/');
    await phone.click('.rperson .rr-days .chip >> nth=0');
    await phone.waitForSelector('#rquote >> text=/1 day at £250/');
    assert.equal(await phone.locator('.rperson .rr-days .chip[aria-pressed=true]').count(), 1);
    await phone.click('.rperson .skillpick [data-k="UGC creator"]');
    await phone.waitForSelector('#rquote >> text=/Model and UGC creator/');
    await phone.fill('.rperson [data-k=usage_fee]', '100');
    await phone.waitForSelector('#rquote >> text=/£100 usage/');
    for (const sel of ['.rr-days .chip']) assert.ok((await phone.locator(sel).first().boundingBox()).height >= 40, sel);
    await phone.locator('.rperson').scrollIntoViewIfNeeded();
    await shot(phone, '04i-roster-days-skills-phone');
    ok('Shoot Roster: a two-day shoot shows its date range, books each person for the days picked, with several skills and their own usage fee');
    // a UGC creator films themselves, so the photographer prompt only comes back once she's booked as a model alone
    assert.ok(!(await phone.locator('.rneed b').allTextContents()).includes('Need a photographer?'));
    await phone.click('.rperson .skillpick [data-k="UGC creator"]');
    await phone.waitForSelector('.rneed >> text=Need a photographer?');
    // "Need a photographer?" goes back to the board on that role, free on the shoot date
    await phone.click('.rneed >> text=Need a photographer?');
    await phone.waitForFunction(() => document.querySelector('.cats [data-cat="Photographer"]')?.getAttribute('aria-pressed') === 'true');
    assert.equal(await phone.locator('.sheet #f-roster').count(), 0);
    await phone.waitForFunction(() => /0 people/.test(document.getElementById('count').textContent));
    // the roster kept what was typed
    await phone.click('#rosterbar .rbar');
    assert.equal(await phone.inputValue('#f-roster [name=location]'), 'Ancoats studio');
    await phone.click('.rdel');
    await toastHas(phone, /Roster deleted/);
    assert.equal(await phone.locator('#rosterbar').count(), 0);
    await phone.close();
    ok('Shoot Roster: "Add to shoot" starts a roster from a brief, the bar shows head count and day rates, and the roster flags missing roles');
  }
  {
    // Creative detail: a pushed full screen with the photos edge to edge, packages and a sticky "Add to shoot" bar
    const phone = await person('rivet-phone3', true);
    await phone.goto(`${BASE}/signin`);
    await signIn(phone, 'sam@rivet.test', '12345678');
    await phone.waitForSelector('.feed .cc');
    await phone.click('.feed .cc:has-text("Amara Okafor") .cc-nm');
    await phone.waitForSelector('.sheet .cd-hero img');
    assert.match(await phone.textContent('.sheet .cd-count'), /1 \/ 4/); // three photos and her first video link
    assert.equal(await phone.locator('.sheet .pkg').count(), 2);
    assert.equal(await phone.getAttribute('.sheet .pkg[data-k=full]', 'aria-checked'), 'true');
    assert.match(await phone.textContent('.sheet .ft'), /£250\s*full day.*Add to shoot/s);
    const ft = await phone.locator('.sheet .ft').boundingBox();
    assert.ok(ft.y + ft.height >= 843, 'the bar sits at the bottom of the screen');
    assert.ok(await phone.evaluate(() => !!document.elementFromPoint(195, 830)?.closest('.sheet')), 'the tab bar is covered while on the detail screen');
    for (const sel of ['.sheet .pkg', '.sheet .cd-add', '.sheet .cd-save']) assert.ok((await phone.locator(sel).first().boundingBox()).height >= 48, sel + ' is at least 48px tall');
    await shot(phone, '04i-creative-detail-phone');
    await phone.locator('.sheet .cd-media').evaluate((m) => { m.scrollLeft = m.clientWidth; m.dispatchEvent(new Event('scroll')); });
    await phone.waitForSelector('.sheet .cd-i >> text=2');
    // picking the half day moves the price in the bar
    await phone.click('.sheet .pkg[data-k=half]');
    assert.match(await phone.textContent('.sheet .ft'), /£150\s*half day/);
    assert.match(await phone.textContent('.sheet .pkg[data-k=half]'), /Up to 4 hours.*One look, natural make-up.*£150/s);
    await phone.locator('.sheet .pkgs').scrollIntoViewIfNeeded();
    await shot(phone, '04j-creative-detail-packages-phone');
    // her blocked dates show as unavailable in the next six weeks
    assert.equal(await phone.locator(`.sheet .cal .d.off[title*="unavailable"]`).count() >= 2, true);
    // "Add to shoot" uses the Shoot Roster: the half day sets her rate and one day in the roster
    await phone.click('.sheet .cd-add');
    await phone.waitForSelector('.shootsheet');
    await phone.click('.shootsheet .shoot-row:has-text("A new shoot")');
    await phone.waitForSelector('.sheet #f-roster');
    assert.match(await phone.textContent('#f-roster .rr-pkg'), /Half day · up to 4 hours · one day/);
    assert.equal(await phone.inputValue('#f-roster [data-k=day_rate]'), '150');
    await phone.waitForFunction(() => /half day at £150/.test(document.getElementById('rquote')?.textContent || ''));
    // back on her profile the half day is still picked, and an offer on its own starts from it
    await phone.click('.sheet:has(#f-roster) .xbtn');
    await phone.waitForSelector('.sheet .pkg[data-k=half][aria-checked=true]');
    await phone.click('.sheet .cd-single [data-a=offer]');
    await phone.waitForSelector('#f-offer');
    assert.equal(await phone.inputValue('#f-offer [name=day_rate]'), '150');
    assert.equal(await phone.inputValue('#f-offer [name=days]'), '1');
    assert.equal(await phone.inputValue('#f-offer [name=pkg]'), 'half');
    assert.match(await phone.textContent('#pkg-note'), /Package: Half day, up to 4 hours\. Includes: One look, natural make-up\./);
    await phone.click('#f-offer [data-a=offer-pkg][data-k=full]');
    assert.equal(await phone.inputValue('#f-offer [name=day_rate]'), '250');
    await phone.close();
    ok('Creative detail: brands pick a full or half day, and the sticky "Add to shoot" bar feeds the Shoot Roster and the offer form');
  }
  await rivet.click('.sheet button[data-a=offer]');
  await rivet.waitForSelector('#f-offer');
  await rivet.waitForSelector('#quote >> text=Embr fee, 10%');
  assert.equal(await rivet.getAttribute('#f-offer .skillpick [data-k="Model"]', 'aria-pressed'), 'true');
  assert.equal(await rivet.getAttribute('#f-offer .skillpick [data-k="UGC creator"]', 'aria-pressed'), 'false');
  assert.equal(await rivet.inputValue('#f-offer [name=usage_fee]'), '40');
  assert.equal(await rivet.getAttribute('#f-offer [data-grp=months][data-k=custom]', 'aria-pressed'), 'true');
  assert.equal(await rivet.inputValue('#f-offer [name=usage_months]'), '5');
  ok('an offer from the brief starts with its usage, custom length and usage fee');
  await rivet.fill('#f-offer [name=day_rate]', '250');
  await rivet.fill('#f-offer [name=usage_fee]', '50');
  await rivet.fill('#f-offer [name=location]', 'Ancoats studio');
  await rivet.fill('#f-offer [name=call_time]', '9am');
  await rivet.fill('#f-offer [name=content_agreed]', 'Streetwear, no swimwear');
  // usage in plain English: chips for where, how long and which countries, with the sentence the talent will read
  assert.equal(await rivet.getAttribute('#f-offer [data-grp=where][data-k=social]', 'aria-pressed'), 'true');
  await rivet.click('#f-offer [data-grp=where][data-k=web]');
  await rivet.click('#f-offer [data-grp=where][data-k=paid_social]');
  await rivet.click('#f-offer [data-grp=months][data-k="6"]');
  await rivet.fill('#f-offer [name=day_hours]', '10');
  await rivet.waitForSelector('#f-offer .usage-say >> text=/Own social posts and paid social ads, for 6 months from the day it first goes live, in the UK/');
  ok('brands pick usage from plain-English chips and see the sentence the talent will read');
  await rivet.waitForFunction(() => /£330/.test(document.getElementById('quote')?.textContent || ''));
  await shot(rivet, '06-offer-form');
  ok('offer form shows the live quote: £300 to talent + 10% = £330');
  await rivet.check('#f-offer [name=agree]');
  await rivet.click('button[form=f-offer]');
  await rivet.waitForSelector('.sheet .st:has-text("Offer sent")');
  await rivet.waitForSelector('.sheet >> text=Booked as Model');
  await rivet.waitForSelector('.sheet >> text=Their phone number shows here once the deposit confirms the booking.');
  assert.doesNotMatch(await rivet.textContent('.sheet'), /7700/);
  ok('the brand sees no phone number on an offer');
  ok('offer sent with the booking agreement, booking her as a model');

  // ---------------------------------------------------------------- talent accepts
  await amara.reload();
  await amara.waitForSelector('.todo >> text=Review offer');
  await amara.click('.todo >> text=Review offer');
  await amara.waitForSelector('.sheet >> text=You get');
  // the pay sits beside Accept, not only further down the sheet
  assert.match(await amara.textContent('.sheet .ft .payline'), /You get£\d+/);
  await amara.locator('.sheet .ft button[data-a=accept]').waitFor();
  await shot(amara, '07-talent-offer-phone');
  await amara.click('.sheet button[data-a=accept]');
  await amara.waitForSelector('.sheet >> text=Review and sign');
  await amara.waitForSelector('.sheet >> text=Posts on their own Instagram, TikTok and similar. Not paid ads.');
  await amara.waitForSelector('.sheet >> text=Up to 10 a day, including breaks');
  assert.equal(await amara.isDisabled('#sign-btn'), true);
  await amara.check('#f-sign [name=agree]');
  assert.equal(await amara.isDisabled('#sign-btn'), true);
  await amara.fill('#f-sign [name=sign_name]', 'Amara Okafor');
  assert.equal(await amara.isDisabled('#sign-btn'), false);
  await shot(amara, '07b-review-and-sign-phone');
  ok('talent read a plain-English summary first; Sign and accept stays off until the box is ticked and the name typed');
  await amara.click('#sign-btn');
  await amara.waitForSelector('.sheet .st:has-text("Accepted, awaiting deposit")');
  const [sig] = await sql("select talent_signed_name, agreement_sha, usage_terms, day_hours from bookings where title = 'Drop 4 lookbook'");
  assert.equal(sig.talent_signed_name, 'Amara Okafor'); assert.ok(sig.agreement_sha);
  assert.deepEqual(sig.usage_terms, { where: ['paid_social', 'social'], months: 6, area: 'uk' }); assert.equal(sig.day_hours, 10);
  await amara.waitForSelector('.sheet >> text=/signed as “Amara Okafor”/');
  ok('talent signs by typing their name; the booking shows who signed and when');
  await amara.click('.sheet .cs-sec button[data-a=agreement]');
  await amara.waitForSelector('.dialog >> text=Fingerprint of the signed text');
  const [dl] = await Promise.all([amara.waitForEvent('download'), amara.click('.dialog button[data-a=agreement-copy]')]);
  assert.match(dl.suggestedFilename(), /^Embr-EMB-[A-Z0-9]+-agreement\.txt$/);
  const copy = await (await import('node:fs')).promises.readFile(await dl.path(), 'utf8');
  assert.match(copy, /11\. Signing/); assert.match(copy, /Talent: signed as "Amara Okafor"/); assert.match(copy, /SHA-256/);
  await amara.keyboard.press('Escape');
  ok('either side can save a copy of the signed agreement, with the signature record');

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
  await amara.waitForTimeout(200);
  assert.equal(await amara.isVisible('text=Send your booking link'), false);
  await amara.fill('#f-link [name=sign_name]', 'Amara Okafor');
  await amara.check('#f-link [name=agree]');
  await amara.click('button[form=f-link]');
  await amara.waitForSelector('text=Send your booking link');
  const linkUrl = await amara.inputValue('.dialog input[readonly]');
  ok('talent creates a booking link with a ready-written reply');
  const cafe = await person('cafe', true);
  await cafe.goto(linkUrl);
  await cafe.waitForSelector('text=has invited you to book through Embr');
  await cafe.waitForSelector('text=£231');
  await cafe.waitForSelector('text=has already signed these terms');
  await shot(cafe, '10-link-landing-phone');
  await cafe.click('button[data-a=pub-join]');
  await signIn(cafe, 'owner@cafe.test', '123456', true); // "I already have a code": no new email sent
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
  await luke.goto(`${BASE}/admin/overview`);
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
  await bm.waitForSelector('.role-sec h3:has-text("UGC creator")');
  await bm.waitForSelector('.linkcard >> text=Trainers unboxing');
  assert.equal(await bm.evaluate(() => window.__xss), undefined);
  assert.match(await bm.textContent('main'), /<img src=x onerror=/);
  const hdr = (await bm.request.get(`${BASE}/@amara`)).headers();
  assert.match(hdr['content-security-policy'] || '', /script-src 'self'/);
  assert.equal(hdr['x-frame-options'], 'DENY');
  await shot(bm, '12-bookme-phone');
  ok('public Book-me page at /@amara shows every role');
  ok('typed-in text shows as text, never runs as code, and pages send the security headers (CSP, no framing)');
  await luke.goto(`${BASE}/admin/people`);
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
  await amara.goto(`${BASE}/today`);
  await amara.waitForSelector('.mile.done >> text=First brand view');
  await amara.waitForSelector('.mile.done >> text=First offer');
  const todayText = (await amara.textContent('main')).toLowerCase();
  assert.ok(!/find work|jobs for you|apply for (a |the )?(job|brief|work)|apply now|join to get work/.test(todayText));
  for (const sel of ['.tiles', '.miles', '.panel:has-text("This week on Embr")']) assert.doesNotMatch(await amara.locator(sel).first().textContent(), /Rivet|Northern/);
  await amara.screenshot({ path: `${SHOTS}/15-talent-today-full-phone.png`, fullPage: true });
  ok('talent Today counts brand views and offers without naming brands, and never reads as a jobs board');
  await amara.goto(`${BASE}/admin/people`);
  await amara.waitForSelector('text=This is the Embr admin website');
  assert.equal(await amara.locator('text=18+ verified').count(), 0);
  ok('talent and brands can\'t use the admin website');

  {
    // Shoot Roster: two creatives, one date and place, one "Send 2 offers"; under the hood one offer each
    const jade = '00000000-0000-4000-8000-00000000aa01';
    await sql(`insert into auth.users (id, email) values ($1, 'jade@test.com')`, [jade]);
    await sql(`insert into profiles (id, role, email) values ($1, 'talent', 'jade@test.com')`, [jade]);
    await sql(`insert into talents (id, handle, name, category, roles, city, day_rate, published, age_verified, payouts_enabled, agency_declared_at)
               values ($1, 'jade', 'Jade Park', 'Make-up artist', '{Make-up artist}', 'Manchester', 180, true, true, true, now())`, [jade]);
    const before = (await sql(`select count(*)::int n from bookings`))[0].n;
    const phone = await person('rivet-phone3', true);
    await phone.goto(`${BASE}/signin`);
    await signIn(phone, 'sam@rivet.test', '12345678');
    await phone.waitForSelector('.feed .cc >> text=Jade Park');
    await phone.click('.feed .cc:has-text("Amara Okafor") .cc-add');
    await phone.click('.shootsheet .shoot-row >> text=A new shoot');
    // a new shoot opens the roster straight away to name it and set the day
    await phone.waitForSelector('.sheet #f-roster');
    await phone.fill('#f-roster [name=title]', 'Autumn campaign');
    await phone.fill('#f-roster [name=date]', iso(30));
    await phone.fill('#f-roster [name=location]', 'Mayfield Depot');
    await phone.fill('#f-roster [name=call_time]', '8am');
    await phone.keyboard.press('Escape');
    await phone.waitForSelector('#rosterbar >> text=Autumn campaign');
    await phone.click('.feed .cc:has-text("Jade Park") .cc-add');
    await phone.click('.shootsheet .shoot-row >> text=Autumn campaign');
    await phone.waitForFunction(() => /2 people.*£430/s.test(document.getElementById('rosterbar')?.textContent || ''));
    await phone.click('#rosterbar .rbar');
    await phone.waitForSelector('#rquote >> text=Total for 2 people');
    // a make-up artist is in, so she is no longer suggested; a photographer still is
    const need = await phone.locator('.rneed b').allTextContents();
    assert.ok(need.includes('Need a photographer?') && !need.includes('Need a make-up artist?'), need.join());
    const total = (await phone.textContent('#rquote .r.t')).match(/£[\d,.]+/)[0];
    assert.equal(await phone.textContent('#rtotal'), total);
    assert.match(await phone.textContent('.sheet .ft .btn.primary'), /Send 2 offers/);
    await shot(phone, '16-shoot-roster-two-phone');
    // the shared brief: a moodboard image, a link and notes for everyone
    await phone.setInputFiles('#f-roster .moodedit input[type=file]', PHOTOS[1]);
    await phone.waitForSelector('#f-roster .me-i img');
    await phone.fill('#f-roster [name=board_link]', 'https://example.com/autumn-board');
    await phone.fill('#f-roster [name=notes]', 'Warm tones, chunky knitwear. Bring neutral underwear.');
    await phone.check('#f-roster [name=agree]');
    await phone.click('.sheet .ft .btn.primary');
    await toastHas(phone, /2 offers sent for Autumn campaign/);
    await phone.waitForSelector('h1:has-text("Bookings")');
    assert.equal(await phone.locator('#rosterbar').count(), 0);
    // Shoot Thread: the brand lands on the shoot, with the brief pinned and one offer card per person
    await phone.waitForSelector('.sheet.shootthread .sbrief >> text=Sent to 2 people');
    assert.equal(await phone.locator('.shootthread .sbrief .mood-i img').count(), 1);
    assert.equal(await phone.locator('.shootthread .sall .ocard').count(), 2);
    assert.equal(await phone.locator('.shootthread .pchip').count(), 3);
    for (const sel of ['.shootthread .pchip', '.shootthread .sbrief summary', '.shootthread .scompose .in', '.shootthread .oc-open']) assert.ok((await phone.locator(sel).first().boundingBox()).height >= 48, sel + ' is at least 48px tall');
    await shot(phone, '17-shoot-thread-phone');
    // one message to everyone lands in each person's own booking chat
    await phone.fill('#f-shootmsg [name=body]', 'Call sheet: parking is round the back.');
    await phone.click('#f-shootmsg button[type=submit]');
    await toastHas(phone, /Sent to 2 people/);
    const [{ id: amaraB }] = await sql(`select b.id from bookings b join talents t on t.id = b.talent_id where b.title = 'Autumn campaign' and t.name = 'Amara Okafor'`);
    const [{ id: jadeB }] = await sql(`select b.id from bookings b join talents t on t.id = b.talent_id where b.title = 'Autumn campaign' and t.name = 'Jade Park'`);
    // the creative sees the brief on her offer and can ask the brand for a change, never make an offer
    await amara.goto(`${BASE}/booking/${amaraB}`);
    await amara.waitForSelector('.sheet .cs-sec h4:has-text("The shoot brief")');
    assert.equal(await amara.locator('.sheet .mood-i img').count(), 1);
    await amara.waitForSelector('.sheet .sb-txt >> text=chunky knitwear');
    await amara.waitForSelector('.sheet .bubble.them >> text=parking is round the back');
    assert.doesNotMatch(await amara.textContent('.sheet'), /Jade|£180/);
    await amara.click('.sheet [data-a=ask-change]');
    await amara.fill('#f-askchange [name=day_rate]', '280');
    await amara.fill('#f-askchange [name=note]', 'Knitwear needs a fitting the day before.');
    await shot(amara, '18a-ask-change-phone');
    await amara.click('button[form=f-askchange]');
    await amara.waitForSelector('.sheet .chcard >> text=You asked for a change');
    assert.equal(await amara.locator('.sheet [data-a=ask-change]').count(), 0);
    await amara.locator('.sheet .chcard').scrollIntoViewIfNeeded();
    await shot(amara, '18-talent-shoot-offer-phone');
    // the brand sees the change card in her chat and updates the offer: same fee rules, new agreement
    const [{ total_p: sentTotal, fee_rate: feeRate }] = await sql(`select total_p, fee_rate::float fee_rate from bookings where id = $1`, [amaraB]);
    await phone.click('.shootthread .pchip:has-text("Amara")');
    await phone.waitForSelector('.shootthread .chcard.open >> text=£280 a day');
    await shot(phone, '19-shoot-thread-change-phone');
    await phone.click('.shootthread [data-a=change-answer][data-yes="1"]');
    await phone.waitForSelector('.dialog >> text=Update the offer to £280 a day?');
    await phone.click('[data-a=cd-yes]');
    await toastHas(phone, /Offer updated/);
    await phone.waitForSelector('.shootthread .chcard >> text=Offer updated to £280 a day');
    const [up] = await sql(`select day_rate, talent_fee_p, total_p, status, agreement_text like '%£280%' agr from bookings where id = $1`, [amaraB]);
    assert.deepEqual([up.day_rate, up.talent_fee_p, up.total_p, up.status, up.agr], [280, 28000, 28000 + Math.round(28000 * feeRate), 'offer', true]);
    // she accepts the updated offer; Jade accepts hers
    await amara.goto(`${BASE}/booking/${amaraB}`);
    await amara.click('.sheet button[data-a=accept]');
    await amara.waitForSelector('.sheet:has(#f-sign) >> text=/£280/');
    await amara.check('#f-sign [name=agree]');
    await amara.fill('#f-sign [name=sign_name]', 'Amara Okafor');
    await amara.click('#sign-btn');
    await amara.waitForSelector('.sheet .st:has-text("Accepted, awaiting deposit")');
    await sql(`update talents set stripe_account = 'acct_jade_test' where name = 'Jade Park'`);
    await sql(`update bookings set status = 'accepted', talent_agreed_at = now() where id = $1`, [jadeB]);
    // one sticky pay bar for the shoot, then one checkout with every deposit, the cancellation timeline and the protections
    await phone.click('.shootthread .pchip:has-text("Amara")');
    await phone.waitForSelector('.shootthread .paybar >> text=Pay 2 deposits');
    await shot(phone, '19b-shoot-thread-pay-phone');
    await phone.click('.shootthread .paybar');
    await phone.waitForSelector('.sheet.scheck');
    assert.equal(await phone.locator('.scheck .ck-row').count(), 2);
    const ck = await phone.textContent('.scheck .bd');
    const deps = await sql(`select deposit_p from bookings where id in ($1, $2)`, [amaraB, jadeB]);
    const money = (p) => '£' + (p / 100).toLocaleString('en-GB', p % 100 ? { minimumFractionDigits: 2 } : {});
    const [{ deposit_p: depA }] = await sql(`select deposit_p from bookings where id = $1`, [amaraB]);
    const [{ deposit_p: depJ }] = await sql(`select deposit_p from bookings where id = $1`, [jadeB]);
    assert.ok(ck.includes(money(depA)) && ck.includes(money(depJ)), ck);
    void deps; assert.match(ck, /Cancel anyone for a full refund/); assert.match(ck, /50% of their session fee/);
    assert.match(ck, /Stripe holds each deposit/); assert.match(ck, /waiting for solicitor review/);
    assert.ok((await phone.textContent('.scheck .ft')).includes(money(depA + depJ)));
    assert.match(await phone.textContent('.scheck .ft'), /Pay Amara's deposit first/);
    await shot(phone, '20-shoot-checkout-phone');
    await phone.locator('.scheck .prot').scrollIntoViewIfNeeded();
    await shot(phone, '20b-shoot-checkout-terms-phone');
    // each deposit is still its own Stripe Checkout, run one after the other from the shoot checkout
    await phone.click('.scheck [data-a=shoot-pay-go]');
    await phone.waitForURL(/__fake_stripe\/checkout/);
    assert.ok((await phone.textContent('h1')).includes((depA / 100).toFixed(2)));
    await phone.click('#pay');
    await phone.waitForSelector('.sheet.scheck >> text=1 deposit paid. 1 more to go.');
    await phone.click('.scheck [data-a=shoot-pay-go]');
    await phone.waitForURL(/__fake_stripe\/checkout/);
    assert.ok((await phone.textContent('h1')).includes((depJ / 100).toFixed(2)));
    await phone.click('#pay');
    await toastHas(phone, /Every deposit is paid/);
    const paidRows = await sql(`select status from bookings where id in ($1, $2) order by id`, [amaraB, jadeB]);
    assert.deepEqual(paidRows.map((r) => r.status), ['confirmed', 'confirmed']);
    await phone.goto(`${BASE}/bookings`);
    await phone.waitForSelector('h2:has-text("Shoots") + .list .item >> text=Autumn campaign');
    await shot(phone, '21-brand-bookings-shoots-phone');
    ok('Shoot Thread: one brief with a moodboard, message everyone, a creative asks for a change, the brand updates the offer, and one shoot checkout takes each deposit in turn');
    await phone.goto(`${BASE}/board`);
    const rows = await sql(`select t.name, b.title, b.shoot_date::text d, b.location, b.call_time, b.status, b.role, b.total_p from bookings b join talents t on t.id = b.talent_id where b.title = 'Autumn campaign' order by t.name`);
    assert.equal((await sql(`select count(*)::int n from bookings`))[0].n, before + 2);
    assert.deepEqual(rows.map((r) => [r.name, r.d, r.location, r.call_time, r.status, r.role]),
      [['Amara Okafor', iso(30), 'Mayfield Depot', '8am', 'confirmed', 'Model'], ['Jade Park', iso(30), 'Mayfield Depot', '8am', 'confirmed', 'Make-up artist']]);
    // the roster total was for the offers as sent (Amara's rate changed to £280 afterwards)
    const sumP = rows.reduce((n, r) => n + r.total_p, 0) - (rows[0].total_p - sentTotal);
    assert.equal('£' + (sumP / 100).toLocaleString('en-GB', sumP % 100 ? { minimumFractionDigits: 2 } : {}), total);
    // Shoot Day Hub: once people are confirmed the shoot opens on its day screen
    await phone.goto(`${BASE}/bookings`);
    await phone.click('h2:has-text("Shoots") + .list .item:has-text("Autumn campaign")');
    await phone.waitForSelector('.sheet.shootday .sd-band >> text=In 30 days');
    assert.equal(await phone.locator('.shootday .sd-roster .sd-row').count(), 2);
    assert.equal(await phone.locator('.shootday .sd-tel').count(), 1);
    assert.equal(await phone.getAttribute('.shootday .sd-tel', 'href'), 'tel:+447700900123');
    assert.ok((await phone.locator('.shootday .sd-tel').boundingBox()).height >= 48);
    ok('once confirmed, the shoot day shows a Call button for each person who added a number');
    const band = await phone.textContent('.shootday .sd-band');
    assert.match(band, /8am/); assert.match(band, /Mayfield Depot/);
    assert.equal(await phone.getAttribute('.shootday .sd-band a.dirbtn', 'href'), 'https://www.google.com/maps/dir/?api=1&destination=Mayfield%20Depot');
    assert.equal(await phone.getAttribute('.shootday .sd-band a.dirbtn', 'target'), '_blank');
    assert.match(await phone.textContent('.shootday .sd-roster'), /Amara Okafor.*Model.*8am.*Confirmed.*Jade Park.*Make-up artist.*8am.*Confirmed/s);
    assert.doesNotMatch(await phone.textContent('.shootday .bd'), /£/); // a day screen, not a money screen: money stays on each booking
    for (const sel of ['.shootday .sd-row', '.shootday a.dirbtn', '.shootday [data-a=copy-place]', '#f-daymsg .in', '#f-daymsg .btn', '.shootday .sd-thread']) assert.ok((await phone.locator(sel).first().boundingBox()).height >= 48, sel + ' is at least 48px tall');
    assert.match(await phone.textContent('.shootday .sd-track li.now'), /Shoot day.*Next/s);
    assert.equal(await phone.locator('.shootday .sd-track li.now.act').count(), 0); // nothing needs the brand before the day, so no orange
    assert.equal(await phone.locator('.shootday .sd-track li.soon').count(), 2);
    await shot(phone, '22-shoot-day-hub-phone');
    // the group chat: one message reaches everyone, each in their own chat, and shows once
    await phone.fill('#f-daymsg [name=body]', 'Running 10 minutes late, start at 8.10.');
    await phone.click('#f-daymsg button[type=submit]');
    await toastHas(phone, /Sent to 2 people/);
    await phone.waitForSelector('.shootday .sd-msg:has-text("You to everyone") >> text=Running 10 minutes late');
    assert.equal(await phone.locator('.shootday .sd-msg:has-text("Running 10 minutes late")').count(), 1);
    assert.equal((await sql(`select count(*)::int n from messages where body = 'Running 10 minutes late, start at 8.10.' and booking_id in ($1, $2)`, [amaraB, jadeB]))[0].n, 2);
    // a roster row opens that person's own chat in the shoot thread
    await phone.click('.shootday .sd-row:has-text("Jade")');
    await phone.waitForSelector('.shootthread .pchip[aria-pressed=true]:has-text("Jade")');
    await phone.click('.shootthread .sdlink');
    await phone.waitForSelector('.sheet.shootday');
    // on the day: Amara wraps on her booking (which now has Directions too), so sign-off becomes the step that needs the brand
    await sql(`update bookings set shoot_date = current_date where id in ($1, $2)`, [amaraB, jadeB]);
    await sql(`update shoots set shoot_date = current_date where title = 'Autumn campaign'`);
    await amara.goto(`${BASE}/booking/${amaraB}`);
    assert.equal(await amara.getAttribute('.sheet a.dirbtn', 'href'), 'https://www.google.com/maps/dir/?api=1&destination=Mayfield%20Depot');
    await amara.click('.sheet button[data-a=wrap]');
    await amara.click('[data-a=cd-yes]');
    await amara.waitForSelector('.sheet .st:has-text("Wrapped")');
    await phone.click('.shootday .sd-thread');
    await phone.waitForSelector('.sheet.shootthread');
    await phone.click('.shootthread .sdlink');
    await phone.waitForSelector('.shootday .sd-band >> text=Today');
    assert.match(await phone.textContent('.shootday .sd-track li.now'), /Signed off and paid.*Needs you.*0 of 2 signed off.*Amara has wrapped.*Signs off automatically/s);
    assert.match(await phone.textContent('.shootday .sd-track'), /1 of 2 marked wrapped/);
    await phone.locator('.shootday .sd-track').scrollIntoViewIfNeeded();
    await shot(phone, '23-shoot-day-tracker-phone');
    // signing off goes through the booking, which shows the balance first; payments are the existing sign-off
    await phone.click('.shootday .sd-sign [data-a=booking]');
    await phone.click('.sheet button[data-a=signoff]');
    await phone.click('[data-a=cd-yes]');
    await phone.waitForSelector('.sheet .st:has-text("Paid")');
    assert.equal((await sql(`select status from bookings where id = $1`, [amaraB]))[0].status, 'completed');
    await phone.goto(`${BASE}/bookings`);
    await phone.click('h2:has-text("Shoots") + .list .item:has-text("Autumn campaign")');
    await phone.waitForSelector('.shootday .sd-track >> text=1 of 2 signed off');
    assert.match(await phone.textContent('.shootday .sd-roster'), /Amara Okafor.*Paid/s);
    ok('Shoot Day Hub: confirmed roster with call times, one-tap directions, a group message that shows once, and a tracker that follows wrap and sign-off');
    await phone.close();
    ok('Shoot Roster sends one offer per creative with the shared date, place and call time; the total matches the two offers');
  }

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
