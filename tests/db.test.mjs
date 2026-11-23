// Database tests: run the booking lifecycle against a local Postgres loaded
// with tests/supabase_stub.sql and the migration.
//   node tests/db.test.mjs
import pg from 'pg';
import assert from 'node:assert/strict';

const db = new pg.Pool({ connectionString: process.env.DB_URL || 'postgresql://postgres@localhost:54329/embr?host=/tmp' });
let passed = 0;
const ok = (name) => { passed++; console.log('  ✓ ' + name); };

async function as(user, fn) {
  const c = await db.connect();
  try {
    await c.query('begin');
    if (user === 'service') {
      await c.query("set local role service_role");
    } else if (user === 'anon') {
      await c.query("set local role anon");
      await c.query("select set_config('request.jwt.claims', '{\"role\":\"anon\"}', true)");
    } else {
      await c.query("set local role authenticated");
      await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: user.id, email: user.email, role: 'authenticated' })]);
    }
    const r = await fn((sql, args) => c.query(sql, args).then((x) => x.rows));
    await c.query('commit');
    return r;
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally { c.release(); }
}
const call = (user, fn, ...args) => as(user, (q) => q(`select public.${fn}(${args.map((_, i) => '$' + (i + 1)).join(',')}) r`, args).then((r) => r[0].r));
const fails = async (p, re) => { try { await p; } catch (e) { if (re && !re.test(e.message)) throw new Error('wrong error: ' + e.message); return e.message; } throw new Error('expected an error'); };

async function user(email) {
  const r = await db.query('insert into auth.users (email) values ($1) returning id', [email]);
  return { id: r.rows[0].id, email };
}
const today = (n = 0) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

