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
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|Failed to load resource|Pick at least one thing you do|invite code isn't valid/.test(m.text())) errors.push(`${name} console: ${m.text()}`); });
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
  await amara.fill('#f-profile [name=day_rate]', '250');
  await amara.fill('#f-profile [name=bio]', 'Manchester model and UGC creator. Streetwear, beauty and editorial. <img src=x onerror="window.__xss=1">');
  await amara.fill('#f-profile [name=tags]', 'streetwear, beauty');
  await amara.waitForSelector('#f-profile >> text=/"Around my region" from Manchester means Liverpool and Leeds/');
  await amara.selectOption('#f-profile [name=travel_range]', 'region');
  await amara.selectOption('#f-profile [name=travel_costs]', 'nearby_included');
  await amara.click('#f-profile button[type=submit]');
  await toastHas(amara, /Fill in your work sections/);
  await amara.waitForSelector('[data-role-sec="Model"] .need >> text=/which sizes you model/');
  ok('a section per role, and the profile stays hidden until each is filled');
  [tRow] = await sql("select travel_range, travel_costs, travels from talents where handle = 'amara'");
  assert.deepEqual(tRow, { travel_range: 'region', travel_costs: 'nearby_included', travels: true });
  ok('travel is saved as how far plus how costs work');
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
  await amara.click('.botnav >> text=Today');
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
  await rivet.locator('#f-job [data-specs]').scrollIntoViewIfNeeded();
  await shot(rivet, '05a-brief-model-details');
  await rivet.click('button[form=f-job]');
  await rivet.waitForSelector('.sheet >> text=Womenswear · 172–183cm · dress UK 8, 10');
  await rivet.waitForSelector('h3:has-text("Best fit for this brief")');
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
    assert.equal(await phone.inputValue('.rrow select'), 'Model');
    assert.equal(await phone.locator('.rrow').count(), 1);
    const need = await phone.locator('.rneed b').allTextContents();
    assert.deepEqual(need, ['Need a photographer?', 'Need a make-up artist?', 'Need a hair stylist?']);
    await phone.waitForSelector('#rquote >> text=Total for 1 person');
    assert.match(await phone.textContent('.sheet .ft'), /£275.*Send offer/s);
    for (const sel of ['.rneed', '.rr-x', '.rr-rate .in', '.sheet .ft .btn.primary']) assert.ok((await phone.locator(sel).first().boundingBox()).height >= 48, sel + ' is at least 48px tall');
    await phone.fill('#f-roster [name=location]', 'Ancoats studio');
    await shot(phone, '04h-shoot-roster-phone');
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
  await rivet.click('.sheet button[data-a=offer]');
  await rivet.waitForSelector('#f-offer');
  await rivet.waitForSelector('#quote >> text=Embr fee, 10%');
  assert.equal(await rivet.inputValue('#f-offer [name=role]'), 'Model');
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
  await rivet.waitForSelector('.sheet >> text=Booked as Model');
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
  await amara.goto(`${BASE}/`);
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
    await phone.check('#f-roster [name=agree]');
    await phone.click('.sheet .ft .btn.primary');
    await toastHas(phone, /2 offers sent for Autumn campaign/);
    await phone.waitForSelector('h1:has-text("Bookings")');
    assert.equal(await phone.locator('#rosterbar').count(), 0);
    const rows = await sql(`select t.name, b.title, b.shoot_date::text d, b.location, b.call_time, b.status, b.role, b.total_p from bookings b join talents t on t.id = b.talent_id where b.title = 'Autumn campaign' order by t.name`);
    assert.equal((await sql(`select count(*)::int n from bookings`))[0].n, before + 2);
    assert.deepEqual(rows.map((r) => [r.name, r.d, r.location, r.call_time, r.status, r.role]),
      [['Amara Okafor', iso(30), 'Mayfield Depot', '8am', 'offer', 'Model'], ['Jade Park', iso(30), 'Mayfield Depot', '8am', 'offer', 'Make-up artist']]);
    const sumP = rows.reduce((n, r) => n + r.total_p, 0);
    assert.equal('£' + (sumP / 100).toLocaleString('en-GB', sumP % 100 ? { minimumFractionDigits: 2 } : {}), total);
    await phone.close();
    ok('Shoot Roster sends one offer per creative with the shared date, place and call time; the total matches the two offers');
  }

  // ---------------------------------------------------------------- one sign-in, brand and creative modes (phone)
  {
    await sql("insert into public.invites (code, role, note) values ('T-DUAL01', 'talent', 'Sam as a creative')");
    const phone = await person('Sam (two modes)', true);
    await phone.goto(`${BASE}/signin`);
    await signIn(phone, 'sam@rivet.test', '12345678');
    await phone.waitForSelector('.botnav');
    const tabs = async () => (await phone.locator('.botnav button').allTextContents()).map((t) => t.trim());
    assert.deepEqual(await tabs(), ['Board', 'Bookings', 'Messages', 'Shortlist', 'Account']);
    await phone.click('.botnav >> text=Account');
    await phone.waitForSelector('.mode-card');
    assert.equal(await phone.locator('#modepill').count(), 0);
    await phone.click('.menu-rows >> text=Jobs');
    await phone.waitForSelector('h1:has-text("Jobs")');
    assert.equal(await phone.getAttribute('.botnav [data-tab=account]', 'aria-current'), 'page');
    ok('phone tab bar has 5 labelled tabs per mode, Account last; Jobs opens from Account');
    await phone.click('.botnav >> text=Account');
    await phone.click('.mode-card [data-a=add-mode]');
    await phone.fill('#f-addmode [name=invite]', 'T-NOPE00');
    await phone.fill('#f-addmode [name=name]', 'Sam Rivet');
    await phone.click('#f-addmode [data-a=pick-role][data-role=Photographer]');
    await phone.fill('#f-addmode [name=dob]', '1994-03-02');
    await phone.check('#f-addmode [name=agency]');
    await phone.click('#f-addmode button[type=submit]');
    await toastHas(phone, /isn't valid/);
    assert.equal(await phone.locator('#f-addmode').count(), 1);
    await phone.fill('#f-addmode [name=invite]', 'T-DUAL01');
    await phone.click('#f-addmode button[type=submit]');
    await phone.waitForSelector('.botnav >> text=Wallet');
    assert.deepEqual(await tabs(), ['Today', 'Bookings', 'Wallet', 'Messages', 'Profile']);
    await phone.waitForSelector('#modepill >> text=Switch to brand');
    assert.equal(await phone.locator('nav >> text=Jobs').count(), 0);
    ok('a brand adds a creative profile with its own invite (a wrong code keeps the form open) and the tabs swap to creative');
    await phone.click('.botnav >> text=Bookings');
    await phone.waitForSelector('h1');
    assert.ok(!(await phone.textContent('main')).includes('Autumn campaign'));
    assert.equal(await phone.locator('#modepill').count(), 0);
    ok('creative mode shows none of the brand\'s bookings, and the switch only sits on Profile');
    await phone.click('.botnav >> text=Profile');
    await phone.click('#modepill');
    await phone.waitForSelector('.botnav >> text=Shortlist');
    assert.deepEqual(await tabs(), ['Board', 'Bookings', 'Messages', 'Shortlist', 'Account']);
    assert.equal((await sql(`select p.role from profiles p join auth.users u on u.id = p.id where u.email = 'sam@rivet.test'`))[0].role, 'brand');
    await phone.click('.botnav >> text=Account');
    await phone.waitForSelector('#modepill >> text=Switch to creative');
    await shot(phone, '17-mode-switch-phone');
    await phone.close();
    ok('Switch to brand brings the brand tabs back, and the mode is saved on the account');
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
