// Talent screens: Today, Wallet (payouts), Profile (photos, dates, ID check),
// and booking links. Talent never see briefs and can't apply for work:
// brands find them and send offers. "Let work find you".
import { VIEWS, A, F, C, S, go, refreshMe, rerender } from '../state.js';
import { rpc, action, uploadPhoto, deletePhoto, photoUrl, roleRules, modelOptions, agencyText } from '../api.js';
import { agencyBox } from './auth.js';
import { statsForm } from './model.js';
import { $, esc, gbp, pounds, pct, dMed, dLong, today, addDays, opts, CITIES, rolesOf, rolesTxt, rolePlural, roleChips, pickedRoles, USAGE, TERMS, TRAVEL_RANGE, TRAVEL_COSTS, nearby, toast, openLayer, closeLayer, formData, plural, first, busy, confirmDialog } from '../ui.js';
import { ICON } from '../icons.js';
import { thumb, calendar, groupBookings, bookingItem, linkCards } from './common.js';
import { bookingsView, inboxView } from './brand.js';

const V = VIEWS.talent;
const T = () => S.me.talent;
const appOrigin = () => location.origin;

function readiness(t) {
  const steps = [
    ['Add your name, rate and a Book-me name', !!(t.name && t.day_rate && t.handle), 'profile'],
    ...((t.gaps && rolesOf(t).length) ? rolesOf(t).map((r) => {
      const g = t.gaps.find((x) => x.role === r);
      return [`${r} section${g ? ': add ' + g.missing.join(', ') : ''}`, !g, 'work'];
    }) : [['Add at least one photo', (t.photos || []).length > 0, 'profile']]),
    ['Confirm your agency status', !!t.agency_declared, 'agency'],
    ['Verify your ID (18+)', !!t.verified, 'verify'],
    ['Set up payouts with Stripe', !!t.payouts_enabled, 'payouts'],
  ];
  return steps;
}
function readyPanel(t) {
  const s = readiness(t);
  const left = s.filter((x) => !x[1]);
  if (!left.length) return '';
  return `<section class="panel mb24"><div class="row between"><h3>Get ready to be booked</h3><span class="s g">${s.length - left.length} of ${s.length}</span></div>
    <div class="list mt12" style="border:0">${s.map(([l, ok, a]) => `<div class="item" style="padding:10px 0"><span class="st ${ok ? 'ok' : 'wait'}">${ok ? 'Done' : 'To do'}</span><span class="grow s">${l}</span>${ok ? '' : a === 'work' ? `<button class="btn sm" data-a="towork">${location.pathname === '/profile' ? 'Fill it in' : 'Open profile'}</button>` : a === 'profile' || (a === 'agency' && location.pathname !== '/profile') ? '<button class="btn sm" data-tab="profile">Open profile</button>' : a === 'agency' ? '<button class="btn sm primary" data-a="toagency">Confirm</button>' : `<button class="btn sm ${a === 'verify' ? 'primary' : ''}" data-a="${a}">${a === 'verify' ? 'Verify ID' : 'Set up payouts'}</button>`}</div>`).join('')}</div>
    <p class="xs g mt8">${!t.published ? 'Your profile is hidden from brands until it has your name, rate, Book-me name, your agency status and every section for the things you do.' : 'Brands can see your profile. You need the ID check and payouts before you can accept an offer.'}</p></section>`;
}

