// Payment failure cases: what happens when a step fails halfway, a webhook is
// retried, or a brand could pay twice. Runs payments.ts against the local
// database and the in-memory Stripe stand-in.
//   node --import tsx tests/payments.test.mjs
import pg from 'pg';
import assert from 'node:assert/strict';
import { createFakeStripe } from '../scripts/fake-stripe.mjs';
import * as P from '../supabase/functions/_shared/payments.ts';

const db = new pg.Pool({ connectionString: process.env.DB_URL || 'postgresql://postgres@localhost:54329/embr?host=/tmp' });
let passed = 0;
const ok = (name) => { passed++; console.log('  ✓ ' + name); };

async function rpc(fn, args = {}) {
  const c = await db.connect();
  try {
    await c.query('begin');
    await c.query('set local role service_role');
    const keys = Object.keys(args);
    const meta = await c.query(`select p.proretset from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1 limit 1`, [fn]);
    const call = `public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')})`;
    const r = await c.query(meta.rows[0]?.proretset ? `select * from ${call} r` : `select ${call} r`,
      keys.map((k) => (args[k] !== null && typeof args[k] === 'object' && !Array.isArray(args[k]) ? JSON.stringify(args[k]) : args[k])));
    await c.query('commit');
    return meta.rows[0]?.proretset ? r.rows.map((x) => x.r ?? Object.values(x)[0]) : r.rows[0]?.r ?? null;
  } catch (e) { await c.query('rollback').catch(() => {}); throw e; } finally { c.release(); }
}
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const env = { APP_URL: 'http://localhost' };

