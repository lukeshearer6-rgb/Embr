// Brand screens: board (to-dos and talent search), jobs/briefs with Embr's
// best-fit ranking, the offer form, shortlist and account.
import { VIEWS, A, F, C, S, go, refreshMe, rerender } from '../state.js';
import { rpc, photoUrl, roleRules, modelOptions } from '../api.js';
import { specsFields, readSpecs, specsTxt, DRESS, SUITS } from './model.js';
import { $, esc, gbp, pounds, pct, dMed, dLong, today, addDays, opts, CATS, CITIES, USAGE, TERMS, toast, openLayer, closeLayer, replaceLayer, formData, loading, plural, first, whenTxt, rolesOf, rolesTxt, rolePlural, travelTxt } from '../ui.js';
import { ICON, RICON } from '../icons.js';
import { creativeCard } from './card.js';
import { renderRosterBar } from './roster.js';
import { comp, thumb, bookingItem, groupBookings, calendar, gallery, stHTML, workByRole } from './common.js';

const V = VIEWS.brand;
// city starts as null so the brand's own city is only filled in once; '' means anywhere
const f = { category: '', city: null, date: '', max_rate: '', q: '', specs: {} };
const people = (n) => (n === 1 ? '1 person' : `${n} people`);
const query = (x) => ({ ...x, city: x.city || '' });

// ---------------------------------------------------------------- board
// Phone-first discovery: role pills switch the top-level category (Airbnb, Thumbtack),
// a row of filter pills shows what is applied (Peerspace) and opens one filter sheet
// with a live count on its button (Airbnb, Fiverr, Klook). Brand-only: talent never see it.
V.board = async () => {
  if (f.city === null) f.city = S.me.brand?.city || 'Manchester';
  const [bookings, talent] = await Promise.all([rpc('my_bookings'), rpc('search_talent', { f: query(f) })]);
  const todo = [];
  bookings.filter((b) => b.status === 'accepted').forEach((b) => todo.push([b, `${first(b.talent.name)} accepted. Pay the ${gbp(b.deposit_p)} deposit to confirm`, 'Pay deposit', 'pay', true]));
  bookings.filter((b) => b.status === 'wrapped' && b.balance_checkout_url).forEach((b) => todo.push([b, `Your bank needs you to confirm the ${gbp(b.balance_p)} balance`, 'Confirm payment', 'booking', true]));
  bookings.filter((b) => b.status === 'wrapped' && !b.balance_checkout_url).forEach((b) => todo.push([b, `${first(b.talent.name)} has wrapped. Sign off to pay the balance, or it signs off automatically ${whenTxt(b.auto_signoff_at)}`, 'Sign off', 'booking']));
  const name = S.me.brand?.name;
  return `${!name ? '<div class="callout act mb24">Add your brand name in <button class="link" data-tab="account">Account</button> before you book anyone.</div>' : ''}
  ${todo.length ? `<section class="todo" aria-label="Needs you">${todo.slice(0, 6).map(([b, txt, btn, a, primary]) => `<div class="item">${thumb(b.talent)}<div class="grow"><div class="ttl">${esc(b.title)}</div><div class="meta"><span>${esc(txt)}</span></div></div><button class="btn ${primary ? 'primary' : ''} sm" data-a="${a}" data-id="${b.id}">${btn}</button></div>`).join('')}</section>` : ''}
  <section class="band"><h1 class="display t-72">Find talent</h1>
    <label class="bsearch mt24">${ICON.search}<input type="search" name="q" value="${esc(f.q)}" placeholder="Search names, looks, skills" data-input="searchq" aria-label="Search talent" enterkeyhint="search"></label></section>
  <nav class="cats" aria-label="Talent roles">${['', ...CATS].map((c) => `<button type="button" class="cat" data-a="board-cat" data-cat="${esc(c)}" aria-pressed="${f.category === c}">${RICON[c] || ''}<span>${c ? esc(c) : 'All'}</span></button>`).join('')}</nav>
  <div class="frow" id="frow">${filterRow()}</div>
  <p class="s g fcount" id="count" aria-live="polite">${people(talent.length)}</p>
  <div id="results">${results(talent)}</div>`;
};

