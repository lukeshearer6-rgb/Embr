// Public pages anyone can open without signing in:
//  /@handle   a talent's Book-me page (for their Instagram bio)
//  /l/CODE    a booking link a talent sent to a brand
import { VIEWS, A, F, S, go, refreshMe } from '../state.js';
import { rpc, action, photoUrl, roleRules } from '../api.js';
import { $, esc, gbp, pounds, pct, dLong, dMed, toast, formData, first, openLayer, rolesOf, rolesTxt, travelTxt } from '../ui.js';
import { ICON, LOGO } from '../icons.js';
import { calendar, workByRole } from './common.js';
import { setVia, via } from './auth.js';

const frame = (inner) => `<header class="top"><div class="shell topbar"><a class="brandmark" href="/" data-go="/"><img src="${LOGO}" alt="Embr"></a>
  <div class="who">${S.session ? '<button class="link s" data-go="/">Open Embr</button>' : '<button class="link s" data-a="pub-signin">Sign in</button>'}</div></div></header>
  <main class="shell" id="main">${inner}</main>`;

async function ensureMe() { if (S.session && !S.me) await refreshMe().catch(() => null); }

VIEWS.public.bookme = async (app, handle) => {
  app.dataset.role = '';
  app.innerHTML = frame('<div class="empty">Loading…</div>');
  const [t, , rules] = await Promise.all([rpc('public_talent', { p_handle: handle }), ensureMe(), roleRules().catch(() => ({}))]);
  if (S.session && S.me && !S.me.role) return go('/', { replace: true });
  if (!t) { app.innerHTML = frame('<h1 class="display t-48">Page not found</h1><p class="g mt16">This Book-me page doesn\'t exist or isn\'t live yet.</p>'); return; }
  const ph = (t.photos || []).map((p) => photoUrl(p.path));
  const role = S.me?.role;
  const act = role === 'brand' ? `<button class="btn primary full" data-a="pub-book" data-id="${t.id}">Book ${esc(first(t.name))}</button><p class="xs g mt8">Booking as ${esc(S.me.brand?.name || S.me.email)}.</p>`
    : role ? `<p class="s g">Brands see a button here to book ${esc(first(t.name))}.</p>`
      : `<button class="btn primary full" data-a="pub-join" data-handle="${esc(t.handle)}">Book ${esc(first(t.name))}</button><p class="xs g mt8">You'll sign in with your email and set up a free brand account. No invite needed.</p>`;
  app.innerHTML = frame(`<div class="cs-grid bm-grid">
    <div>${ph.length ? `<div class="gallery">${ph.slice(0, 6).map((u) => `<div style="background-image:url('${u}')"></div>`).join('')}</div>` : ''}
</div>
    <div class="bm-work">${workByRole(t, rules)}</div>
    <aside class="bm-side"><p class="s g">Based in ${esc(t.city)}</p><h1 class="pname mt8">${esc(t.name)}${t.verified ? ICON.tick : ''}</h1>
      <div class="rolebadges mt12" aria-label="What ${esc(first(t.name))} does">${rolesOf(t).map((r) => `<span>${esc(r)}</span>`).join('')}</div>
      <dl class="statline">${t.height ? `<div><dt>Height</dt><dd>${esc(t.height)}</dd></div>` : ''}<div><dt>Day rate</dt><dd>${t.day_rate ? pounds(t.day_rate) : '–'}</dd></div><div><dt>Travel</dt><dd>${esc(travelTxt(t))}</dd></div></dl>
      ${t.bio ? `<p class="mt24">${esc(t.bio)}</p>` : ''}
      <div class="mt24">${act}</div>
      <h3 class="mt32 mb12">Free dates</h3>${calendar({ ...t, off_days: [] })}
      <ul class="s g mt24" style="padding-left:18px;line-height:1.8"><li>Terms agreed in writing before the shoot</li><li>50% deposit when ${esc(first(t.name))} accepts, balance at sign-off</li><li>${esc(first(t.name))} keeps 100% of the fee</li>${t.verified ? '<li>ID checked: 18+</li>' : ''}</ul>
      <p class="xs g mt24">Embr: unsigned, not unseen.</p></aside></div>`);
};

