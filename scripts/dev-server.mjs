// Local stand-in for Supabase + Stripe, for testing Embr end to end without
// network access. LOCAL TESTING ONLY. In production the app talks to a real
// Supabase project and Stripe.
//
//   node --import tsx scripts/dev-server.mjs      (serves dist/ on :8787)
//
// Implements: email-code sign-in (code is always 123456, or 12345678 like newer Supabase projects), database calls
// (/rest/v1/rpc/*) against local Postgres with the caller's identity set the
// way Supabase sets it, photo storage on disk, the Embr server functions, and
// fake Stripe hosted pages.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import { createFakeStripe } from './fake-stripe.mjs';
import * as H from '../supabase/functions/_shared/handlers.ts';
import * as P from '../supabase/functions/_shared/payments.ts';

const PORT = +(process.env.PORT || 8787);
const BASE = `http://localhost:${PORT}`;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIST = path.join(ROOT, 'dist');
// the same security headers Cloudflare Pages adds (public/_headers, "/*" block), so tests run under them
const SITE_HEADERS = (() => {
  const out = {}; let on = false;
  for (const line of fs.readFileSync(path.join(ROOT, 'public', '_headers'), 'utf8').split('\n')) {
    if (!/^\s/.test(line)) { on = line.trim() === '/*'; continue; }
    const m = on && line.match(/^\s+([\w-]+):\s*(.+)$/);
    if (m && m[1] !== 'Strict-Transport-Security') out[m[1]] = m[2].trim();
  }
  return out;
})();
const STORE = process.env.STORE || '/tmp/embr-storage';
const SECRET = 'local-test-secret';
fs.mkdirSync(STORE, { recursive: true });

const db = new pg.Pool({ connectionString: process.env.DB_URL || 'postgresql://postgres@localhost:54329/embr?host=/tmp' });
const stripe = createFakeStripe(BASE);
const env = { APP_URL: BASE, CRON_SECRET: 'cron', EMAIL_HOOK_SECRET: 'hook', STRIPE_WEBHOOK_SECRET: 'whsec_fake' };
const sentEmails = [];

// ---------------------------------------------------------------- tokens
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function sign(claims) {
  const h = b64({ alg: 'HS256', typ: 'JWT' }), p = b64(claims);
  const s = crypto.createHmac('sha256', SECRET).update(h + '.' + p).digest('base64url');
  return `${h}.${p}.${s}`;
}
function verify(tok) {
  const [h, p, s] = (tok || '').split('.');
  if (!s) return null;
  const good = crypto.createHmac('sha256', SECRET).update(h + '.' + p).digest('base64url');
  if (good !== s) return null;
  const c = JSON.parse(Buffer.from(p, 'base64url').toString());
  return c.exp * 1000 > Date.now() ? c : null;
}
const refresh = new Map();
async function session(email) {
  let r = await db.query('select id, email, created_at from auth.users where email = $1', [email]);
  if (!r.rows.length) r = await db.query('insert into auth.users (email) values ($1) returning id, email, created_at', [email]);
  const u = r.rows[0];
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const access = sign({ sub: u.id, email: u.email, role: 'authenticated', aud: 'authenticated', exp, iat: exp - 3600, session_id: crypto.randomUUID() });
  const rt = crypto.randomBytes(16).toString('hex');
  refresh.set(rt, email);
  const user = { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: u.created_at, created_at: u.created_at, updated_at: u.created_at, app_metadata: { provider: 'email' }, user_metadata: {}, identities: [] };
  return { access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: rt, user };
}

// ---------------------------------------------------------------- db calls
async function rpc(claims, fn, args = {}) {
  if (!/^[a-z_0-9]+$/.test(fn)) throw Object.assign(new Error('bad function'), { status: 404 });
  const c = await db.connect();
  try {
    await c.query('begin');
    const role = claims?.role === 'service_role' ? 'service_role' : claims?.sub ? 'authenticated' : 'anon';
    await c.query(`set local role ${role}`);
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims || { role: 'anon' })]);
    const keys = Object.keys(args);
    const meta = await c.query(`select p.proretset from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1 limit 1`, [fn]);
    const setof = meta.rows[0]?.proretset;
    const call = `public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')})`;
    const r = await c.query(setof ? `select * from ${call} r` : `select ${call} r`, keys.map((k) => {
      const v = args[k];
      return v !== null && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : v;
    }));
    await c.query('commit');
    if (setof) return r.rows.map((x) => x.r ?? Object.values(x)[0]);
    return r.rows[0]?.r ?? null;
  } catch (e) { await c.query('rollback').catch(() => {}); throw e; } finally { c.release(); }
}
const serviceRpc = (fn, args) => rpc({ role: 'service_role' }, fn, args);

// after each call, deliver any new notification emails (what the db trigger + send-email do in production)
async function deliverEmails() {
  const r = await db.query('select id from notifications where email and emailed_at is null order by id');
  for (const { id } of r.rows) {
    await H.sendEmail(new Request(BASE + '/send-email', { method: 'POST', headers: { 'x-embr-hook': 'hook' }, body: JSON.stringify({ notification_id: id }) }),
      deps, async (_e, m) => { sentEmails.push(m); });
  }
}

