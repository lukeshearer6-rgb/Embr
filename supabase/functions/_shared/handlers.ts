// HTTP layer for Embr's server functions. Each Supabase function's index.ts
// calls one of these. The local test server calls them too.
import * as pay from './payments.ts';
import type { Env, Rpc } from './payments.ts';

export type Deps = {
  env: Env;
  stripe: any;
  rpc: Rpc;                                          // service-role database calls
  userFromToken: (jwt: string) => Promise<string | null>;
  verifyWebhook: (body: string, sig: string, secret: string) => Promise<any>;
};

const cors = (env: Env) => ({
  'Access-Control-Allow-Origin': env.APP_URL || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
});
const json = (env: Env, data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors(env) } });
const fail = (env: Env, e: any) => {
  const status = e instanceof pay.HttpError ? e.status : 500;
  if (status === 500) console.error(e);
  const msg = status === 500 ? (e?.raw?.message || e?.message || 'Something went wrong') : e.message;
  return json(env, { error: msg }, status);
};

function safeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// POST /functions/v1/api  { action, ...args }   (signed-in users)
export async function api(req: Request, d: Deps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(d.env) });
  try {
    const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const user = jwt ? await d.userFromToken(jwt) : null;
    if (!user) return json(d.env, { error: 'Please sign in again' }, 401);
    const body = await req.json().catch(() => ({}));
    const { stripe, rpc, env } = d;
    switch (body.action) {
      case 'connect_onboard': return json(env, await pay.connectOnboard(stripe, rpc, env, user));
      case 'connect_refresh': return json(env, await pay.connectRefresh(stripe, rpc, user));
      case 'connect_dashboard': return json(env, await pay.connectDashboard(stripe, rpc, user));
      case 'identity_start': return json(env, await pay.identityStart(stripe, rpc, env, user));
      case 'identity_refresh': return json(env, await pay.identityRefresh(stripe, rpc, user));
      case 'pay_deposit': return json(env, await pay.payDeposit(stripe, rpc, env, user, body.booking_id));
      case 'signoff': {
        const role = await rpc('svc_role_of', { p_user: user });
        return json(env, await pay.signoff(stripe, rpc, env, body.booking_id, role === 'ops' ? 'ops' : 'brand', user));
      }
      case 'cancel': return json(env, await pay.cancel(stripe, rpc, user, body.booking_id, body.reason || ''));
      case 'resolve': return json(env, await pay.resolve(stripe, rpc, user, body.booking_id, body.talent_p, body.note || ''));
      default: return json(env, { error: 'Unknown action' }, 400);
    }
  } catch (e) { return fail(d.env, e); }
}

// POST /functions/v1/stripe-webhook   (Stripe calls this; no sign-in)
// Two Stripe webhook endpoints can point here: one for Embr's own account
// events and one for connected-account events. Each has its own secret.
export async function stripeWebhook(req: Request, d: Deps): Promise<Response> {
  const sig = req.headers.get('stripe-signature') || '';
  const body = await req.text();
  let event: any = null;
  for (const secret of [d.env.STRIPE_WEBHOOK_SECRET, d.env.STRIPE_CONNECT_WEBHOOK_SECRET]) {
    if (!secret) continue;
    try { event = await d.verifyWebhook(body, sig, secret); break; } catch (_) { /* try the next secret */ }
  }
  if (!event) return new Response('Bad signature', { status: 400 });
  try {
    const result = await pay.handleEvent(d.stripe, d.rpc, event);
    return new Response(JSON.stringify({ received: true, result }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('webhook failed', event.type, e);
    return new Response('Webhook error: ' + e.message, { status: 500 }); // Stripe retries
  }
}

// POST /functions/v1/cron   (pg_cron calls this every 15 minutes)
export async function cron(req: Request, d: Deps): Promise<Response> {
  if (!safeEqual(req.headers.get('x-embr-cron') || '', d.env.CRON_SECRET || '')) return new Response('Forbidden', { status: 403 });
  const results = await pay.autoSignoff(d.stripe, d.rpc, d.env);
  return new Response(JSON.stringify({ results }), { headers: { 'Content-Type': 'application/json' } });
}

// POST /functions/v1/send-email   (the database calls this when a notification is created)
export async function sendEmail(req: Request, d: Deps, send = resendSend): Promise<Response> {
  if (!safeEqual(req.headers.get('x-embr-hook') || '', d.env.EMAIL_HOOK_SECRET || '')) return new Response('Forbidden', { status: 403 });
  const { notification_id } = await req.json().catch(() => ({}));
  const n = await d.rpc('svc_email_for', { p_notification: notification_id });
  if (!n || n.emailed || !n.email) return new Response(JSON.stringify({ skipped: true }));
  if (!d.env.RESEND_API_KEY) { console.log('[email not sent: no RESEND_API_KEY]', n.email, n.text); return new Response(JSON.stringify({ skipped: 'no key' })); }
  const link = (d.env.APP_URL || '').replace(/\/$/, '') + (n.staff ? '/admin' : '') + (n.url || '/');
  await send(d.env, { to: n.email, subject: subjectFor(n.text), html: emailHtml(n.name, n.text, link), text: `${n.text}\n\nOpen Embr: ${link}` });
  await d.rpc('svc_emailed', { p_notification: notification_id });
  return new Response(JSON.stringify({ sent: true }));
}

export function subjectFor(text: string) {
  const s = text.split(/(?<=[.!?])\s/)[0].replace(/[“”]/g, '"');
  return s.length > 90 ? s.slice(0, 87) + '…' : s;
}

const escHtml = (s: string) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export function emailHtml(name: string | null, text: string, link: string) {
  return `<!doctype html><html><body style="margin:0;background:#ecedee;font-family:Arial,Helvetica,sans-serif;color:#000">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:6px">
<tr><td style="padding:28px 28px 0;font-weight:900;font-size:22px;letter-spacing:-0.5px">embr<span style="color:#ff3b00">.</span></td></tr>
<tr><td style="padding:20px 28px 8px;font-size:16px;line-height:1.5">${name ? 'Hi ' + escHtml(name) + ',<br><br>' : ''}${escHtml(text)}</td></tr>
<tr><td style="padding:16px 28px 28px"><a href="${escHtml(link)}" style="display:inline-block;background:#ff3b00;color:#000;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:4px">Open Embr</a></td></tr>
<tr><td style="padding:16px 28px 24px;border-top:1px solid #dcdde0;font-size:12px;color:#5e6168">You're getting this because you have an Embr account. Embr is an invite-only pilot.</td></tr>
</table></td></tr></table></body></html>`;
}

async function resendSend(env: Env, m: { to: string; subject: string; html: string; text: string }) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM || 'Embr <onboarding@resend.dev>', to: [m.to], subject: m.subject, html: m.html, text: m.text }),
  });
  if (!r.ok) throw new Error('Resend ' + r.status + ': ' + (await r.text()));
}