VIEWS.public.link = async (app, code) => {
  app.dataset.role = '';
  app.innerHTML = frame('<div class="empty">Loading…</div>');
  const [l] = await Promise.all([rpc('public_link', { p_code: code }), ensureMe()]);
  if (S.session && S.me && !S.me.role) return go('/', { replace: true });
  if (!l) { app.innerHTML = frame('<h1 class="display t-48">Link not found</h1><p class="g mt16">This booking link doesn\'t exist or has been withdrawn.</p>'); return; }
  const t = l.talent;
  const ph = photoUrl(t.photo);
  const role = S.me?.role;
  let act;
  if (!l.open) act = `<div class="callout">${l.status === 'used' ? 'This link has already been booked.' : 'This link has expired.'} Message ${esc(first(t.name))} for a new one.</div>`;
  else if (role === 'brand') act = `<form id="f-acceptlink" data-code="${esc(l.code)}"><label class="field">Where's the shoot? <span class="hint">Optional, you can add it later</span><input class="in" name="location"></label>
      <label class="field mt12">Call time <span class="hint">Optional</span><input class="in" name="call_time" placeholder="9am"></label>
      <label class="check mt16"><input type="checkbox" name="agree" required> <span>I accept the Embr booking agreement for these terms, including the ${gbp(l.deposit_p)} deposit now and free cancellation until ${S.me.settings.free_cancel_days} days before.</span></label>
      <button class="btn primary full mt16" type="submit">Accept and pay ${gbp(l.deposit_p)} deposit</button></form><p class="xs g mt8">Booking as ${esc(S.me.brand?.name || S.me.email)}.</p>`;
  else if (role) act = '<p class="s g">Sign in with a brand account to book this.</p>';
  else act = `<button class="btn primary full" data-a="pub-join" data-link="${esc(l.code)}">Book ${esc(first(t.name))}</button><p class="xs g mt8">Sign in with your email and set up a free brand account. No invite needed.</p>`;
  app.innerHTML = frame(`<div class="cs-grid" style="margin-top:0"><div>
    <div class="row top-al" style="gap:20px"><div style="width:120px;flex-shrink:0;aspect-ratio:4/5;background:var(--backdrop) center/cover;${ph ? `background-image:url('${ph}')` : ''}"></div>
      <div><p class="s g">${esc(first(t.name))} has invited you to book through Embr</p><h1 class="pname mt8" style="font-size:40px">${esc(t.name)}${t.verified ? ICON.tick : ''}</h1><p class="s g mt8">${esc(rolesTxt(t))}, based in ${esc(t.city)}</p></div></div>
    ${l.note ? `<div class="callout mt24">“${esc(l.note)}”<div class="xs g mt4">${esc(first(t.name))}</div></div>` : ''}
    <h3 class="mt32 mb8">The booking</h3><dl class="kv"><dt>Job</dt><dd>${esc(l.title)}</dd>${l.role ? `<dt>Booked as</dt><dd>${esc(l.role)}</dd>` : ''}<dt>Date</dt><dd>${dLong(l.shoot_date)}${l.days > 1 ? ' for ' + l.days + ' days' : ''}</dd><dt>Day rate</dt><dd>${pounds(l.day_rate)}</dd>${l.usage ? `<dt>Usage</dt><dd>${esc(l.usage)}${l.usage_fee ? ' (' + pounds(l.usage_fee) + ')' : ' (included)'}</dd>` : ''}</dl>
    <h3 class="mt32 mb8">Why ${esc(first(t.name))} books through Embr</h3><ul class="s" style="padding-left:18px;line-height:1.9"><li><b>Everything is agreed in writing</b>: the job, usage and cancellation terms.</li><li><b>Your deposit is held by Stripe</b>, Embr's payment provider, until you sign off after the shoot.</li><li><b>${esc(first(t.name))} keeps 100%</b> of the fee. You pay a ${pct(l.fee_rate)} Embr fee.</li></ul>
  </div><aside><div class="panel"><div class="ledger"><div class="r"><span>Talent fee</span><span>${gbp(l.talent_fee_p)}</span></div><div class="r"><span>Embr fee, ${pct(l.fee_rate)}</span><span>${gbp(l.embr_fee_p)}</span></div><div class="r t"><span>Total</span><span>${gbp(l.total_p)}</span></div><div class="r sub"><span>Deposit now</span><span>${gbp(l.deposit_p)}</span></div><div class="r sub"><span>Balance at sign-off</span><span>${gbp(l.balance_p)}</span></div></div>
    <div class="mt24">${act}</div></div></aside></div>`);
};

A['pub-signin'] = () => { setVia({ ...via(), back: location.pathname }); go('/signin'); };
A['pub-join'] = (el) => {
  setVia({ as: 'brand', link: el.dataset.link || undefined, handle: el.dataset.handle || undefined, back: location.pathname });
  go(S.session ? '/' : '/signin');
};
A['pub-book'] = (el) => { go('/'); setTimeout(() => A.talent({ dataset: { id: el.dataset.id } }), 300); };
F['f-acceptlink'] = async (form, btn) => {
  const d = formData(form);
  if (!S.me.brand?.name) throw new Error('Add your brand name in Account first');
  const id = await rpc('accept_link', { p_code: form.dataset.code, p_agree: !!d.agree, p_extra: { location: d.location, call_time: d.call_time } });
  btn.textContent = 'Opening Stripe…';
  try {
    const r = await action('pay_deposit', { booking_id: id });
    location.href = r.url;
  } catch (e) {
    toast('Booked. Pay the deposit from the booking to confirm it.');
    go('/booking/' + id);
  }
};
void openLayer; void dMed;