const deps = {
  env: { ...env, RESEND_API_KEY: 'local' },
  stripe,
  rpc: serviceRpc,
  userFromToken: async (jwt) => verify(jwt)?.sub || null,
  verifyWebhook: async (body) => JSON.parse(body),
};

// ---------------------------------------------------------------- http
const send = (res, status, body, headers = {}) => {
  const isStr = typeof body === 'string' || Buffer.isBuffer(body);
  res.writeHead(status, { 'Content-Type': isStr ? 'text/html; charset=utf-8' : 'application/json', 'Access-Control-Allow-Origin': '*', ...headers });
  res.end(isStr ? body : JSON.stringify(body));
};
const readBody = (req) => new Promise((ok) => { const ch = []; req.on('data', (c) => ch.push(c)); req.on('end', () => ok(Buffer.concat(ch))); });
const page = (title, inner) => `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><title>${title}</title>
<body style="font-family:system-ui;max-width:440px;margin:40px auto;padding:0 16px"><p style="color:#635bff;font-weight:700">Stripe (local test stand-in)</p>${inner}</body>`;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.ico': 'image/x-icon' };

async function route(req, res) {
  const url = new URL(req.url, BASE);
  const p = url.pathname;
  if (req.method === 'OPTIONS') return send(res, 204, '', { 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' });
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const claims = verify(bearer);

  // ---- auth
  if (p === '/auth/v1/otp') { const b = JSON.parse(await readBody(req)); console.log(`[auth] code for ${b.email}: 123456`); return send(res, 200, {}); }
  if (p === '/auth/v1/verify') {
    const b = JSON.parse(await readBody(req));
    if (b.token !== '123456' && b.token !== '12345678') return send(res, 403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
    return send(res, 200, await session(b.email));
  }
  if (p === '/auth/v1/token') {
    const b = JSON.parse(await readBody(req));
    const email = refresh.get(b.refresh_token);
    if (!email) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' });
    return send(res, 200, await session(email));
  }
  if (p === '/auth/v1/user') { if (!claims) return send(res, 401, { msg: 'invalid JWT' }); return send(res, 200, (await session(claims.email)).user); }
  if (p === '/auth/v1/logout') return send(res, 204, '');

  // ---- database
  if (p.startsWith('/rest/v1/rpc/')) {
    const fn = p.slice('/rest/v1/rpc/'.length);
    const args = req.method === 'POST' ? JSON.parse((await readBody(req)).toString() || '{}') : Object.fromEntries(url.searchParams);
    try {
      const data = await rpc(claims, fn, args);
      deliverEmails().catch((e) => console.error('email', e));
      return data === null ? send(res, 204, '') : send(res, 200, Buffer.from(JSON.stringify(data)), { 'Content-Type': 'application/json' });
    } catch (e) {
      const status = e.code === '42501' ? 403 : e.code === '28000' ? 401 : 400;
      return send(res, status, { code: e.code, message: e.message, details: null, hint: null });
    }
  }

  // ---- storage (public photos bucket)
  if (p.startsWith('/storage/v1/object/public/photos/')) {
    const f = path.join(STORE, decodeURIComponent(p.slice('/storage/v1/object/public/photos/'.length)));
    if (!f.startsWith(STORE) || !fs.existsSync(f)) return send(res, 404, { error: 'not found' });
    return send(res, 200, fs.readFileSync(f), { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=3600' });
  }
  if (p.startsWith('/storage/v1/object/photos/') && (req.method === 'POST' || req.method === 'PUT')) {
    const name = decodeURIComponent(p.slice('/storage/v1/object/photos/'.length));
    if (!claims || name.split('/')[0] !== claims.sub) return send(res, 403, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' });
    let body = await readBody(req);
    const ct = req.headers['content-type'] || '';
    const bm = ct.match(/boundary=(.+)$/);
    if (bm) {
      // supabase-js sends a Blob as multipart form data: pull out the file part
      const boundary = Buffer.from('--' + bm[1]);
      const parts = [];
      let i = body.indexOf(boundary);
      while (i !== -1) { const j = body.indexOf(boundary, i + boundary.length); if (j === -1) break; parts.push(body.subarray(i + boundary.length, j)); i = j; }
      const filePart = parts.find((p) => /filename=|Content-Type: image/i.test(p.subarray(0, 300).toString())) || parts[parts.length - 1];
      const h = filePart.indexOf('\r\n\r\n');
      body = filePart.subarray(h + 4, filePart.length - 2);
    }
    if (body.length > 5 * 1024 * 1024) return send(res, 413, { statusCode: '413', error: 'Payload too large', message: 'The object exceeded the maximum allowed size' });
    const f = path.join(STORE, name);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, body);
    return send(res, 200, { Key: 'photos/' + name, Id: crypto.randomUUID() });
  }
  if (p === '/storage/v1/object/photos' && req.method === 'DELETE') {
    const b = JSON.parse(await readBody(req));
    for (const n of b.prefixes || []) if (claims && n.split('/')[0] === claims.sub) fs.rmSync(path.join(STORE, n), { force: true });
    return send(res, 200, []);
  }

  // ---- Embr server functions
  if (p.startsWith('/functions/v1/')) {
    const name = p.slice('/functions/v1/'.length);
    const body = await readBody(req);
    const r = new Request(BASE + p, { method: req.method, headers: req.headers, body: req.method === 'GET' ? undefined : body });
    const fn = { api: H.api, 'stripe-webhook': H.stripeWebhook, cron: H.cron, 'send-email': H.sendEmail }[name];
    if (!fn) return send(res, 404, { error: 'no function' });
    const out = await fn(r, deps);
    deliverEmails().catch(() => {});
    res.writeHead(out.status, Object.fromEntries(out.headers));
    return res.end(Buffer.from(await out.arrayBuffer()));
  }

  // ---- fake Stripe hosted pages
  if (p === '/__fake_stripe/checkout') {
    const s = stripe._state.sessions[url.searchParams.get('session')];
    if (req.method === 'POST') {
      stripe._completeCheckout(s.id);
      await P.handleEvent(stripe, serviceRpc, { id: 'evt_' + s.id, type: 'checkout.session.completed', data: { object: s } });
      await deliverEmails();
      return send(res, 303, '', { Location: s.success_url });
    }
    return send(res, 200, page('Pay', `<h1>Pay £${(s.amount_total / 100).toFixed(2)}</h1><p>${s.line_items[0].price_data.product_data.name}</p><p style="color:#666">${s.line_items[0].price_data.product_data.description || ''}</p>
      <form method=post><input value="4242 4242 4242 4242" readonly style="width:100%;padding:10px"><button id=pay style="margin-top:12px;width:100%;padding:12px;background:#635bff;color:#fff;border:0;border-radius:6px;font-size:16px">Pay</button></form>
      <p><a href="${s.cancel_url}">Back</a></p>`));
  }
  if (p === '/__fake_stripe/onboard') {
    const aid = url.searchParams.get('account');
    if (req.method === 'POST') {
      stripe._finishOnboarding(aid);
      await P.handleEvent(stripe, serviceRpc, { id: 'evt_acct_' + aid, type: 'account.updated', data: { object: stripe._state.accounts[aid] } });
      await deliverEmails();
      return send(res, 303, '', { Location: url.searchParams.get('return') });
    }
    return send(res, 200, page('Payouts', `<h1>Set up payouts</h1><p>Embr uses Stripe to pay you. (Test: bank details are pre-filled.)</p><form method=post><input value="Sort code 10-88-00, account 00012345" readonly style="width:100%;padding:10px"><button id=submit style="margin-top:12px;width:100%;padding:12px;background:#635bff;color:#fff;border:0;border-radius:6px">Submit</button></form>`));
  }
  if (p === '/__fake_stripe/identity') {
    const sid = url.searchParams.get('session');
    if (req.method === 'POST') {
      const form = new URLSearchParams((await readBody(req)).toString());
      stripe._finishIdentity(sid, form.get('dob'));
      await P.handleEvent(stripe, serviceRpc, { id: 'evt_' + sid, type: 'identity.verification_session.verified', data: { object: stripe._state.identity[sid] } });
      await deliverEmails();
      return send(res, 303, '', { Location: stripe._state.identity[sid].return_url });
    }
    return send(res, 200, page('Verify', `<h1>Verify your identity</h1><p>Take a photo of your ID and a selfie. (Test: enter the date of birth on the ID.)</p><form method=post><input name=dob type=date value="1999-04-02" style="width:100%;padding:10px"><button id=verify style="margin-top:12px;width:100%;padding:12px;background:#635bff;color:#fff;border:0;border-radius:6px">Submit</button></form>`));
  }
  if (p === '/__fake_stripe/express') return send(res, 200, page('Express', '<h1>Your Stripe Express dashboard</h1><p>Payouts and balance appear here.</p>'));
  if (p === '/__test/ledger') return send(res, 200, { ledger: stripe._state.ledger, emails: sentEmails });
  if (p === '/__test/needs-auth') { stripe._state.needsAuth.add(url.searchParams.get('customer')); return send(res, 200, {}); }
  if (p === '/__test/cron') { const out = await H.cron(new Request(BASE, { method: 'POST', headers: { 'x-embr-cron': 'cron' } }), deps); await deliverEmails(); return send(res, 200, await out.json()); }
  if (p === '/__test/sql' && req.method === 'POST') { const b = JSON.parse(await readBody(req)); const r = await db.query(b.sql, b.args || []); return send(res, 200, r.rows); }

  // ---- the app (built files, single-page fallback)
  let f = path.join(DIST, decodeURIComponent(p));
  if (!f.startsWith(DIST)) return send(res, 403, 'no');
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, /^\/admin(\/|$)/.test(url.pathname) ? 'admin.html' : 'index.html');
  return send(res, 200, fs.readFileSync(f), { ...SITE_HEADERS, 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
}

http.createServer((req, res) => route(req, res).catch((e) => { console.error(e); send(res, 500, { error: e.message }); }))
  .listen(PORT, () => console.log(`Embr local test server on ${BASE}`));