// what's applied, as pills; each opens the filter sheet at its own section
const isToday = (d) => d === today();
const isTomorrow = (d) => d === addDays(1);
const dateTxt = (d) => (!d ? 'Any date' : isToday(d) ? 'Today' : isTomorrow(d) ? 'Tomorrow' : dMed(d));
const rateTxt = (r) => (r ? `Up to ${pounds(+r)}` : 'Any day rate');
function activeCount(x) {
  const sp = x.category === 'Model' ? x.specs || {} : {};
  return [x.date, x.city, x.max_rate, sp.sizing, sp.height_min, sp.height_max, sp.dress?.length, sp.suit?.length].filter(Boolean).length;
}
function filterRow() {
  const n = activeCount(f);
  const pill = (sec, label, on) => `<button type="button" class="fpill" data-a="board-filters" data-sec="${sec}" aria-pressed="${!!on}">${esc(label)}${RICON.down}</button>`;
  return `<button type="button" class="fpill fbtn" data-a="board-filters" aria-label="Filters${n ? `, ${n} on` : ''}">${RICON.filter}<span>Filters</span>${n ? `<b class="fbadge">${n}</b>` : ''}</button>
    ${pill('when', dateTxt(f.date), f.date)}${pill('where', f.city || 'Anywhere', f.city)}${pill('rate', rateTxt(f.max_rate), f.max_rate)}`;
}