async function main() {
  console.log('Embr payment failure tests');
  await q('truncate auth.users cascade');
  await q('truncate public.stripe_events cascade');
  const stripe = createFakeStripe('http://localhost');
  const [t] = await q("insert into auth.users (email) values ('pt@test.com') returning id");
  const [b] = await q("insert into auth.users (email) values ('pb@test.com') returning id");
  await q("insert into profiles (id, role, email) values ($1,'talent','pt@test.com'), ($2,'brand','pb@test.com')", [t.id, b.id]);
  const acct = await stripe.accounts.create({ type: 'express' });
  stripe._finishOnboarding(acct.id);
  await q("insert into talents (id, name, roles, stripe_account, payouts_enabled, age_verified) values ($1, 'Pat Test', '{Model}', $2, true, true)", [t.id, acct.id]);
  const cus = await stripe.customers?.create?.({ email: 'pb@test.com' }) || { id: 'cus_test' };
  await q("insert into brands (id, name, stripe_customer) values ($1, 'Test Brand', $2)", [b.id, cus.id]);

  // a confirmed, wrapped booking with a paid deposit
  async function wrappedBooking(ref) {
    const [bk] = await q(`insert into bookings (ref, brand_id, talent_id, title, shoot_date, day_rate, fee_rate, fee_label, session_p, talent_fee_p, embr_fee_p, total_p, deposit_p, balance_p, agreement_version, agreement_text, status)
      values ($1, $2, $3, 'Test shoot', current_date, 200, .1, 'x', 20000, 20000, 2000, 22000, 11000, 11000, 'v', 'text', 'accepted') returning id`, [ref, b.id, t.id]);
    const pi = await stripe.paymentIntents.create({ amount: 11000, currency: 'gbp', customer: cus.id, confirm: true, metadata: { booking_id: bk.id } });
    await rpc('svc_deposit_paid', { p_id: bk.id, p_intent: pi.id, p_charge: pi.latest_charge, p_pm: 'pm_saved' });
    await q("update bookings set status = 'wrapped' where id = $1", [bk.id]);
    return bk.id;
  }
  const charges = (id) => stripe._state.ledger.filter((x) => x.booking === id && x.type === 'charge').length;

  // 1. a webhook that fails is retried, not skipped
  let n = 0;
  const bad = { id: 'evt_fail_once', type: 'account.updated', data: { object: { id: acct.id, payouts_enabled: true, capabilities: { transfers: 'active' } } } };
  const flaky = async (fn, args) => { if (fn === 'svc_account_updated' && n++ === 0) throw new Error('database hiccup'); return rpc(fn, args); };
  await assert.rejects(P.handleEvent(stripe, flaky, bad), /hiccup/);
  assert.equal(await P.handleEvent(stripe, flaky, bad), 'account');
  assert.equal(await P.handleEvent(stripe, flaky, bad), 'duplicate');
  ok('a webhook that fails is handled when Stripe retries it, and only once');

  // 2. balance charged, then the transfer fails: the retry must not charge again
  const b1 = await wrappedBooking('EMB-PAY001');
  const realTransfer = stripe.transfers.create;
  let failBal = true;
  stripe.transfers.create = async (p, o) => { if (failBal && o?.idempotencyKey?.startsWith('tr-bal-')) throw new Error('Stripe is down'); return realTransfer(p, o); };
  await assert.rejects(P.signoff(stripe, rpc, env, b1, 'brand', b.id), /Stripe is down/);
  let [row] = await q('select status, balance_intent, transfer_dep, transfer_bal from bookings where id = $1', [b1]);
  assert.equal(row.status, 'wrapped'); assert.ok(row.balance_intent); assert.ok(row.transfer_dep); assert.equal(row.transfer_bal, null);
  failBal = false;
  stripe._state.idem = {}; // as if more than 24 hours passed and Stripe forgot the idempotency keys
  const r = await P.signoff(stripe, rpc, env, b1, 'brand', b.id);
  assert.equal(r.ok, true); assert.equal(r.paid_to_talent_p, 20000);
  assert.equal(charges(b1), 2, 'deposit + one balance charge');
  const tr = stripe._state.transfers.filter((x) => x.transfer_group === b1);
  assert.equal(tr.reduce((s, x) => s + x.amount, 0), 20000, 'talent paid exactly once');
  stripe.transfers.create = realTransfer;
  ok('if paying the talent fails after the balance is charged, the retry never charges or pays twice');

  // 3. card needs authentication: brand gets a Checkout page; Embr then signs off with the card, and the
  //    brand's late Checkout payment is refunded (or the page is closed first)
  const b2 = await wrappedBooking('EMB-PAY002');
  stripe._state.needsAuth.add(cus.id);
  const r2 = await P.signoff(stripe, rpc, env, b2, 'brand', b.id);
  assert.equal(r2.needs_action, true);
  const [{ balance_checkout: sess }] = await q('select balance_checkout from bookings where id = $1', [b2]);
  stripe._state.needsAuth.delete(cus.id);
  const r3 = await P.signoff(stripe, rpc, env, b2, 'ops');
  assert.equal(r3.ok, true);
  assert.equal(stripe._state.sessions[sess].status, 'expired'); ok('Embr signing off closes the brand\'s open payment page first');
  // even if the brand somehow paid that page, the second payment is refunded
  stripe._state.sessions[sess].status = 'open';
  const paid = stripe._completeCheckout(sess);
  assert.equal(await P.checkoutCompleted(stripe, rpc, paid), 'refunded');
  assert.equal(stripe._state.ledger.filter((x) => x.booking === b2 && x.type === 'refund').length, 1);
  ok('a second balance payment that arrives after sign-off is refunded automatically');

  // 4. only card problems lead to a Checkout page; other errors are errors
  const b3 = await wrappedBooking('EMB-PAY003');
  const realPI = stripe.paymentIntents.create;
  stripe.paymentIntents.create = async () => { throw Object.assign(new Error('Invalid API key'), { type: 'StripeAuthenticationError' }); };
  await assert.rejects(P.signoff(stripe, rpc, env, b3, 'brand', b.id), /Invalid API key/);
  const [{ balance_checkout_url: url3, money_lock: lock3 }] = await q('select balance_checkout_url, money_lock from bookings where id = $1', [b3]);
  assert.equal(url3, null); assert.equal(lock3, null);
  stripe.paymentIntents.create = realPI;
  ok('a Stripe or network error is reported as an error, not turned into a payment page');

  // 5. Embr staff hear about chargebacks and failed payouts
  await P.handleEvent(stripe, rpc, { id: 'evt_dp', type: 'charge.dispute.created', data: { object: { charge: (await q('select deposit_charge from bookings where id = $1', [b1]))[0].deposit_charge, amount: 11000, reason: 'fraudulent' } } });
  const [ev] = await q("select text from booking_events where booking_id = $1 and text like 'Chargeback%'", [b1]);
  assert.match(ev.text, /£110.*fraudulent/);
  await P.handleEvent(stripe, rpc, { id: 'evt_po', type: 'payout.failed', account: acct.id, data: { object: { amount: 20000, failure_message: 'Account closed' } } });
  await P.handleEvent(stripe, rpc, { id: 'evt_da', type: 'account.application.deauthorized', account: acct.id, data: { object: {} } });
  const [{ payouts_enabled }] = await q('select payouts_enabled from talents where id = $1', [t.id]);
  assert.equal(payouts_enabled, false);
  ok('chargebacks, failed payouts and disconnected Stripe accounts are flagged to Embr staff');

  // payout accounts: new Stripe platforms refuse Accounts v1 creation, so Embr uses Accounts v2
  const [pa] = await q("insert into auth.users (email) values ('payee@test.com') returning id");
  await q("insert into profiles (id, role, email) values ($1,'talent','payee@test.com')", [pa.id]);
  await q("insert into talents (id, name, roles) values ($1, 'Pay Ee', '{Model}')", [pa.id]);
  stripe._state.v1Blocked = true;
  const v2before = stripe._state.v2Created || 0;
  const ob = await P.connectOnboard(stripe, rpc, env, pa.id);
  assert.match(ob.url, /onboard/);
  assert.equal((stripe._state.v2Created || 0) - v2before, 1);
  const [{ stripe_account: v2acct }] = await q('select stripe_account from talents where id = $1', [pa.id]);
  assert.ok(v2acct);
  stripe._state.v1LinksBlocked = true;
  assert.match((await P.connectOnboard(stripe, rpc, env, pa.id)).url, /onboard/);
  stripe._state.v1LinksBlocked = false;
  assert.equal((stripe._state.v2Created || 0) - v2before, 1); ok('payout accounts are created with Stripe Accounts v2 when v1 is blocked, once per talent, with a v2 onboarding link if needed');
  stripe._state.v1Blocked = false; stripe._state.noV2 = true;
  const [pb] = await q("insert into auth.users (email) values ('payee2@test.com') returning id");
  await q("insert into profiles (id, role, email) values ($1,'talent','payee2@test.com')", [pb.id]);
  await q("insert into talents (id, name, roles) values ($1, 'Pay Bee', '{Model}')", [pb.id]);
  await P.connectOnboard(stripe, rpc, env, pb.id);
  const [{ stripe_account: v1acct }] = await q('select stripe_account from talents where id = $1', [pb.id]);
  assert.ok(v1acct);
  stripe._state.v1Blocked = true;
  const [pc] = await q("insert into auth.users (email) values ('payee3@test.com') returning id");
  await q("insert into profiles (id, role, email) values ($1,'talent','payee3@test.com')", [pc.id]);
  await q("insert into talents (id, name, roles) values ($1, 'Pay Cee', '{Model}')", [pc.id]);
  await assert.rejects(P.connectOnboard(stripe, rpc, env, pc.id), /Accounts v2.*not enabled/);
  stripe._state.v1Blocked = false; stripe._state.noV2 = false; ok('platforms without Accounts v2 fall back to v1 Express accounts; if both fail, the Accounts v2 reason is shown');
  stripe._state.v1Blocked = true; stripe._state.profileUnfinished = true;
  await assert.rejects(P.connectOnboard(stripe, rpc, env, pc.id), /losses_collector_unavailable.*Platform profile/);
  stripe._state.v1Blocked = false; stripe._state.profileUnfinished = false; ok('if the Stripe platform profile is unfinished, the error says how to fix it');

  // ID check: Stripe refuses the date of birth to a standard key
  const [it] = await q("insert into auth.users (email) values ('id@test.com') returning id");
  await q("insert into profiles (id, role, email) values ($1,'talent','id@test.com')", [it.id]);
  await q("insert into talents (id, name, roles) values ($1, 'Ida Test', '{Model}')", [it.id]);
  const vs1 = await P.identityStart(stripe, rpc, env, it.id);
  const sid1 = Object.keys(stripe._state.identity).pop();
  stripe._finishIdentity(sid1, '1995-06-01');
  stripe._state.refuseSensitive = true;
  await P.handleEvent(stripe, rpc, { id: 'evt_id1', type: 'identity.verification_session.verified', data: { object: { id: sid1 } } });
  let [idr] = await q('select identity_status, age_verified from talents where id = $1', [it.id]);
  assert.deepEqual(idr, { identity_status: 'review', age_verified: false });
  ok('a passed ID check whose date of birth Stripe won\'t share goes to staff review, not "under 18" or stuck');
  stripe.identityReader = { identity: { verificationSessions: { retrieve: async (sid) => stripe._state.identity[sid] } } };
  const vs2 = await P.identityStart(stripe, rpc, env, it.id);
  const sid2 = Object.keys(stripe._state.identity).pop();
  stripe._finishIdentity(sid2, '1995-06-01');
  await P.handleEvent(stripe, rpc, { id: 'evt_id2', type: 'identity.verification_session.verified', data: { object: { id: sid2 } } });
  [idr] = await q('select identity_status, age_verified from talents where id = $1', [it.id]);
  assert.deepEqual(idr, { identity_status: 'verified', age_verified: true });
  delete stripe.identityReader; stripe._state.refuseSensitive = false;
  assert.ok(vs1.url && vs2.url); ok('with the restricted Identity key, the date of birth is read and the talent verified 18+');

  console.log(`\n${passed} checks passed`);
}
main().then(() => db.end()).catch((e) => { console.error('\n✗ FAILED:', e.message); console.error(e.stack); db.end(); process.exit(1); });