// ---------------------------------------------------------------- Today
// What talent see once setup is done (docs/dev/talent-engagement.md). Counts only:
// never which brand looked, never a brief, nothing to respond to. Brands make the first move.
const POLISH = [
  [(t) => (t.photos || []).length >= 6, 10, 'Add more photos. Six or more shows your range.', 'towork'],
  [(t) => (t.bio || '').trim().length >= 80, 8, 'Write a bio in your own words. Two or three sentences is plenty.', 'profile'],
  [(t) => (t.tags || []).length >= 3, 5, 'Add three tags that describe your style.', 'profile'],
  [(t) => !!(t.comfort || '').trim(), 4, 'Say what content you\'re comfortable with, so brands know before they book.', 'profile'],
  [(t) => !!(t.instagram || '').trim(), 4, 'Add your Instagram or TikTok.', 'profile'],
  [(t) => !!t.half_rate, 3, 'Add a half-day rate.', 'profile'],
  [(t, p) => !!p?.dates_confirmed_at && Date.now() - new Date(p.dates_confirmed_at) < 14 * 864e5, 6, 'Confirm your dates are up to date.', 'confirm-dates'],
];
export function strength(t, pulse) {
  const gates = readiness(t);
  const gateScore = Math.round(60 * gates.filter((g) => g[1]).length / gates.length);
  const polish = POLISH.map(([test, pts, label, action]) => ({ ok: test(t, pulse), pts, label, action }));
  return { score: gateScore + polish.filter((x) => x.ok).reduce((n, x) => n + x.pts, 0), steps: polish.filter((x) => !x.ok) };
}
export function weekLines(e) {
  if (!e) return [];
  const w = e.week || {}; const l = e.lifetime || {};
  const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
  if ((w.total || 0) >= 3) {
    return [
      w.briefs > 0 && `${n(w.briefs, 'brief', 'briefs')} posted by brands ${e.scope === 'city' ? 'in ' + e.city : 'across the UK'}`,
      w.bookings > 0 && `${n(w.bookings, 'booking', 'bookings')} confirmed`,
      w.brands > 0 && `${n(w.brands, 'new brand', 'new brands')} joined`,
      ...(e.my_roles || []).map((r) => `${n(r.briefs, 'brief', 'briefs')} asked for ${rolePlural(r.role)}`),
    ].filter(Boolean);
  }
  const life = [l.briefs > 0 && n(l.briefs, 'brief', 'briefs') + ' posted', l.bookings > 0 && n(l.bookings, 'booking', 'bookings') + ' confirmed', l.brands > 0 && n(l.brands, 'brand', 'brands') + ' joined'].filter(Boolean);
  return life.length ? ['Since the pilot began: ' + life.join(', ')] : [];
}
const tile = (label, fig, sub, live = true) => (live ? `<div class="tile">` : `<button type="button" class="tile off" data-a="towork">`) + `<span class="l">${label}</span><span class="tv">${fig}</span><span class="sub">${sub}</span>` + (live ? '</div>' : '</button>');
function statsRow(p, t) {
  if (!p) return '';
  const live = !!t.published;
  const seen = live ? tile('Seen by brands', p.views_7d, p.views_7d ? (p.views_prev_7d ? `this week, ${p.views_prev_7d} last week` : 'this week') : 'None yet this week')
    : tile('Seen by brands', 'Not live yet', 'Goes live when your profile is complete', false);
  const saved = live ? tile('Saved by brands', p.saves_total, p.saves_7d > 0 ? `${p.saves_7d} new this week` : 'in total')
    : tile('Saved by brands', 'Not live yet', 'Brands save profiles they like', false);
  const offers = tile('Offers', p.offers_total, p.offers_total ? 'on Embr' : 'Brands book you from your profile');
  return `<section class="tiles mt24" aria-label="Seen and saved">${seen}${saved}${offers}</section>
    <p class="xs g mt8">You see how many brands, never which. Brands make the first move.</p>`;
}
function strengthPanel(t, p) {
  if (readiness(t).some((g) => !g[1])) return readyPanel(t);
  const { score, steps } = strength(t, p);
  if (!steps.length) return `<section class="panel mb24"><div class="row between"><h3>Profile strength</h3><span class="st ok">Profile complete</span></div><p class="s g mt8">You're all set for now. Check back as bookings come in.</p></section>`;
  const [next, ...more] = steps;
  const btn = next.action === 'confirm-dates' ? '<button class="btn sm primary" data-a="confirm-dates">Confirm my dates</button>'
    : next.action === 'towork' ? '<button class="btn sm primary" data-a="towork">Open profile</button>' : '<button class="btn sm primary" data-tab="profile">Open profile</button>';
  return `<section class="panel mb24"><div class="row between"><h3>Profile strength</h3><span class="money">${score}%</span></div>
    <div class="meter mt12" role="progressbar" aria-valuenow="${score}" aria-valuemin="0" aria-valuemax="100" aria-label="Profile strength"><span style="width:${score}%"></span></div>
    <div class="row between top-al mt12" style="gap:12px"><p class="s"><b>Next:</b> ${esc(next.label)}</p>${btn}</div>
    ${more.slice(0, 2).map((x) => `<p class="s g mt4">${esc(x.label)}</p>`).join('')}</section>`;
}
function monthsBars(list) {
  const now = new Date();
  const months = [...Array(6)].map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('en-GB', { month: 'short' }), p: 0 };
  });
  const done = list.filter((b) => b.status === 'completed');
  done.forEach((b) => { const m = months.find((x) => x.key === (b.updated_at || '').slice(0, 7)); if (m) m.p += b.talent_fee_p; });
  const max = Math.max(...months.map((m) => m.p), 1);
  const year = done.filter((b) => (b.updated_at || '').slice(0, 4) === String(now.getFullYear())).reduce((n, b) => n + b.talent_fee_p, 0);
  return `<h2 class="sec mt48">Last 6 months</h2><div class="bar6" role="img" aria-label="Paid to you each month for the last 6 months">${months.map((m) => `<div class="b"><span class="v">${m.p ? gbp(m.p) : ''}</span><span class="bar" style="height:${m.p ? Math.max(6, Math.round(100 * m.p / max)) : 2}%"></span><span class="m">${m.label}</span></div>`).join('')}</div>
    <p class="s g mt8">${year ? `Earned on Embr this year: <b>${gbp(year)}</b>` : 'Paid when the brand signs off. 0% commission.'}</p>`;
}
function milestones(t, p) {
  if (!p) return '';
  const m = [['Profile live', t.published], ['First brand view', p.views_total > 0], ['First save', p.saves_total > 0], ['First offer', p.offers_total > 0], ['First booking paid', p.bookings_completed > 0]];
  return `<h2 class="sec mt48">Your Embr so far</h2><div class="miles">${m.map(([l, ok]) => `<span class="mile${ok ? ' done' : ''}">${ok ? '✓ ' : ''}${l}</span>`).join('')}</div>`;
}
function weekPanel(e) {
  if (!e) return '';
  const lines = weekLines(e);
  return `<div class="panel"><h3>This week on Embr</h3>${lines.length ? `<ul class="pulse mt8">${lines.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="s mt8">Brands are being invited in now. Activity will appear here as it happens.</p>'}
    <p class="xs g mt12">Anonymised totals from Embr. Let work find you: brands make the first move, so there's nothing to apply for.</p></div>`;
}
function datesPanel(t, p) {
  if (!t.published || !p) return '';
  const at = p.dates_confirmed_at ? Math.floor((Date.now() - new Date(p.dates_confirmed_at)) / 864e5) : null;
  const line = at === null ? 'Brands only see you for dates you\'re free. Check yours now.' : at === 0 ? 'Confirmed today.' : `Last confirmed ${plural(at, 'day')} ago.`;
  return `<div class="panel"><h3>Your dates</h3><p class="s g mt8">${line}</p><div class="row mt12"><button class="btn sm ${at === 0 ? '' : 'primary'}" data-a="confirm-dates">Confirm my dates</button><button class="btn sm quiet" data-tab="profile">Edit dates</button></div></div>`;
}
A['confirm-dates'] = async (el) => { busy(el, true, 'Saving…'); await rpc('confirm_dates'); toast('Dates confirmed'); rerender(); };

V.today = async () => {
  await refreshMe();
  const t = T();
  const [list, pulse, ep] = await Promise.all([rpc('my_bookings'), rpc('talent_pulse').catch(() => null), rpc('embr_pulse').catch(() => null)]);
  const month = today().slice(0, 7);
  const paidM = list.filter((b) => b.status === 'completed' && (b.updated_at || '').slice(0, 7) === month).reduce((s, b) => s + b.talent_fee_p, 0);
  const onWay = list.filter((b) => ['confirmed', 'wrapped'].includes(b.status)).reduce((s, b) => s + b.talent_fee_p, 0);
  const life = list.filter((b) => b.status === 'completed').reduce((s, b) => s + b.talent_fee_p, 0);
  const todo = [];
  list.filter((b) => b.status === 'offer').forEach((b) => todo.push([b, 'New offer from ' + b.brand.name + ': ' + gbp(b.talent_fee_p) + ' to you', 'Review offer', true]));
  list.filter((b) => b.status === 'confirmed' && b.shoot_date <= today()).forEach((b) => todo.push([b, 'Mark the job wrapped so the brand can sign off', 'Mark wrapped']));
  const up = list.filter((b) => ['accepted', 'confirmed', 'wrapped'].includes(b.status)).sort((a, b) => a.shoot_date.localeCompare(b.shoot_date));
  return `<p class="g">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p><h1 class="display t-72 mt8">Hi ${esc(first(t.name) || 'there')}</h1>
  <button class="earn mt32" data-tab="wallet"><span class="l">Paid to you this month</span><span class="big">${gbp(paidM)}</span><span class="earn-sub"><span><b>${gbp(onWay)}</b> on the way, deposits paid</span><span><b>${gbp(life)}</b> earned on Embr, 0% commission</span></span><span class="go">Wallet →</span></button>
  ${statsRow(pulse, t)}
  <div class="cols mt48"><div>
    ${strengthPanel(t, pulse)}
    ${todo.length ? `<section class="todo" aria-label="Needs you">${todo.map(([b, txt, btn, p]) => `<div class="item">${thumb(b.brand, true)}<div class="grow"><div class="ttl">${esc(b.title)}</div><div class="meta"><span>${esc(txt)}</span></div></div><button class="btn ${p ? 'primary' : ''} sm" data-a="booking" data-id="${b.id}">${btn}</button></div>`).join('')}</section>` : ''}
    <h2 class="sec">Coming up</h2>${up.length ? `<div class="list">${up.map(bookingItem).join('')}</div>` : '<div class="empty">Nothing booked yet. Let work find you: brands book you straight from your profile.</div>'}
    ${monthsBars(list)}
    ${milestones(t, pulse)}
  </div><aside class="stack">
    ${weekPanel(ep)}
    ${datesPanel(t, pulse)}
    <div class="panel"><h3>Let work find you</h3><p class="s g mt8">Brands search Embr and post briefs, and Embr shows them who fits. Keep your photos, rate and free dates up to date.</p><button class="btn sm mt12" data-tab="profile">Update profile</button></div>
    ${t.handle ? `<div class="panel"><h3>Your Book-me page</h3><p class="s g mt8">Put it in your Instagram bio. Brands who find you there book you through Embr.</p><p class="s mt8"><b>${esc(appOrigin().replace(/^https?:\/\//, ''))}/@${esc(t.handle)}</b></p><div class="row mt12"><button class="btn sm" data-a="copy" data-text="${esc(appOrigin())}/@${esc(t.handle)}">Copy link</button><a class="btn sm quiet" href="/@${esc(t.handle)}" target="_blank" rel="noopener">Preview</a></div></div>` : ''}
    <div class="panel"><h3>Got an enquiry on Instagram?</h3><p class="s g mt8">Send the brand a booking link and the job moves onto Embr: deposit paid up front, terms in writing, paid at sign-off.</p><button class="btn sm mt12" data-tab="invite">Create a booking link</button></div>
  </aside></div>`;
};

// ---------------------------------------------------------------- Wallet
V.wallet = async () => {
  const q = new URLSearchParams(location.search);
  if (q.get('stripe')) { await action('connect_refresh').catch(() => null); history.replaceState({}, '', '/wallet'); }
  await refreshMe();
  const t = T();
  const list = await rpc('my_bookings');
  const paid = list.filter((b) => b.status === 'completed');
  const tot = list.filter((b) => b.status === 'completed').reduce((s, b) => s + b.talent_fee_p, 0);
  const onWay = list.filter((b) => ['confirmed', 'wrapped'].includes(b.status)).reduce((s, b) => s + b.talent_fee_p, 0);
  const held = list.filter((b) => b.status === 'disputed').reduce((s, b) => s + b.talent_fee_p, 0);
  return `<h1 class="display t-48 mb24">Wallet</h1>
  <div class="vault"><span class="l">Paid to you on Embr</span><span class="big">${gbp(tot)}</span><span class="l">${plural(list.filter((b) => b.status === 'completed').length, 'job')} · 0% commission</span>
    <div class="vault-row"><div><span>On the way</span><b>${gbp(onWay)}</b><em>Paid when the brand signs off</em></div>${held ? `<div><span>Paused</span><b>${gbp(held)}</b><em>While a problem is looked at</em></div>` : ''}</div></div>
  <div class="cols mt48"><section><h2 class="sec">Payments</h2>
    ${paid.length ? `<div class="list">${paid.map((b) => `<button class="item" data-a="booking" data-id="${b.id}"><div class="grow"><div class="ttl">${esc(b.title)}</div><div class="meta"><span>${esc(b.brand.name)}</span><span>${dMed(b.shoot_date)}</span></div></div><div class="money" style="color:var(--ok)">+${gbp(b.talent_fee_p)}</div></button>`).join('')}</div>` : '<div class="empty">Payments will appear here.</div>'}
  </section><aside class="stack">
    <div class="panel"><h3>Payouts</h3>${t.payouts_enabled
      ? `<p class="s g mt8"><span class="st ok">Set up</span> Embr pays you through Stripe, straight to your bank.</p><button class="btn sm mt12" data-a="stripe-dash">Open Stripe payouts</button>`
      : `<p class="s g mt8">${t.stripe_account ? 'Stripe needs a few more details before it can pay you.' : 'Embr pays you through Stripe. Add your bank details once and every booking is paid there.'}</p><button class="btn primary sm mt12" data-a="payouts">${t.stripe_account ? 'Finish payout setup' : 'Set up payouts'}</button>`}</div>
    <div class="panel"><h3>How you're paid</h3><p class="s g mt8">Brands pay a 50% deposit when you accept, which confirms the booking. After the shoot, mark it wrapped. The brand then has ${S.me.settings.auto_signoff_hours} hours to sign off or report a problem; if they do neither it signs off automatically. At sign-off you get the full fee. If a brand cancels less than ${S.me.settings.free_cancel_days} days before, you get ${pct(S.me.settings.late_cancel_share)} of the session fee.</p></div>
    <div class="panel"><h3>Membership</h3><p class="s g mt8">Free for founding talent during the pilot.</p></div>
  </aside></div>`;
};
A.payouts = async (el) => {
  busy(el, true, 'Opening Stripe…');
  try { const r = await action('connect_onboard'); location.href = r.url; } catch (e) { busy(el, false); throw e; }
};
A['stripe-dash'] = async () => { const r = await action('connect_dashboard'); window.open(r.url, '_blank', 'noopener'); };

A.idcheck = async (el) => {
  busy(el, true, 'Checking…');
  try { await action('identity_refresh'); } catch { /* shown below */ }
  await refreshMe(); rerender();
  toast(T().verified ? 'You\'re verified 18+' : 'Still being confirmed. Embr will let you know.');
};
A.toagency = () => $('#f-agency')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
F['f-agency'] = async () => {
  S.me = await rpc('declare_agency');
  toast(S.me.talent.published ? 'Confirmed. Your profile is live.' : 'Confirmed');
  rerender();
};
A.verify = async (el) => {
  busy(el, true, 'Opening ID check…');
  try {
    const r = await action('identity_start');
    if (r.verified) { toast('You\'re already verified'); await refreshMe(); rerender(); return; }
    location.href = r.url;
  } catch (e) { busy(el, false); throw e; }
};

// ---------------------------------------------------------------- Profile
// One person can do several things (Model, UGC creator, Actor…). Each role they
// pick gets its own section of work, and the profile only goes live once every
// section has what brands need to see (rules come from role_rules()).
V.profile = async () => {
  const q = new URLSearchParams(location.search);
  if (q.get('id')) { await action('identity_refresh').catch(() => null); history.replaceState({}, '', '/profile'); }
  const [, rules, mo, agency] = await Promise.all([refreshMe(), roleRules(), modelOptions(), agencyText().catch(() => '')]);
  const t = T();
  const idStatus = t.verified ? '<span class="st ok">Verified 18+</span>'
    : t.identity_status === 'processing' ? '<span class="st wait">Checking your ID…</span>'
      : t.identity_status === 'under_18' ? '<span class="st bad">Under 18</span>'
        : t.identity_status === 'review' ? '<span class="st wait">Confirming your age</span>'
          : t.identity_status === 'requires_input' ? '<span class="st warn">Needs another try</span>' : '<span class="st wait">Not done</span>';
  return `<div class="row between top-al wrap mb24"><h1 class="display t-48">Profile</h1>${t.handle && t.published ? `<a class="btn" href="/@${esc(t.handle)}" target="_blank" rel="noopener">See your Book-me page</a>` : ''}</div>
  <div id="ready">${readyPanel(t)}</div>
  ${t.agency_declared ? '' : `<form id="f-agency" class="panel mb24"><h3>Confirm your agency status</h3><p class="s g mt8">Embr is for models and creatives who are free to take bookings themselves. Brands can't see your profile until you confirm this.</p><div class="mt12">${agencyBox(agency)}</div><button class="btn primary sm mt12" type="submit">Confirm</button></form>`}
  <div class="cols" style="grid-template-columns:minmax(0,1fr) 400px"><div><form id="f-profile"><div class="fgrid">
    <label class="field span">Name<input class="in" name="name" required value="${esc(t.name)}"></label>
    ${roleChips(rolesOf(t), 'What you do')}
    <label class="field">Based in<select class="in" name="city">${opts(CITIES, t.city)}</select></label>
    <label class="field">Day rate, £<input class="in" type="number" name="day_rate" min="5" step="5" required value="${t.day_rate ?? ''}"></label>
    <label class="field">Half-day rate, £<input class="in" type="number" name="half_rate" min="5" step="5" value="${t.half_rate ?? ''}"></label>
    <label class="field">How far you'll travel<select class="in" name="travel_range">${TRAVEL_RANGE.map(([k, l]) => `<option value="${k}" ${(t.travel_range || 'local') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="field">Travel costs<select class="in" name="travel_costs">${TRAVEL_COSTS.map(([k, l]) => `<option value="${k}" ${(t.travel_costs || 'discuss') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <p class="hint span" style="margin-top:-8px">Your usual preference. You still decide on every offer, so you can say yes to a trip one week and no the next. ${nearby(t.city).length ? `"Around my region" from ${esc(t.city)} means ${esc(nearby(t.city).join(' and '))}.` : 'Brands in other cities see you if you travel beyond your city.'}</p>
    <label class="field">Book-me name<input class="in" name="handle" required pattern="[A-Za-z0-9_.]{2,30}" value="${esc(t.handle)}" placeholder="yourname"><span class="hint">Your page: ${esc(appOrigin().replace(/^https?:\/\//, ''))}/@${esc(t.handle || 'yourname')}</span></label>
    <label class="field">Instagram or TikTok<input class="in" name="instagram" value="${esc(t.instagram)}" placeholder="@handle"></label>
    <label class="field span">Bio<textarea class="in" name="bio" maxlength="1200" placeholder="Who you are, your experience, and what you love working on">${esc(t.bio)}</textarea></label>
    <label class="field span">Tags <span class="hint">Comma separated, for example: streetwear, beauty, tattoos</span><input class="in" name="tags" value="${esc((t.tags || []).join(', '))}"></label>
    <label class="field span">Content you're comfortable with <span class="hint">Brands see this before they book. For example: no lingerie or swimwear</span><textarea class="in" name="comfort" rows="2" maxlength="600">${esc(t.comfort)}</textarea></label>
  </div><button class="btn ink mt24" type="submit">Save profile</button></form>
  <section id="work" class="mt48" aria-label="Your work">${workHTML(t, rules, mo)}</section></div>
  <aside class="stack">
    <div class="panel"><div class="row between"><h3>ID check</h3>${idStatus}</div><p class="s g mt8">Embr is for talent aged 18 and over. Stripe checks your passport, driving licence or ID card and a selfie. Embr only receives the result and your date of birth.</p>${t.verified ? '' : t.identity_status === 'review' || t.identity_status === 'processing' ? '<p class="s mt8">Your check went through. Embr will confirm your age shortly.</p><button class="btn sm mt12" data-a="idcheck">Check again</button>' : `<button class="btn primary sm mt12" data-a="verify">${t.identity_status ? 'Try again' : 'Verify ID'}</button>`}</div>
    <div><h3 class="mb8">When you're free</h3><p class="s g mb12">Tap a day to mark it unavailable. Brands only see you for dates you're free.</p><div id="cal">${calendar(t, true)}</div></div>
  </aside></div>`;
};

const MAXP = 24;
function workHTML(t, rules, mo) {
  const roles = rolesOf(t);
  const photos = t.photos || [];
  const links = t.links || [];
  const cover = photos[0]?.id;
  return `<h2 class="t-24">Your work</h2>
  <p class="s g mt8 measure">A section for each thing you do. Brands see all of them on your profile, and Embr uses them to match you to briefs. Use work you have the rights to, and credit photographers in your bio.</p>
  ${roles.map((r) => {
    const rule = rules[r] || {};
    const gap = (t.gaps || []).find((g) => g.role === r);
    const ph = photos.filter((p) => p.role === r);
    const ln = links.filter((l) => l.role === r);
    return `<section class="role-sec" data-role-sec="${esc(r)}"><h3>${esc(r)} ${gap ? `<span class="need">Needs ${esc(gap.missing.join(', '))}</span>` : '<span class="done">Complete</span>'}</h3>
      <p class="s g mt8">${esc(rule.hint || '')}</p>
      ${rule.stats ? statsForm(t.stats || {}, mo) : ''}
      <h4 class="s mt16 mb8">${esc(rule.photo_label || 'Photos')}${rule.photos ? ` <span class="g">(at least ${rule.photos})</span>` : ''}</h4>
      <div class="phs">${ph.map((p) => `<div class="p" style="background-image:url('${photoUrl(p.path)}')">${p.id === cover ? '<span class="xs" style="position:absolute;left:6px;bottom:6px;background:#fff;padding:1px 6px;border-radius:2px;font-weight:600">Cover</span>' : `<button type="button" data-a="cover" data-id="${p.id}" aria-label="Make cover photo" style="left:6px;right:auto;font-size:11px;width:auto;padding:0 6px;border-radius:2px">Cover</button>`}<button type="button" data-a="rmphoto" data-id="${p.id}" data-path="${esc(p.path)}" aria-label="Remove photo">×</button></div>`).join('')}
        ${photos.length < MAXP ? `<label class="p" tabindex="0">+ Add<input type="file" accept="image/*" multiple hidden data-change="photos" data-role="${esc(r)}" aria-label="Add ${esc(rule.photo_label || 'photos')}"></label>` : ''}</div>
      <h4 class="s mt16 mb8">${esc(rule.link_label || 'Links')}${rule.links ? ` <span class="g">(at least ${rule.links})</span>` : ''}</h4>
      ${ln.length ? linkCards(ln, true) : ''}
      <form class="addlink" data-addlink="${esc(r)}"><input class="in" name="url" type="url" required placeholder="https://… (TikTok, Instagram, YouTube, Vimeo, Drive)" aria-label="Link for ${esc(r)}"><input class="in" name="title" maxlength="120" placeholder="What it is, e.g. Skincare ad" aria-label="Title"><button class="btn sm" type="submit">Add link</button></form>
    </section>`;
  }).join('')}`;
}
// redraws only the work sections (never the profile form above them), and keeps
// any model details typed but not yet saved
async function refreshWork() {
  const [rules, mo] = await Promise.all([roleRules(), modelOptions()]);
  const sf = $('#f-stats');
  const typed = sf ? Object.fromEntries(Object.entries(formData(sf)).filter(([, v]) => v !== '')) : {};
  const t = T();
  $('#work').innerHTML = workHTML({ ...t, stats: { ...(t.stats || {}), ...typed } }, rules, mo);
  $('#ready').innerHTML = readyPanel(T());
}
A.towork = () => {
  if (location.pathname !== '/profile') return go('/profile');
  const gap = T().gaps?.[0];
  const el = (gap && document.querySelector(`[data-role-sec="${CSS.escape(gap.role)}"]`)) || $('#work');
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
// role chips on the profile save straight away and redraw the sections
document.addEventListener('roles-changed', async (e) => {
  if (e.target.id !== 'f-profile') return;
  const roles = pickedRoles(e.target);
  try { S.me = await rpc('save_talent', { p: { roles } }); await refreshWork(); toast('Saved: ' + rolesTxt(S.me.talent)); }
  catch (err) { toast(err.message); }
});
// add a video, showreel or channel link to a role's section
document.addEventListener('submit', async (e) => {
  const form = e.target.closest('form[data-addlink]');
  if (!form) return;
  e.preventDefault();
  const d = formData(form);
  try { S.me = await rpc('add_link', { p_role: form.dataset.addlink, p_url: d.url, p_title: d.title || null }); await refreshWork(); toast(S.me.talent.published ? 'Added. Your profile is live.' : 'Link added'); }
  catch (err) { toast(err.message, 5000); }
}, true);
// switching womenswear/menswear swaps the measurement fields, keeping what's typed
C.sizing = async (sel) => {
  const form = sel.closest('form');
  const typed = Object.fromEntries(Object.entries(formData(form)).filter(([, v]) => v !== ''));
  form.outerHTML = statsForm({ ...(T().stats || {}), ...typed, sizing: sel.value }, await modelOptions());
};
F['f-stats'] = async (form) => {
  S.me = await rpc('save_model_stats', { p: formData(form) });
  await refreshWork();
  const gap = (S.me.talent.gaps || []).find((g) => g.role === 'Model');
  toast(S.me.talent.published ? 'Model details saved. Your profile is live.' : gap ? 'Saved. Still needed for modelling: ' + gap.missing.join(', ') : 'Model details saved');
};
A.rmlink = async (el) => { S.me = await rpc('remove_link', { p_id: el.dataset.id }); await refreshWork(); };
F['f-profile'] = async (form) => {
  const d = formData(form);
  const travel = { travel_range: d.travel_range, travel_costs: d.travel_costs };
  delete d.travel_range; delete d.travel_costs;
  d.tags = (d.tags || '').split(',').map((x) => x.trim()).filter(Boolean);
  d.roles = pickedRoles(form);
  S.me = await rpc('save_talent', { p: d });
  S.me = await rpc('save_travel', { p: travel });
  toast(S.me.talent.published ? 'Saved. Brands can see your profile.' : 'Saved. Fill in your work sections to go live.');
  await refreshWork(); // keeps model details typed below but not yet saved
};
C.photos = async (input) => {
  const files = [...input.files].slice(0, MAXP - (T().photos || []).length);
  if (!files.length) return;
  toast(`Uploading ${plural(files.length, 'photo')}…`, 20000);
  for (const f of files) {
    if (f.size > 25 * 1024 * 1024) { toast(f.name + ' is too big'); continue; }
    S.me = await uploadPhoto(S.me.id, f, input.dataset.role || null);
  }
  toast(S.me.talent.published ? 'Photos added. Your profile is live.' : 'Photos added');
  await refreshWork();
};
A.rmphoto = async (el) => {
  const ok = await confirmDialog({ title: 'Remove this photo?', body: 'It will be deleted from your profile.', yes: 'Remove', danger: true });
  if (!ok) return;
  S.me = await deletePhoto(el.dataset.id, el.dataset.path);
  await refreshWork();
};
A.cover = async (el) => { S.me = await rpc('cover_photo', { p_id: el.dataset.id }); await refreshWork(); };
A.day = async (el) => {
  S.me = await rpc('toggle_off_day', { p_day: el.dataset.d });
  $('#cal').innerHTML = calendar(S.me.talent, true);
};

V.bookings = bookingsView;
V.inbox = inboxView;

// ---------------------------------------------------------------- booking links
V.invite = async () => {
  const links = await rpc('my_links');
  const t = T();
  const ready = t.verified && t.payouts_enabled;
  return `<div class="row between top-al wrap"><div><h1 class="display t-48">Booking links</h1><p class="g measure mt8">Got an enquiry on Instagram, WhatsApp or email? Send the brand a link and the whole booking moves onto Embr: deposit paid up front, terms in writing, and payment at sign-off. Brands pay a ${pct(S.me.settings.fee_link)} fee on link bookings. You still keep 100%.</p></div>
    <button class="btn primary" data-a="linknew" ${ready ? '' : 'disabled'}>${ICON.plus}Create booking link</button></div>
  ${ready ? '' : `<div class="callout act mt24">Before you can send booking links, ${!t.verified ? '<button class="link" data-a="verify">verify your ID</button>' : ''}${!t.verified && !t.payouts_enabled ? ' and ' : ''}${!t.payouts_enabled ? '<button class="link" data-a="payouts">set up payouts</button>' : ''}.</div>`}
  ${links.length ? `<div class="list mt24">${links.map((l) => `<div class="item"><div class="grow"><div class="ttl">${esc(l.title)}</div><div class="meta"><span>${dMed(l.shoot_date)}</span><span>${pounds(l.day_rate)} a day</span><span>${esc(location.host)}/l/${esc(l.code)}</span></div></div>
    ${l.booking ? `<span class="st ok">Booked by ${esc(l.booking.brand.name)}</span><button class="btn sm" data-a="booking" data-id="${l.booking.id}">Open booking</button>`
      : l.status === 'withdrawn' ? '<span class="st off">Withdrawn</span>' : l.expired ? '<span class="st off">Expired</span>'
        : `<button class="btn sm" data-a="linkshare" data-code="${esc(l.code)}" data-title="${esc(l.title)}">Share</button><button class="btn sm quiet" data-a="linkwithdraw" data-id="${l.id}">Withdraw</button>`}</div>`).join('')}</div>`
    : '<div class="empty">No links yet. Create one the next time a brand messages you.</div>'}`;
};
A.linknew = () => openLayer({
  kind: 'sheet', label: 'Create booking link', head: '<div class="grow s g">You set the terms. The brand accepts and pays the deposit.</div>',
  body: `<h2 class="display t-48">Create a booking link</h2><form id="f-link" class="mt24" style="max-width:640px"><div class="fgrid">
    <label class="field ${rolesOf(T()).length > 1 ? '' : 'span'}">What's the job?<input class="in" name="title" required placeholder="Café menu shoot"></label>
    ${rolesOf(T()).length > 1 ? `<label class="field">Booked as<select class="in" name="role">${opts(rolesOf(T()))}</select></label>` : `<input type="hidden" name="role" value="${esc(rolesOf(T())[0] || '')}">`}
    <label class="field">Date<input class="in" type="date" name="shoot_date" required min="${today()}" value="${addDays(14)}"></label>
    <label class="field">Days<input class="in" type="number" name="days" min="1" max="14" value="1"></label>
    <label class="field">Day rate, £<input class="in" type="number" name="day_rate" min="5" step="5" required value="${T().day_rate || 200}"></label>
    <label class="field">Usage fee, £<input class="in" type="number" name="usage_fee" min="0" step="5" value="0"></label>
    <label class="field">Where they'll use the images<select class="in" name="usage_where">${opts(USAGE)}</select></label>
    <label class="field">For how long<select class="in" name="usage_term">${opts(TERMS, '12 months')}</select></label>
    <label class="field span">Note to the brand <span class="hint">Optional</span><textarea class="in" name="note" rows="2" placeholder="Lovely to hear from you! Here's the booking."></textarea></label></div></form>`,
  foot: '<span class="grow s g">The link works once and expires after 30 days.</span><button class="btn primary" type="submit" form="f-link">Create link</button>',
});
F['f-link'] = async (form) => {
  const d = formData(form);
  const l = await rpc('create_link', { p: { ...d, usage: `${d.usage_where}, ${d.usage_term}`, days: +d.days, day_rate: +d.day_rate, usage_fee: +d.usage_fee || 0 } });
  closeLayer();
  rerender();
  A.linkshare({ dataset: { code: l.code, title: l.title } });
};
A.linkshare = (el) => {
  const url = `${appOrigin()}/l/${el.dataset.code}`;
  const dm = `Thanks for getting in touch! I take bookings through Embr, so the terms are in writing and the deposit is paid up front. Here's the booking for “${el.dataset.title}”: ${url}`;
  openLayer({ kind: 'dialog', head: '<h2 class="t-24">Send your booking link</h2>',
    body: `<label class="field">Link<input class="in" readonly value="${esc(url)}"></label><label class="field mt16">Ready-written reply<textarea class="in" readonly rows="5">${esc(dm)}</textarea></label>`,
    foot: `<button class="btn" data-a="copy" data-text="${esc(url)}">Copy link</button><button class="btn ink" data-a="copy" data-text="${esc(dm)}">Copy reply</button>${navigator.share ? `<button class="btn primary" data-a="nativeshare" data-text="${esc(dm)}">Share…</button>` : ''}` });
};
A.nativeshare = async (el) => { try { await navigator.share({ text: el.dataset.text }); } catch { /* cancelled */ } };
A.linkwithdraw = async (el) => {
  const ok = await confirmDialog({ title: 'Withdraw this link?', body: 'Anyone who opens it will see it\'s no longer available.', yes: 'Withdraw', danger: true });
  if (!ok) return;
  await rpc('withdraw_link', { p_id: el.dataset.id });
  rerender();
};