// the filter sheet: changes stay in a draft, the button shows how many people match, Show applies
let draft = null, cT = 0;
function sheetBody(d) {
  const chip = (field, v, label) => `<button type="button" class="chip" data-a="fset" data-k="${field}" data-v="${esc(v)}" aria-pressed="${(d[field] || '') === v}">${esc(label)}</button>`;
  const picked = d.date && !isToday(d.date) && !isTomorrow(d.date);
  const sp = d.specs || {};
  const model = d.category !== 'Model' ? '' : `<section class="fsec" data-sec="model"><h3>Model details</h3>
    <div class="fgrid2"><label class="field">Sizes<select class="in" name="m_sizing" data-change="fdraft"><option value="">Any sizes</option><option value="womenswear" ${sp.sizing === 'womenswear' ? 'selected' : ''}>Womenswear</option><option value="menswear" ${sp.sizing === 'menswear' ? 'selected' : ''}>Menswear</option></select></label>
    ${sp.sizing === 'womenswear' ? `<label class="field">Dress size<select class="in" name="m_size" data-change="fdraft"><option value="">Any</option>${DRESS.map((x) => `<option ${String(sp.dress?.[0]) === String(x) ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`
      : sp.sizing === 'menswear' ? `<label class="field">Suit size<select class="in" name="m_size" data-change="fdraft"><option value="">Any</option>${SUITS.map((x) => `<option ${sp.suit?.[0] === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>` : '<span></span>'}
    <label class="field">Height from (cm)<input class="in" type="number" inputmode="numeric" name="m_hmin" value="${sp.height_min ?? ''}" placeholder="Any" min="120" max="220" data-change="fdraft"></label>
    <label class="field">Height to (cm)<input class="in" type="number" inputmode="numeric" name="m_hmax" value="${sp.height_max ?? ''}" placeholder="Any" min="120" max="220" data-change="fdraft"></label></div></section>`;
  return `<form id="f-filters">
    <section class="fsec" data-sec="when"><h3>Availability</h3><p class="s g">Only people free on the day of your shoot.</p>
      <div class="chips mt12">${chip('date', '', 'Any date')}${chip('date', today(), 'Today')}${chip('date', addDays(1), 'Tomorrow')}<button type="button" class="chip" data-a="fpick" aria-pressed="${!!picked}">${picked ? esc(dMed(d.date)) : 'Pick a date'}</button></div>
      <input class="in mt12" type="date" name="date" value="${picked ? d.date : ''}" min="${today()}" data-change="fdraft" aria-label="Shoot date" ${picked ? '' : 'hidden'}></section>
    <section class="fsec" data-sec="where"><h3>Location</h3><p class="s g">Based there, or happy to travel there.</p>
      <div class="chips mt12">${chip('city', '', 'Anywhere')}${CITIES.map((c) => chip('city', c, c)).join('')}</div></section>
    <section class="fsec" data-sec="rate"><h3>Day rate</h3><p class="s g">The most you want to pay for a full day.</p>
      <label class="money-in mt12"><span>£</span><input class="in" type="number" inputmode="numeric" name="max_rate" value="${esc(d.max_rate)}" placeholder="Any" min="0" step="10" data-input="fdraft" aria-label="Maximum day rate in pounds"></label></section>
    ${model}</form>`;
}
async function recount() {
  const btn = $('[data-a=fapply]');
  if (!btn) return;
  const n = (await rpc('search_talent', { f: query(draft) })).length;
  if (document.contains(btn)) btn.textContent = n ? `Show ${people(n)}` : 'No one matches';
}
const recountSoon = () => { clearTimeout(cT); cT = setTimeout(recount, 200); };
function redrawSheet() {
  const bd = $('#f-filters');
  if (!bd) return;
  const y = bd.closest('.dialog')?.scrollTop;
  bd.outerHTML = sheetBody(draft);
  const dlg = $('.dialog.fsheet');
  if (dlg && y != null) dlg.scrollTop = y;
  recountSoon();
}
A['board-filters'] = (el) => {
  draft = structuredClone(f);
  openLayer({
    kind: 'dialog',
    cls: 'fsheet',
    head: '<h2 class="t-24">Filters</h2>',
    body: sheetBody(draft),
    foot: '<button type="button" class="btn quiet" data-a="fclear">Clear all</button><span class="grow"></span><button type="button" class="btn ink" data-a="fapply">Show results</button>',
    after: (root) => {
      const sec = el.dataset.sec && root.querySelector(`.fsec[data-sec="${el.dataset.sec}"]`);
      if (sec) sec.scrollIntoView({ block: 'start' });
      recount();
    },
  });
};
A.fset = (el) => { draft[el.dataset.k] = el.dataset.v; redrawSheet(); };
A.fpick = () => { const i = $('#f-filters [name=date]'); i.hidden = false; i.focus(); try { i.showPicker?.(); } catch { /* not supported */ } };
C.fdraft = (el) => {
  const d = formData($('#f-filters'));
  if (el.name === 'date' && d.date) draft.date = d.date;
  draft.max_rate = d.max_rate || '';
  if (draft.category === 'Model') {
    const sizing = d.m_sizing || '';
    const sizeV = sizing === (draft.specs?.sizing || '') ? d.m_size || '' : '';
    draft.specs = { sizing, height_min: d.m_hmin ? +d.m_hmin : '', height_max: d.m_hmax ? +d.m_hmax : '',
      dress: sizing === 'womenswear' && sizeV ? [+sizeV] : [], suit: sizing === 'menswear' && sizeV ? [sizeV] : [] };
  }
  // a new date or size type changes the chips and fields, so draw the sheet again
  if (el.name === 'date' || el.name === 'm_sizing') return redrawSheet();
  recountSoon();
};
A.fclear = () => { draft = { ...draft, date: '', city: '', max_rate: '', specs: {} }; redrawSheet(); };
A.fapply = async () => { Object.assign(f, draft, { q: f.q }); closeLayer(); await runSearch(); };

A['board-cat'] = async (el) => {
  if (f.category === el.dataset.cat) return;
  f.category = el.dataset.cat;
  f.specs = {};
  document.querySelectorAll('[data-a=board-cat]').forEach((b) => b.setAttribute('aria-pressed', b === el));
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  await runSearch();
};

// talent cards for the board: the shared CreativeCard (src/views/card.js)
const feedCard = (t) => creativeCard(t);
function results(list) {
  if (!list.length) return `<div class="empty">No one matches yet. Try another date, city or rate. Embr is invite-only during the pilot, so the board is still filling up.${activeCount(f) ? '<div class="mt16"><button class="btn" data-a="board-reset">Clear filters</button></div>' : ''}</div>`;
  const here = list.filter((t) => !t.away), away = list.filter((t) => t.away);
  return (here.length ? `<div class="feed">${here.map(feedCard).join('')}</div>` : '') +
    (away.length ? `<h2 class="sec mt48">Will travel to ${esc(f.city)}</h2><p class="s g mb24">Based elsewhere. Check each profile for how travel costs work.</p><div class="feed">${away.map(feedCard).join('')}</div>` : '');
}
// from the Shoot Roster's "Need a make-up artist?": the board on that role, free on the shoot date
A['board-find'] = async ({ role = '', date = '' }) => {
  Object.assign(f, { category: role, date: date && date >= today() ? date : '', specs: {} });
  if (S.tab !== 'board' || !$('#results')) return go('/board');
  document.querySelectorAll('[data-a=board-cat]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.cat === role));
  document.querySelector(`[data-a=board-cat][data-cat="${role}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  window.scrollTo({ top: 0 });
  await runSearch();
  renderRosterBar();
};
A['board-reset'] = async () => { Object.assign(f, { date: '', city: '', max_rate: '', specs: {} }); await runSearch(); };
async function runSearch() {
  if (!$('#results')) return;
  f.q = $('.band [name=q]')?.value || '';
  const list = await rpc('search_talent', { f: query(f) });
  $('#results').innerHTML = results(list);
  $('#count').textContent = people(list.length);
  $('#frow').innerHTML = filterRow();
}
C.search = runSearch;
let qT;
C.searchq = () => { clearTimeout(qT); qT = setTimeout(runSearch, 250); };

A.save = async (el) => {
  const on = await rpc('toggle_shortlist', { p_talent: el.dataset.id });
  document.querySelectorAll(`[data-a=save][data-id="${el.dataset.id}"]`).forEach((b) => { b.setAttribute('aria-pressed', on); b.setAttribute('aria-label', on ? 'Remove from shortlist' : 'Save to shortlist'); });
  toast(on ? 'Saved to your shortlist' : 'Removed from your shortlist');
};

// ---------------------------------------------------------------- talent profile sheet
export async function talentSheet(id, extra = {}) {
  const [t, rules] = await Promise.all([rpc('talent_detail', { p_id: id }), roleRules().catch(() => ({}))]);
  const isB = S.me?.role === 'brand';
  const st = S.me.settings;
  const rate = t.booked_before >= st.loyal_after ? st.fee_loyal : t.booked_before >= 1 ? st.fee_repeat : st.fee_first;
  return {
    kind: 'sheet', label: t.name,
    head: `<div class="grow"><div class="s g">${esc(rolesTxt(t))}, ${esc(t.city)}</div></div>`,
    body: `${gallery(t)}<div class="mt32"><h2 class="pname">${esc(t.name)}${t.verified ? ICON.tick : ''}</h2>
      <div class="rolebadges mt12" aria-label="What they do">${rolesOf(t).map((r) => `<span>${esc(r)}</span>`).join('')}</div>
      ${t.verified ? '<p class="s g mt8">ID checked: 18+</p>' : '<p class="s g mt8">ID check not done yet. They\'ll need to pass it before they can accept.</p>'}
      <dl class="statline">${t.height ? `<div><dt>Height</dt><dd>${esc(t.height)}</dd></div>` : ''}<div><dt>Day rate</dt><dd>${t.day_rate ? pounds(t.day_rate) : '–'}</dd></div>${t.half_rate ? `<div><dt>Half day</dt><dd>${pounds(t.half_rate)}</dd></div>` : ''}<div><dt>Travel</dt><dd>${esc(travelTxt(t))}</dd></div>${t.completed ? `<div><dt>Jobs on Embr</dt><dd>${t.completed}</dd></div>` : ''}</dl></div>
      <div class="cs-grid"><div><p class="measure">${esc(t.bio) || '<span class="g">No bio yet.</span>'}</p>
        ${t.tags?.length ? `<div class="chips mt16">${t.tags.map((x) => `<span class="chip" style="cursor:default">${esc(x)}</span>`).join('')}</div>` : ''}
        ${t.comfort ? `<h3 class="mt24 mb8">Comfortable with</h3><p class="s">${esc(t.comfort)}</p>` : ''}
        ${t.instagram ? `<p class="s g mt16">Instagram / TikTok: ${esc(t.instagram)}</p>` : ''}
        ${workByRole(t, rules)}
      </div><div><h3 class="mb12">Next six weeks</h3>${calendar(t)}</div></div>`,
    foot: isB ? `<div class="grow"><div><b class="money">${t.day_rate ? pounds(t.day_rate) : ''}</b> <span class="s g">/ day + ${pct(rate)} Embr fee</span></div><div class="xs g">50% deposit when they accept · free cancellation until ${st.free_cancel_days} days before</div></div>
      <button class="btn" data-a="save" data-id="${t.id}" aria-pressed="${t.saved}">${t.saved ? 'Saved' : 'Save'}</button>
      <button class="btn primary" data-a="offer" data-id="${t.id}" ${extra.brief ? `data-brief="${extra.brief}"` : ''}>Book ${esc(first(t.name))}</button>` : '',
  };
}
A.talent = async (el) => openLayer(await talentSheet(el.dataset.id, { brief: el.dataset.brief }));

// ---------------------------------------------------------------- offer form
A.offer = async (el) => {
  if (!S.me.brand?.name) { closeLayer(); toast('Add your brand name in Account first'); return go('/account'); }
  const t = await rpc('talent_detail', { p_id: el.dataset.id });
  let brief = null;
  if (el.dataset.brief) brief = (await rpc('brief_detail', { p_id: el.dataset.brief }));
  const d = brief ? { title: brief.title, date: brief.shoot_date, days: brief.days, rate: brief.day_rate, usage: brief.usage, notes: brief.description }
    : { title: '', date: addDays(14), days: 1, rate: t.day_rate || 200, usage: '' };
  const rs = rolesOf(t);
  const asRole = rs.includes(brief?.category) ? brief.category : rs[0];
  const layer = {
    kind: 'sheet', label: 'Book ' + t.name,
    head: `<div class="grow s g">You set the terms. ${esc(first(t.name))} accepts or declines.</div>`,
    body: `<h2 class="display t-48">Book ${esc(t.name)}</h2>
    <form id="f-offer" data-t="${t.id}" data-brief="${brief?.id || ''}" class="mt24" style="max-width:720px"><div class="fgrid">
      <label class="field ${rs.length > 1 ? '' : 'span'}">What's the job?<input class="in" name="title" required value="${esc(d.title)}" placeholder="Summer drop lookbook"></label>
      ${rs.length > 1 ? `<label class="field">Booking them as<select class="in" name="role">${opts(rs, asRole)}</select></label>` : `<input type="hidden" name="role" value="${esc(asRole || '')}">`}
      <label class="field">Shoot date<input class="in" type="date" name="shoot_date" required min="${today()}" value="${d.date}" data-change="quote"></label>
      <label class="field">Days<input class="in" type="number" name="days" min="1" max="14" value="${d.days}" data-input="quote"></label>
      <label class="field">Day rate, £<input class="in" type="number" name="day_rate" min="5" step="5" required value="${d.rate}" data-input="quote">${t.day_rate ? `<span class="hint">${esc(first(t.name))}'s usual rate is ${pounds(t.day_rate)}</span>` : ''}</label>
      <label class="field">Where<input class="in" name="location" placeholder="Studio or address"></label>
      <label class="field">Call time<input class="in" name="call_time" placeholder="9am"></label>
    </div>
    <h3 class="mt32">Where you'll use the images</h3>
    <div class="fgrid mt12"><label class="field">Where<select class="in" name="usage_where">${opts(USAGE, (d.usage || '').split(',')[0] || 'Instagram and TikTok')}</select></label>
      <label class="field">For how long<select class="in" name="usage_term">${opts(TERMS, '12 months')}</select></label>
      <label class="field">Usage fee, £ <span class="hint">£0 if it's included in the day rate</span><input class="in" type="number" name="usage_fee" min="0" step="5" value="0" data-input="quote"></label></div>
    <label class="field mt16">What you'll ask them to do <span class="hint">For example: streetwear, no swimwear or lingerie. Nothing outside this can be asked on the day.</span><textarea class="in" name="content_agreed" rows="2"></textarea></label>
    <label class="field mt16">Anything else <span class="hint">Brief, what to bring, hair and make-up</span><textarea class="in" name="notes" rows="3">${esc(d.notes || '')}</textarea></label>
    <div class="panel tint mt24" id="quote">${loading()}</div>
    <label class="check mt24"><input type="checkbox" name="agree" required> <span>I accept the <button class="link" type="button" data-a="agreement-preview">Embr booking agreement</button>, including the 50% deposit when ${esc(first(t.name))} accepts and free cancellation until ${S.me.settings.free_cancel_days} days before the shoot.</span></label>
    </form>`,
    foot: `<span class="grow s g">${esc(first(t.name))} has to accept before you pay anything.</span><button class="btn primary" type="submit" form="f-offer">Send offer</button>`,
    after: () => quote(),
  };
  if (el.closest('.sheet')) replaceLayer(layer); else openLayer(layer);
};
let qSeq = 0;
async function quote() {
  const form = $('#f-offer');
  if (!form) return;
  const d = formData(form);
  const seq = ++qSeq;
  const q = await rpc('quote', { p_talent: form.dataset.t, p_day_rate: +d.day_rate || 0, p_days: +d.days || 1, p_usage_fee: +d.usage_fee || 0 }).catch(() => null);
  if (!q || seq !== qSeq || !$('#quote')) return;
  $('#quote').innerHTML = `<div class="ledger">
    <div class="r"><span>Session, ${+d.days || 1} day${(+d.days || 1) > 1 ? 's' : ''}</span><span>${gbp(q.session_p)}</span></div>
    ${q.talent_fee_p > q.session_p ? `<div class="r"><span>Usage</span><span>${gbp(q.talent_fee_p - q.session_p)}</span></div>` : ''}
    <div class="r"><span>Embr fee, ${pct(q.fee_rate)} <span class="when">${esc(q.fee_label)}${q.fee_rate > S.me.settings.fee_loyal ? `. Drops to ${pct(q.fee_rate === S.me.settings.fee_first ? S.me.settings.fee_repeat : S.me.settings.fee_loyal)} next time you book them.` : ''}</span></span><span>${gbp(q.embr_fee_p)}</span></div>
    <div class="r t"><span>Total</span><span>${gbp(q.total_p)}</span></div>
    <div class="r sub"><span>Deposit when they accept</span><span>${gbp(q.deposit_p)}</span></div>
    <div class="r sub"><span>Balance at sign-off</span><span>${gbp(q.balance_p)}</span></div></div>
    <p class="xs g mt8">The talent gets ${gbp(q.talent_fee_p)} in full. Embr takes no commission from talent.</p>`;
}
C.quote = () => quote();
A['agreement-preview'] = () => openLayer({ kind: 'dialog', lg: true, head: '<h2 class="t-24">Embr booking agreement</h2>',
  body: `<p class="s g mb16">The full agreement, with your names, dates and amounts filled in, is attached to the offer and shown to both of you. It covers:</p>
  <ul class="s" style="padding-left:18px;line-height:1.9"><li>Embr provides the booking software and takes payment through Stripe. Embr is not an agency.</li><li>The talent is 18+ and ID-checked, and receives the talent fee in full.</li><li>The brand pays the Embr fee, a 50% deposit when the talent accepts, and the balance at sign-off.</li><li>Sign-off happens automatically ${S.me.settings.auto_signoff_hours} hours after the talent marks the job wrapped, unless a problem is reported.</li><li>Cancellation: full refund up to ${S.me.settings.free_cancel_days} days before. After that, the talent is paid ${pct(S.me.settings.late_cancel_share)} of the session fee.</li><li>Usage is limited to what's written in the booking. Nothing outside the agreed content can be asked on the day.</li><li>For 12 months, the brand books this talent through Embr.</li></ul>
  <p class="xs g mt16">Pilot draft, to be reviewed by a solicitor.</p>` });

F['f-offer'] = async (form) => {
  const d = formData(form);
  const usage = d.usage_where ? `${d.usage_where}, ${d.usage_term}` : '';
  const id = await rpc('create_offer', { p: {
    talent_id: form.dataset.t, brief_id: form.dataset.brief || null, title: d.title, shoot_date: d.shoot_date, days: +d.days, day_rate: +d.day_rate,
    usage, usage_fee: +d.usage_fee || 0, location: d.location, call_time: d.call_time, content_agreed: d.content_agreed, notes: d.notes, agree: !!d.agree, role: d.role || null,
  } });
  closeLayer();
  toast('Offer sent. You\'ll be told when they answer.');
  go('/booking/' + id);
};

// ---------------------------------------------------------------- jobs (briefs)
V.jobs = async () => {
  const list = await rpc('my_briefs');
  return `<div class="row between top-al wrap mb24"><h1 class="display t-48">Jobs</h1><button class="btn primary" data-a="postjob">${ICON.plus}Post a brief</button></div>
  <p class="g measure mb24">Post a brief and Embr ranks the talent who fit it best. You choose who gets an offer. Talent can't apply, so you only deal with people you pick.</p>
  ${list.length ? `<div class="list" style="border:0">${list.map((j) => `<button class="job" data-a="job" data-id="${j.id}"><div class="ttl">${esc(j.title)}${j.status === 'closed' ? '<span class="tag-f" style="color:var(--mist)">Closed</span>' : ''}</div><div class="rate">${pounds(j.day_rate)}</div>
    <div class="facts"><span><b>${esc(j.category)}</b>${j.spots > 1 ? ' × ' + j.spots : ''}</span><span>${dMed(j.shoot_date)}${j.days > 1 ? ', ' + j.days + ' days' : ''}</span><span>${esc(j.city)}</span><span>${plural(j.offers, 'offer')} sent${j.booked ? ', ' + j.booked + ' booked' : ''}</span></div></button>`).join('')}</div>`
    : '<div class="empty">No briefs yet. Posting one takes about two minutes.</div>'}`;
};
A.postjob = async () => { const mo = await modelOptions(); openLayer({
  kind: 'sheet', label: 'Post a brief', head: '<div class="grow s g">Only you and Embr see your brief. Talent never see it.</div>',
  body: `<h2 class="display t-48">Post a brief</h2><form id="f-job" class="mt24" style="max-width:720px"><div class="fgrid">
    <label class="field span">Title<input class="in" name="title" required placeholder="Summer drop lookbook, one model"></label>
    <label class="field">Looking for<select class="in" name="category" data-change="job-cat">${opts(CATS)}</select></label>
    <label class="field">City<select class="in" name="city">${opts(CITIES, S.me.brand?.city)}</select></label>
    <label class="field">Shoot date<input class="in" type="date" name="shoot_date" required min="${today()}" value="${addDays(14)}"></label>
    <label class="field">Days<input class="in" type="number" name="days" min="1" max="14" value="1"></label>
    <label class="field">Day rate, £<input class="in" type="number" name="day_rate" min="5" step="5" required value="250"></label>
    <label class="field">How many people<input class="in" type="number" name="spots" min="1" max="20" value="1"></label>
    <label class="field span">Travel<select class="in" name="travel"><option value="local">Local talent only</option><option value="covered">I'll pay travel for the right person</option></select></label>
    <label class="field span">Usage<select class="in" name="usage">${USAGE.map((u) => `<option>${u}, 12 months</option>`).join('')}</select></label>
    <label class="field span">Brief<textarea class="in" name="description" placeholder="What you're shooting, the look, what's provided"></textarea></label>
    <div class="span" id="job-specs">${CATS[0] === 'Model' ? specsFields(mo) : ''}</div></div></form>`,
  foot: '<span class="grow"></span><button class="btn primary" type="submit" form="f-job">Post and see who fits</button>',
}); };
C['job-cat'] = async (sel) => { $('#job-specs').innerHTML = sel.value === 'Model' ? specsFields(await modelOptions()) : ''; };
C['spec-sizing'] = async (sel) => {
  const form = sel.closest('form');
  const sp = { ...readSpecs(form), sizing: sel.value };
  sel.closest('[data-specs]').outerHTML = specsFields(await modelOptions(), sp);
};
F['f-job'] = async (form) => {
  const d = formData(form);
  const id = await rpc('create_brief', { p: { title: d.title, category: d.category, city: d.city, shoot_date: d.shoot_date, days: d.days, day_rate: d.day_rate,
    spots: d.spots, travel: d.travel, usage: d.usage, description: d.description, specs: d.category === 'Model' ? readSpecs(form) : {} } });
  closeLayer();
  rerender();
  A.job({ dataset: { id } });
};
// why each person is in the best-fit list, checked against the brief (Pin, Wrangle, Braintrust, Upwork candidate lists)
function fitLines(t, j) {
  const diff = (t.day_rate || 0) - j.day_rate;
  const rows = [
    [true, `Free ${dMed(j.shoot_date)}${j.days > 1 ? ' for ' + j.days + ' days' : ''}`],
    [true, t.away ? `Travels from ${t.city}` : `Based in ${j.city}`],
    t.day_rate ? [diff <= 0, diff <= 0 ? `${pounds(t.day_rate)} a day, within your rate` : `${pounds(t.day_rate)} a day, ${pounds(diff)} over yours`] : [false, 'No day rate set'],
    ...(specsTxt(j.specs) ? [[true, 'Matches your model details']] : []),
  ];
  return `<ul class="fit" aria-label="Why ${esc(t.name)} fits">${rows.map(([ok, l]) => `<li class="${ok ? 'ok' : 'no'}">${esc(l)}</li>`).join('')}</ul>`;
}
A.job = async (el) => {
  const j = await rpc('brief_detail', { p_id: el.dataset.id });
  openLayer({
    kind: 'sheet', label: j.title, head: `<div class="grow s g">Posted ${dMed(j.created_at)}</div>`,
    body: `<h2 class="display t-48">${esc(j.title)}</h2>
    <dl class="statline"><div><dt>Rate</dt><dd>${pounds(j.day_rate)} a day</dd></div><div><dt>Date</dt><dd>${dMed(j.shoot_date)}${j.days > 1 ? ', ' + j.days + ' days' : ''}</dd></div><div><dt>Where</dt><dd>${esc(j.city)}</dd></div><div><dt>Looking for</dt><dd>${esc(j.category)}${j.spots > 1 ? ', ' + j.spots : ''}</dd></div><div><dt>Travel</dt><dd>${j.travel === 'local' ? 'Local talent only' : 'Paid for the right person'}</dd></div></dl>
    ${specsTxt(j.specs) ? `<p class="mt16"><b>Model details:</b> ${esc(specsTxt(j.specs))}</p>` : ''}
    ${j.description ? `<p class="measure mt24">${esc(j.description)}</p>` : ''}${j.usage ? `<p class="s g mt8">Usage: ${esc(j.usage)}</p>` : ''}
    <h3 class="mt32 mb8">Best fit for this brief</h3><p class="s g mb16">${specsTxt(j.specs) ? 'Only models who match your details. ' : ''}Ranked by who's free on ${dMed(j.shoot_date)}, where they're based and how close their day rate is to yours. You choose who gets an offer.</p>
    ${j.ranked.length ? `<div class="comps fitgrid">${j.ranked.map((t) => `<div>${comp(t, { save: false }).replace('data-a="talent"', `data-a="talent" data-brief="${j.id}"`)}${fitLines(t, j)}${t.offered ? '<p class="xs g mt4">Offer sent</p>' : `<button class="btn sm full mt8" data-a="offer" data-id="${t.id}" data-brief="${j.id}">Send offer</button>`}</div>`).join('')}</div>`
      : '<div class="empty">No one free fits this brief yet. Try another date, or search the board.</div>'}
    ${j.bookings.length ? `<h3 class="mt32 mb8">Offers</h3><div class="list">${j.bookings.map(bookingItem).join('')}</div>` : ''}`,
    foot: j.status === 'open' ? `<button class="btn quiet" data-a="closejob" data-id="${j.id}">Close brief</button><span class="grow"></span><button class="btn" data-tab="board">Search the board instead</button>` : '<span class="s g">This brief is closed.</span>',
  });
};
A.closejob = async (el) => { await rpc('close_brief', { p_id: el.dataset.id }); closeLayer(); toast('Brief closed'); rerender(); };

// ---------------------------------------------------------------- bookings and messages
export async function bookingsView() {
  const list = await rpc('my_bookings');
  const g = groupBookings(list);
  const sec = (t, l, empty) => `<h2 class="sec mt32">${t}</h2>${l.length ? `<div class="list">${l.map(bookingItem).join('')}</div>` : `<div class="empty" style="padding:16px 0">${empty}</div>`}`;
  return `<h1 class="display t-48 mb24">Bookings</h1>${g.needs.length ? sec('Needs you', g.needs, '') : ''}${sec('Coming up', g.upcoming, S.me.role === 'talent' ? 'Nothing booked yet. Let work find you: brands book you straight from your profile.' : 'Nothing coming up. Find someone on the board.')}${g.past.length ? sec('Past', g.past, '') : ''}`;
}
V.bookings = bookingsView;
export async function inboxView() {
  const list = (await rpc('my_bookings')).filter((b) => b.last_message_at).sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));
  const r = S.me.role;
  return `<h1 class="display t-48 mb24">Messages</h1><p class="g measure mb24">Every conversation sits on its booking, so the terms and the chat stay together.${r === 'talent' ? ' Brands start a conversation when they send you an offer.' : ''}</p>
  ${list.length ? `<div class="list">${list.map((b) => { const o = r === 'talent' ? b.brand : b.talent; return `<button class="item" data-a="booking" data-id="${b.id}" data-tabto="messages">${thumb(o, r === 'talent')}<div class="grow"><div class="row between"><span class="ttl">${esc(o.name)}</span><span class="xs g">${dMed(b.last_message_at)}</span></div><div class="s ${b.unread ? '' : 'g'}" style="${b.unread ? 'font-weight:600' : ''}">${esc(b.title)}${b.unread ? ' · New message' : ''}</div></div></button>`; }).join('')}</div>` : '<div class="empty">No messages yet.</div>'}`;
}
V.inbox = inboxView;

// ---------------------------------------------------------------- shortlist
V.shortlist = async () => {
  const [saved, bookings] = await Promise.all([rpc('my_shortlist'), rpc('my_bookings')]);
  const done = {};
  bookings.filter((b) => b.status === 'completed').forEach((b) => { (done[b.talent.id] = done[b.talent.id] || { t: b.talent, n: 0, last: b }).n++; });
  const roster = Object.values(done).sort((a, b) => b.n - a.n);
  return `<h1 class="display t-48 mb24">Shortlist</h1>
  ${roster.length ? `<h2 class="sec">Booked before</h2><p class="s g mb12">Your fee drops to ${pct(S.me.settings.fee_repeat)} from the second booking with the same person and ${pct(S.me.settings.fee_loyal)} from the fifth.</p><div class="list mb48">${roster.map(({ t, n }) => `<div class="item">${thumb(t)}<div class="grow"><div class="ttl">${esc(t.name)}</div><div class="meta"><span>${plural(n, 'booking')}</span><span>Next booking: ${pct(n >= S.me.settings.loyal_after ? S.me.settings.fee_loyal : S.me.settings.fee_repeat)} fee</span></div></div><button class="btn sm" data-a="offer" data-id="${t.id}">Book again</button></div>`).join('')}</div>` : ''}
  <h2 class="sec">Saved</h2>${saved.length ? `<div class="comps photo">${saved.map((t) => comp(t, { photo: true })).join('')}</div>` : '<div class="empty">Tap the heart on anyone\'s photo to save them here.</div>'}`;
};

// ---------------------------------------------------------------- account
V.account = async () => {
  const b = S.me.brand;
  const st = S.me.settings;
  return `<h1 class="display t-48 mb24">Account</h1><div class="cols"><form id="f-brand"><div class="fgrid">
    <label class="field span">Brand or company name<input class="in" name="name" required value="${esc(b.name)}"></label>
    <label class="field">Your name<input class="in" name="contact_name" value="${esc(b.contact_name)}"></label>
    <label class="field">City<select class="in" name="city">${opts(CITIES, b.city)}</select></label>
    <label class="field">Website<input class="in" name="website" value="${esc(b.website)}" placeholder="https://"></label>
    <label class="field">Instagram<input class="in" name="instagram" value="${esc(b.instagram)}" placeholder="@brand"></label></div>
    <button class="btn ink mt24" type="submit">Save</button></form>
    <aside class="stack"><div class="panel"><h3>What you pay</h3><p class="s g mt8">Posting briefs and searching is free. When you book, you pay the talent's fee plus an Embr fee: ${pct(st.fee_first)} the first time you book someone, ${pct(st.fee_repeat)} from the second booking with the same person, ${pct(st.fee_loyal)} from the fifth. Bookings that come through a talent's booking link are ${pct(st.fee_link)}.</p></div>
    <div class="panel"><h3>Payments</h3><p class="s g mt8">You pay a 50% deposit by card when the talent accepts. Stripe saves the card so the balance can be charged at sign-off. ${b.has_card ? 'You have a card saved with Stripe.' : ''}</p></div>
    <div class="panel"><h3>Signed in as</h3><p class="s g mt8">${esc(S.me.email)}</p></div></aside></div>`;
};
F['f-brand'] = async (form) => { S.me = await rpc('save_brand', { p: formData(form) }); toast('Saved'); rerender(); };