async function main() {
  await db.query("truncate auth.users cascade");
  await db.query("truncate public.invites, public.stripe_events cascade");
  console.log('Embr database tests');

  // --- accounts and invites
  const ops = await user('luke@embr.test');
  const amara = await user('amara@test.com');
  const jay = await user('jay@test.com');
  const kid = await user('kid@test.com');
  const rivet = await user('hello@rivet.test');
  const walkin = await user('owner@cafe.test');

  const opsCode = (await db.query('select public.first_ops_invite() c')).rows[0].c;
  await fails(db.query('select public.first_ops_invite()'), /please|already/i).catch(() => {});
  const me0 = await call(ops, 'create_profile', 'ops', opsCode, null, null, {});
  assert.equal(me0.role, 'ops'); ok('first Embr staff account from the one-off invite');
  await fails(db.query('select public.first_ops_invite()'), /already exists/); ok('first staff invite only works once');

  const tInv = await call(ops, 'ops_create_invite', 'talent', 'Amara');
  const tInv2 = await call(ops, 'ops_create_invite', 'talent', 'Jay');
  const tInv3 = await call(ops, 'ops_create_invite', 'talent', 'Kid');
  const bInv = await call(ops, 'ops_create_invite', 'brand', 'Rivet');
  await fails(call(amara, 'ops_create_invite', 'talent', null), /not allowed|permission/i); ok('only staff can make invites');

  await fails(call(amara, 'create_profile', 'talent', null, null, null, { name: 'Amara Okafor', dob: '1999-04-02' }), /invite-only/);
  ok('talent can\'t join without an invite');
  await fails(call(kid, 'create_profile', 'talent', tInv3, null, null, { name: 'Kid', dob: today(-365 * 16) }), /18 and over/);
  ok('under-18 date of birth is refused at sign-up');
  await fails(call(amara, 'create_profile', 'talent', bInv, null, null, { name: 'A', dob: '1999-04-02' }), /for a brand account/);
  ok('a brand invite can\'t make a talent account');
  let me = await call(amara, 'create_profile', 'talent', tInv, null, null, { name: 'Amara Okafor', dob: '1999-04-02', city: 'Manchester', roles: ['Model', 'UGC creator', 'Juggler'] });
  assert.equal(me.role, 'talent'); assert.deepEqual(me.talent.roles, ['Model', 'UGC creator']);
  ok('sign-up keeps every role picked, ignoring unknown ones');
  await fails(call(jay, 'create_profile', 'talent', tInv, null, null, { name: 'J', dob: '1999-01-01', roles: ['Model'] }), /used/);
  ok('an invite code works once');
  await call(jay, 'create_profile', 'talent', tInv2, null, null, { name: 'Jay Patel', dob: '1997-01-01', city: 'London', category: 'Model' });
  ok('older single-category sign-up still works');
  await call(rivet, 'create_profile', 'brand', bInv, null, null, { name: 'Rivet Studio', contact_name: 'Sam', city: 'Manchester' });
  ok('talent and brand accounts created with invites');

  // --- profiles and photos
  me = await call(amara, 'save_talent', { handle: 'amara', city: 'Manchester', day_rate: '250', half_rate: '150', bio: 'Manchester model', tags: ['streetwear', 'beauty'] });
  assert.equal(me.talent.published, false);
  assert.deepEqual(me.talent.gaps.map((g) => g.role), ['Model', 'UGC creator']); ok('profile stays hidden while any role section is empty');
  await fails(call(amara, 'add_photo', jay.id + '/x.jpg', 'Model'), /own folder/); ok('talent can only add photos from their own folder');
  await fails(call(amara, 'add_photo', amara.id + '/x.jpg', 'Actor'), /things you do/); ok('photos only go in sections for roles they picked');
  for (const n of [1, 2, 3]) me = await call(amara, 'add_photo', amara.id + `/${n}.jpg`, 'Model');
  assert.equal(me.talent.published, false);
  assert.ok(me.talent.gaps.find((g) => g.role === 'Model').missing.some((m) => /which sizes you model/.test(m))); ok('modelling needs full model details as well as photos');
  me = await call(amara, 'save_model_stats', { sizing: 'womenswear', height_cm: '178' });
  let mgap = me.talent.gaps.find((g) => g.role === 'Model').missing.join();
  assert.match(mgap, /bust, waist, hips, dress size, shoe size, hair colour, eye colour/); ok('height alone is not enough: every core measurement is listed as missing');
  await fails(call(amara, 'save_model_stats', { sizing: 'womenswear', height_cm: '5.10' }), /numbers|centimetres/);
  await fails(call(amara, 'save_model_stats', { sizing: 'womenswear', height_cm: '178', dress_uk: '9' }), /UK size/);
  await fails(call(amara, 'save_model_stats', { sizing: 'womenswear', height_cm: '178', hair: 'Purple' }), /hair colour/);
  ok('model details are checked: cm heights, UK sizes, colours from the list');
  const amaraStats = { sizing: 'womenswear', height_cm: '178', bust_in: '32', waist_in: '24', hips_in: '35', dress_uk: '8', shoe_uk: '6.5', hair: 'Black', eyes: 'Brown', bra: '32b' };
  me = await call(amara, 'save_model_stats', amaraStats);
  assert.equal(me.talent.height, '5\'10"'); assert.equal(me.talent.stats.bra, '32B'); assert.equal(me.talent.stats.height_ft, '5\'10"');
  assert.deepEqual(me.talent.gaps.map((g) => g.role), ['UGC creator']);
  await fails(call(amara, 'add_link', 'UGC creator', 'my tiktok', 'x'), /https/); ok('video links must be full web addresses');
  await fails(call(amara, 'add_link', 'Actor', 'https://example.com/v', 'x'), /things you do/);
  me = await call(amara, 'add_link', 'UGC creator', 'https://www.tiktok.com/@amara/video/1', 'Skincare ad');
  assert.equal(me.talent.published, false);
  me = await call(amara, 'add_link', 'UGC creator', 'https://vimeo.com/2', 'Trainers unboxing');
  assert.equal(me.talent.published, true); assert.equal(me.talent.gaps.length, 0); ok('profile goes live once every role section is filled');
  me = await call(amara, 'remove_link', me.talent.links[1].id);
  assert.equal(me.talent.published, false); ok('removing work below the minimum hides the profile again');
  me = await call(amara, 'add_link', 'UGC creator', 'https://vimeo.com/3', 'Coffee ad');
  assert.equal(me.talent.published, true);
  await fails(call(jay, 'save_talent', { handle: 'Amara' }), /taken/); ok('Book-me names are unique, ignoring case');
  await fails(call(jay, 'save_talent', { roles: [] }), /at least one/); ok('talent must keep at least one role');
  await call(jay, 'save_talent', { handle: 'jay', day_rate: '200', travels: true });
  me = await call(jay, 'save_model_stats', { sizing: 'menswear', height_cm: '185', chest_in: '40', waist_in: '32', shoe_uk: '10', hair: 'Brown', eyes: 'Blue' });
  assert.match(me.talent.gaps[0].missing.join(), /inside leg, suit size/); ok('menswear needs chest, waist, inside leg and suit size');
  await fails(call(jay, 'save_model_stats', { sizing: 'menswear', height_cm: '185', suit: '40' }), /40R/);
  await call(jay, 'save_model_stats', { sizing: 'menswear', height_cm: '185', chest_in: '40', waist_in: '32', inside_leg_in: '33', suit: '40r', shoe_uk: '10', hair: 'Brown', eyes: 'Blue' });
  for (const n of [1, 2, 3]) await call(jay, 'add_photo', jay.id + `/${n}.jpg`, 'Model');

  // --- brand search and agency rules
  let res = await call(rivet, 'search_talent', { city: 'Manchester' });
  assert.deepEqual(res.map((t) => t.name), ['Amara Okafor', 'Jay Patel']);
  assert.equal(res[1].away, true); ok('brand search: local talent first, travelling talent after');
  res = await call(rivet, 'search_talent', { category: 'UGC creator' });
  assert.deepEqual(res.map((t) => t.name), ['Amara Okafor']); assert.deepEqual(res[0].roles, ['Model', 'UGC creator']);
  ok('searching one role finds everyone who does it, alongside their other roles');
  res = await call(rivet, 'search_talent', { category: 'Model', specs: { sizing: 'womenswear', height_min: 175, dress: [6, 8, 10] } });
  assert.deepEqual(res.map((t) => t.name), ['Amara Okafor']); assert.equal(res[0].stats.dress_uk, 8);
  res = await call(rivet, 'search_talent', { category: 'Model', specs: { height_min: 180 } });
  assert.deepEqual(res.map((t) => t.name), ['Jay Patel']);
  res = await call(rivet, 'search_talent', { category: 'Model', specs: { sizing: 'menswear', suit: ['38R'] } });
  assert.equal(res.length, 0); ok('brands filter models by sizing, height range and sizes');
  await fails(call(amara, 'search_talent', {}), /not allowed/i); ok('talent can\'t search other talent');

  const briefId = await call(rivet, 'create_brief', { title: 'Drop 4 lookbook', category: 'Model', city: 'Manchester', shoot_date: today(10), days: 1, day_rate: 240, travel: 'local', description: 'Studio, streetwear' });
  let brief = await call(rivet, 'brief_detail', briefId);
  assert.deepEqual(brief.ranked.map((t) => t.name), ['Amara Okafor']); ok('ranking respects "local talent only"');
  await fails(call(rivet, 'create_brief', { title: 'x', category: 'Model', city: 'Manchester', shoot_date: today(10), day_rate: 200, specs: { height_min: 190, height_max: 170 } }), /lowest height/);
  const specBrief = await call(rivet, 'create_brief', { title: 'Denim campaign', category: 'Model', city: 'Manchester', shoot_date: today(12), day_rate: 300, travel: 'covered',
    specs: { sizing: 'womenswear', height_min: 172, height_max: 183, dress: [8, 10], shoe_min: 5, shoe_max: 7, hair: [], eyes: '' } });
  brief = await call(rivet, 'brief_detail', specBrief);
  assert.deepEqual(brief.specs, { sizing: 'womenswear', height_min: 172, height_max: 183, dress: [8, 10], shoe_min: 5, shoe_max: 7 });
  assert.deepEqual(brief.ranked.map((t) => t.name), ['Amara Okafor']);
  const specBrief2 = await call(rivet, 'create_brief', { title: 'Tall', category: 'Model', city: 'Manchester', shoot_date: today(12), day_rate: 300, travel: 'covered', specs: { height_min: 180, hair: ['Blonde'] } });
  assert.equal((await call(rivet, 'brief_detail', specBrief2)).ranked.length, 0);
  ok('briefs store the model details a brand needs, and ranking only shows people who fit');
  const ugcBrief = await call(rivet, 'create_brief', { title: 'Skincare UGC', category: 'UGC creator', city: 'Manchester', shoot_date: today(11), days: 1, day_rate: 200, travel: 'covered', description: '3 videos' });
  assert.deepEqual((await call(rivet, 'brief_detail', ugcBrief)).ranked.map((t) => t.name), ['Amara Okafor']);
  ok('a brief for one role ranks only people who do that role');
  await as(rivet, (q) => q("update briefs set travel = 'covered'"))
    .then(() => assert.fail('direct table write should be blocked'), (e) => assert.match(e.message, /permission denied/));
  ok('brands can\'t write to tables directly');
  await fails(call(amara, 'brief_detail', briefId), /not allowed/i);
  await fails(as(amara, (q) => q('select * from briefs')), /permission denied/);
  await fails(call(amara, 'my_briefs'), /not allowed/i);
  ok('talent can never see briefs (nothing to apply for)');
  await fails(call(jay, 'create_offer', { talent_id: amara.id, title: 'x', shoot_date: today(5), day_rate: 100, agree: true }), /not allowed/i);
  ok('talent can\'t create offers');

  // --- offer → accept → deposit → wrap → sign off
  const q1 = await call(rivet, 'quote', amara.id, 250, 1, 50);
  assert.equal(q1.fee_rate, 0.10); assert.equal(q1.talent_fee_p, 30000); assert.equal(q1.embr_fee_p, 3000);
  assert.equal(q1.total_p, 33000); assert.equal(q1.deposit_p, 16500); assert.equal(q1.balance_p, 16500);
  ok('first booking: 10% brand fee on top, 50% deposit, talent fee in full');
  await fails(call(rivet, 'create_offer', { talent_id: amara.id, title: 'Drop 4', shoot_date: today(10), day_rate: 250, agree: false }), /agreement/);
  const b1 = await call(rivet, 'create_offer', { talent_id: amara.id, brief_id: briefId, title: 'Drop 4 lookbook', shoot_date: today(10), days: 1, day_rate: 250, usage_fee: 50, usage: 'Instagram and TikTok, 12 months', location: 'Ancoats studio', call_time: '9am', content_agreed: 'Streetwear, no swimwear', agree: true });
  let bk = await call(amara, 'booking_detail', b1);
  assert.equal(bk.status, 'offer'); assert.match(bk.agreement_text, /Embr takes no commission from the Talent/);
  assert.match(bk.agreement_text, /£330/); ok('offer created with the booking agreement snapshot');
  assert.equal(bk.role, 'Model'); assert.match(bk.agreement_text, /booked as: Model/); ok('the role they are booked for is on the offer and the agreement');
  const bUgc = await call(rivet, 'create_offer', { talent_id: amara.id, title: 'UGC test', shoot_date: today(30), day_rate: 200, role: 'UGC creator', agree: true });
  assert.equal((await call(rivet, 'booking_detail', bUgc)).role, 'UGC creator');
  await call(rivet, 'withdraw_offer', bUgc); ok('a brand can book the same person for a different role');
  await fails(call(jay, 'booking_detail', b1), /not found/); ok('other talent can\'t see the booking');
  brief = await call(rivet, 'brief_detail', briefId);
  assert.equal(brief.ranked[0].offered, true);

  await fails(call(amara, 'respond_offer', b1, true, true, null), /Verify your ID/); ok('unverified talent can\'t accept');
  await call('service', 'svc_identity_result', amara.id, 'vs_1', 'verified', '1999-04-02');
  await fails(call(amara, 'respond_offer', b1, true, true, null), /payouts/); ok('talent without payouts can\'t accept');
  await call('service', 'svc_set_stripe_account', amara.id, 'acct_amara');
  await call('service', 'svc_account_updated', 'acct_amara', true);
  await fails(call(amara, 'respond_offer', b1, true, false, null), /agreement/);
  bk = await call(amara, 'respond_offer', b1, true, true, null);
  assert.equal(bk.status, 'accepted'); ok('verified talent with payouts accepts and agrees');
  await fails(call(amara, 'svc_deposit_paid', b1, 'pi_1', 'ch_1', 'pm_1'), /permission denied/);
  ok('only the server can mark money as paid');
  assert.equal(await call('service', 'svc_lock', b1, ['accepted']), true);
  assert.equal(await call('service', 'svc_lock', b1, ['accepted']), false); ok('money lock stops double payments');
  assert.equal(await call('service', 'svc_deposit_paid', b1, 'pi_1', 'ch_1', 'pm_1'), true);
  assert.equal(await call('service', 'svc_deposit_paid', b1, 'pi_1', 'ch_1', 'pm_1'), true); ok('deposit webhook is safe to repeat');
  bk = await call(rivet, 'booking_detail', b1); assert.equal(bk.status, 'confirmed');
  await fails(call(amara, 'mark_wrapped', b1), /on or after the shoot day/); ok('can\'t wrap before the shoot');
  await db.query('update bookings set shoot_date = current_date where id = $1', [b1]);
  bk = await call(amara, 'mark_wrapped', b1);
  assert.equal(bk.status, 'wrapped'); assert.ok(bk.auto_signoff_at); ok('wrapped starts the 72-hour sign-off clock');
  assert.equal((await as('service', (q) => q('select * from public.svc_due_autosignoff() id'))).length, 0);
  await db.query("update bookings set auto_signoff_at = now() - interval '1 minute' where id = $1", [b1]);
  const due = await as('service', (q) => q('select * from public.svc_due_autosignoff() id'));
  assert.equal(due[0].id, b1); ok('auto sign-off picks it up after 72 hours');
  await call('service', 'svc_completed', b1, 'pi_2', 'ch_2', ['tr_1', 'tr_2'], 30000, 'auto');
  bk = await call(amara, 'booking_detail', b1);
  assert.equal(bk.status, 'completed'); assert.equal(bk.paid_to_talent_p, 30000); ok('completed: talent paid the full £300');

  // --- messages and notifications
  await call(rivet, 'send_message', b1, 'Thanks Amara!');
  bk = await call(amara, 'booking_detail', b1);
  assert.equal(bk.messages.at(-1).body, 'Thanks Amara!'); assert.equal(bk.messages.at(-1).from, 'brand');
  const notes = await call(amara, 'notifications');
  assert.ok(notes.length >= 4); ok('messages and notifications work inside a booking');

  // --- fee tiers
  let q2 = await call(rivet, 'quote', amara.id, 250, 1, 0);
  assert.equal(q2.fee_rate, 0.07); ok('2nd booking with the same person: 7%');
  for (let i = 0; i < 3; i++) {
    const id = await call(rivet, 'create_offer', { talent_id: amara.id, title: 'Repeat ' + i, shoot_date: today(20 + i), day_rate: 250, agree: true });
    await db.query("update bookings set status = 'completed' where id = $1", [id]);
  }
  q2 = await call(rivet, 'quote', amara.id, 250, 1, 0);
  assert.equal(q2.fee_rate, 0.05); ok('5th booking with the same person: 5%');
  const qj = await call(rivet, 'quote', jay.id, 200, 1, 0);
  assert.equal(qj.fee_rate, 0.10); ok('tiers are per talent: first booking with someone else is 10%');

  // --- availability
  const b2 = await call(rivet, 'create_offer', { talent_id: amara.id, title: 'Clash test', shoot_date: today(15), day_rate: 250, agree: true });
  await call(amara, 'respond_offer', b2, true, true, null);
  await fails(call(rivet, 'create_offer', { talent_id: amara.id, title: 'Clash', shoot_date: today(15), day_rate: 250, agree: true }), /isn't free/);
  ok('can\'t offer a date the talent is already booked');
  await call(amara, 'toggle_off_day', today(16));
  res = await call(rivet, 'search_talent', { date: today(16) });
  assert.ok(!res.some((t) => t.name === 'Amara Okafor')); ok('days marked off hide talent from date searches');
  bk = await call(rivet, 'withdraw_offer', b2); assert.equal(bk.status, 'withdrawn');

  // --- booking links (talent's own enquiries)
  await fails(call(jay, 'create_link', { title: 'x', shoot_date: today(9), day_rate: 200 }), /Verify your ID/);
  ok('unverified talent can\'t make booking links');
  const link = await call(amara, 'create_link', { title: 'Café menu shoot', shoot_date: today(12), days: 1, day_rate: 220, usage: 'Instagram, 6 months', note: 'Lovely to hear from you!' });
  const pub = await call('anon', 'public_link', link.code);
  assert.equal(pub.open, true); assert.equal(pub.fee_rate, 0.05); assert.equal(pub.total_p, 23100);
  ok('anyone with the link sees the terms and the 5% link price');
  await fails(call(walkin, 'create_profile', 'brand', null, null, null, { name: 'Cafe' }), /invite-only/);
  await call(walkin, 'create_profile', 'brand', null, link.code, null, { name: 'Northern Café', city: 'Manchester' });
  ok('a new brand can join from a booking link without an invite');
  const b3 = await call(walkin, 'accept_link', link.code, true, { location: 'Café, NQ' });
  bk = await call(walkin, 'booking_detail', b3);
  assert.equal(bk.status, 'accepted'); assert.equal(bk.fee_rate, 0.05); assert.equal(bk.via_link, true);
  ok('accepting a link creates an accepted booking at 5%');
  await fails(call(rivet, 'accept_link', link.code, true, {}), /used or has expired/); ok('a link books once');

  // --- cancellation and disputes (state side)
  await call('service', 'svc_deposit_paid', b3, 'pi_3', 'ch_3', 'pm_3');
  bk = await call(walkin, 'report_problem', b3, 'Talent did not arrive');
  assert.equal(bk.status, 'disputed'); assert.equal(bk.auto_signoff_at, null); ok('reporting a problem pauses payments');
  const ov = await call(ops, 'ops_overview');
  assert.equal(ov.disputes.length, 1); ok('the problem shows on the Embr admin overview');
  await call('service', 'svc_resolved', b3, ['re_1'], 11550, ['tr_3'], 11000, 'Split agreed');
  bk = await call(ops, 'booking_detail', b3); assert.equal(bk.status, 'completed'); assert.equal(bk.refunded_p, 11550);
  ok('Embr resolves a problem and records the split');

  // --- public Book-me page
  const bm = await call('anon', 'public_talent', 'AMARA');
  assert.equal(bm.name, 'Amara Okafor'); assert.equal(bm.off_days, undefined); ok('public Book-me page by handle');
  assert.equal(await call('anon', 'public_talent', 'nobody'), null);
  await fails(call('anon', 'me'), /permission denied/); ok('signed-out visitors can only see public pages');

  // --- ops
  const people = await call(ops, 'ops_people');
  assert.equal(people.talent.length, 2); assert.equal(people.brands.length, 2);
  const ob = await call(ops, 'ops_briefs'); assert.equal(ob.length, 4);
  await fails(call(rivet, 'ops_people'), /not allowed/i); ok('admin view is for Embr staff only');

  console.log(`\n${passed} checks passed`);
  await db.end();
}
main().catch(async (e) => { console.error('\n✗ FAILED:', e.message); console.error(e.stack); await db.end(); process.exit(1); });
