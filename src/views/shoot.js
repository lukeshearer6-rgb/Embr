// Shoot Thread: one place for a shoot after the brand sends its roster.
// Evidence for each choice is in docs/dev/shoot-thread.md (Mobbin, iOS, checked 2026-11-25).
//
//   brief     the shared shoot brief pinned at the top: moodboard, date, place, call time
//             (Airbnb trip card at the top of a host chat, Lex event card, Airtasker task header)
//   people    "Everyone" plus one chip per creative to switch conversations (Airbnb "In this conversation")
//   offer     each creative's offer as a card inside their chat, with the price and the terms
//             (Fiverr custom offer card, eBay "sent an offer", Airbnb "Requested" card)
//   change    a creative can ask for a change; the brand updates the offer or keeps it
//             (Vinted Accept / Decline / Offer your price, Peerspace "sent you an offer" after a request)
//   pay bar   one sticky bar when deposits are due, opening one checkout for the whole shoot
//             (Airbnb "Complete Booking" under the composer)
//   checkout  every deposit due, what's due later, when cancelling costs what, what protects the brand
//             (Peerspace checkout with cancellation row, Agoda "How much will it cost to cancel?",
//              Navan change and cancellation timeline, Artsy "Your purchase is protected",
//              Airtasker "Securely hold payment")
//
// Rules kept: only brands make or change offers. A creative can ask for a change to an offer they
// haven't answered, which the brand answers; nothing here lets talent apply, pitch or price a job
// on their own. Payments are unchanged: each deposit is still its own Stripe payment through the
// existing pay_deposit step, run one after another from the shoot checkout.
import { S, A, F, go } from '../state.js';
import { rpc, action, photoUrl } from '../api.js';
import { $, esc, gbp, pounds, pct, dMed, dLong, ago, today, toast, openLayer, closeLayer, refreshTop, topLayer, confirmDialog, formData, first, plural, busy, dRange, dRangeLong, andList } from '../ui.js';
import { ICON } from '../icons.js';
import { thumb, status } from './common.js';
import { openBooking } from './booking.js';
import { hasDay } from './shootday.js';

const people = (n) => (n === 1 ? '1 person' : `${n} people`);
const LIVE = (p) => !['declined', 'withdrawn', 'cancelled'].includes(p.status);
const due = (s) => s.people.filter((p) => p.status === 'accepted' && !p.busy);
const openChange = (p) => p.changes.find((c) => c.status === 'open' && p.status === 'offer');
const callTxt = (x) => [x.location, x.call_time ? x.call_time + ' call' : ''].filter(Boolean).join(' · ');
const DRAFT = 'Draft terms for the invite-only pilot, taken from the Embr booking agreement. They are waiting for solicitor review and may change.';

// ---------------------------------------------------------------- moodboard strip (brand and talent)
export function moodStrip(sh, { edit = false } = {}) {
  const imgs = sh.moodboard || [];
  if (!imgs.length && !sh.board_link && !edit) return '';
  return `<div class="mood" role="list" aria-label="Moodboard">${imgs.map((m, i) => `<a class="mood-i" role="listitem" href="${esc(photoUrl(m))}" target="_blank" rel="noopener" aria-label="Moodboard image ${i + 1}"><img src="${esc(photoUrl(m))}" alt="" loading="lazy"></a>`).join('')}
    ${edit ? `<button type="button" class="mood-add" data-a="shoot-edit" data-id="${sh.id}" aria-label="Edit the moodboard">${ICON.plus}</button>` : ''}</div>
    ${sh.board_link ? `<a class="link s mt8 mood-link" href="${esc(sh.board_link)}" target="_blank" rel="noopener">Open the full moodboard</a>` : ''}`;
}

function briefCard(s) {
  const live = s.people.filter(LIVE).length;
  return `<details class="sbrief" ${s.people.some((p) => p.messages.length) ? '' : 'open'}>
    <summary><span class="grow"><span class="sb-k">Shoot brief</span><span class="s g">Sent to ${people(live || s.people.length)} · ${dMed(s.shoot_date)}</span></span><span class="sb-chev" aria-hidden="true">›</span></summary>
    ${moodStrip(s, { edit: true })}
    <dl class="kv mt12"><dt>When</dt><dd>${dRangeLong(s.shoot_date, s.days)}</dd>
      <dt>Where</dt><dd>${esc(s.location) || '<span class="g">To confirm in messages</span>'}</dd>
      <dt>Call time</dt><dd>${esc(s.call_time) || '<span class="g">To confirm in messages</span>'}</dd>
      ${s.usage ? `<dt>Usage</dt><dd>${esc(s.usage)}</dd>` : ''}
      ${s.content_agreed ? `<dt>Asked to do</dt><dd>${esc(s.content_agreed)}</dd>` : ''}</dl>
    ${s.brief ? `<p class="s mt12 sb-txt">${esc(s.brief)}</p>` : ''}
    <button type="button" class="btn sm mt12" data-a="shoot-edit" data-id="${s.id}">Edit moodboard and notes</button>
  </details>`;
}

// ---------------------------------------------------------------- the offer card in the chat
function offerCard(p, s, { compact = false } = {}) {
  const [stl, stc] = status(p, 'brand');
  const days = p.days > 1 ? `${p.days} days` : p.notes && /Half day/.test(p.notes) ? 'half day' : '1 day';
  return `<article class="ocard${compact ? ' compact' : ''}" aria-label="Offer to ${esc(p.talent.name)}">
    <header class="oc-hd"><span class="oc-k">Your offer</span><span class="st ${stc}">${esc(stl)}</span></header>
    <div class="oc-who">${thumb(p.talent)}<div class="grow"><div class="oc-nm">${esc(p.talent.name)}</div><div class="s g">${esc(p.roles?.length ? andList(p.roles) : p.role || p.talent.category)} · ${dRange(p.shoot_date, p.days)}, ${days} at ${pounds(p.day_rate)}</div></div></div>
    ${compact ? `<div class="oc-sum"><span class="s g">Total with Embr fee</span><b class="money">${gbp(p.total_p)}</b></div>
      <button type="button" class="btn sm oc-open" data-a="shoot-who" data-id="${s.id}" data-who="${p.id}">Open chat${p.unread ? ' · new' : ''}${openChange(p) ? ' · change asked' : ''}</button>`
    : `<div class="ledger mt12">
        <div class="r"><span>Fee to ${esc(first(p.talent.name))}<span class="when">Paid in full, no commission taken</span></span><span>${gbp(p.talent_fee_p)}</span></div>
        <div class="r"><span>Embr fee, ${pct(p.fee_rate)}<span class="when">${esc(p.fee_label)}</span></span><span>${gbp(p.embr_fee_p)}</span></div>
        <div class="r t"><span>Total</span><span>${gbp(p.total_p)}</span></div>
        <div class="r sub"><span>Deposit, 50%${p.deposit_paid_at ? ' · paid' : ', when they accept'}</span><span>${gbp(p.deposit_p)}</span></div></div>
      <p class="xs g mt8">Binding once ${esc(first(p.talent.name))} accepts: it carries the Embr booking agreement you agreed to when you sent it${p.brand_agreed_at && p.changes.some((c) => c.status === 'accepted' && c.day_rate) ? ', updated ' + dMed(p.brand_agreed_at) : ''}.</p>
      <div class="oc-acts"><button type="button" class="btn sm" data-a="agreement" data-id="${p.id}">Read the agreement</button>
        <button type="button" class="btn sm quiet" data-a="booking" data-id="${p.id}">Booking details</button>
        ${['offer', 'accepted'].includes(p.status) ? `<button type="button" class="btn sm quiet" data-a="shoot-withdraw" data-id="${p.id}" data-shoot="${s.id}">Withdraw</button>` : ''}</div>`}
  </article>`;
}

function changeCard(c, p, s, viewer = 'brand') {
  const nm = esc(first(p.talent?.name || ''));
  const what = c.day_rate ? `<div class="chg-rate"><b class="money">${pounds(c.day_rate)} a day</b> <s class="g">${pounds(c.was_day_rate)}</s></div>` : '';
  const open = c.status === 'open' && p.status === 'offer';
  const done = c.status === 'accepted' ? (c.day_rate ? `Offer updated to ${pounds(c.day_rate)} a day` : 'Agreed') : c.status === 'declined' ? 'Original offer kept' : 'Closed: the offer was answered';
  return `<article class="chcard${open ? ' open' : ''}" aria-label="Change asked for">
    <div class="xs g">${viewer === 'brand' ? `${nm} asked for a change` : 'You asked for a change'} · ${ago(c.at)}</div>
    ${what}${c.note ? `<p class="s chg-note">“${esc(c.note)}”</p>` : ''}
    ${open && viewer === 'brand' ? `<div class="chg-acts"><button type="button" class="btn sm quiet" data-a="change-answer" data-id="${c.id}" data-yes="0" data-shoot="${s.id}">Keep my offer</button>
        <button type="button" class="btn sm ink" data-a="change-answer" data-id="${c.id}" data-yes="1" data-shoot="${s.id}" data-booking="${p.id}" data-rate="${c.day_rate || ''}">${c.day_rate ? `Update to ${pounds(c.day_rate)}` : 'Agree'}</button></div>
      <p class="xs g mt8">Only you can change the offer. ${nm} then accepts or declines it as usual.</p>`
      : `<div class="s chg-done">${open ? 'Waiting for the brand to answer. You can still accept or decline the offer as it is.' : done}</div>`}
  </article>`;
}

const bubble = (m, p) => `<div class="bubble ${m.mine ? 'me' : 'them'}">${m.from === 'embr' && !m.mine ? '<b>Embr</b><br>' : ''}${esc(m.body)}<div class="w">${m.mine ? 'You' : m.from === 'talent' ? esc(first(p.talent.name)) : m.from === 'brand' ? 'Brand' : 'Embr'} · ${ago(m.at)}</div></div>`;

function personThread(p, s) {
  const items = [{ at: p.created_at, html: offerCard(p, s) }, ...p.changes.map((c) => ({ at: c.at, html: changeCard(c, p, s) })),
    ...p.messages.map((m) => ({ at: m.at, html: bubble(m, p) }))].sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const end = !LIVE(p) ? `<div class="callout mt12">${esc(status(p, 'brand')[0])}${p.cancel_reason ? ': ' + esc(p.cancel_reason) : '.'}</div>` : '';
  return `<div class="sthread" id="sthread">${items.map((i) => i.html).join('')}${end}</div>`;
}

function everyone(s) {
  const lv = s.people.filter(LIVE);
  return `<p class="s g mb12">${lv.length ? `A message here goes to all ${people(lv.length)} on this shoot, into each person's own chat. Nobody sees anyone else's offer.` : 'No one is booked on this shoot right now.'}</p>
    <div class="sall">${s.people.map((p) => offerCard(p, s, { compact: true })).join('')}</div>`;
}

// ---------------------------------------------------------------- the screen
function chip(p, s, who) {
  const flag = p.status === 'accepted' || openChange(p) || p.unread;
  return `<button type="button" class="pchip" data-a="shoot-who" data-id="${s.id}" data-who="${p.id}" aria-pressed="${who === p.id}">
    <span class="pc-av">${thumb(p.talent)}${flag ? '<span class="flag" aria-label="needs you"></span>' : ''}</span><span class="pc-nm">${esc(first(p.talent.name))}</span></button>`;
}

function shootLayer(s, who) {
  const p = who !== 'all' && s.people.find((x) => x.id === who);
  if (!p) who = 'all';
  const d = due(s);
  const dueP = d.reduce((n, x) => n + x.deposit_p, 0);
  const canMsg = who === 'all' ? s.people.some(LIVE) : p && !['declined', 'withdrawn'].includes(p.status);
  return {
    kind: 'sheet', cls: 'shootthread', shoot: s.id, who, label: s.title,
    head: `<div class="grow st-hd"><b class="st-ttl">${esc(s.title)}</b><span class="xs g">${dRange(s.shoot_date, s.days)}${callTxt(s) ? ' · ' + esc(callTxt(s)) : ''}</span></div>`,
    body: `${hasDay(s) ? `<button type="button" class="sdlink" data-a="shootday" data-id="${s.id}"><span class="grow"><b>Shoot day</b><span class="xs g">Call times, directions, group chat and sign-off</span></span><span aria-hidden="true">›</span></button>` : ''}
      ${briefCard(s)}
      <nav class="speople" aria-label="Who you're talking to">
        <button type="button" class="pchip all" data-a="shoot-who" data-id="${s.id}" data-who="all" aria-pressed="${who === 'all'}"><span class="pc-av pc-stack">${s.people.slice(0, 3).map((x) => thumb(x.talent)).join('')}</span><span class="pc-nm">Everyone</span></button>
        ${s.people.map((x) => chip(x, s, who)).join('')}</nav>
      ${who === 'all' ? everyone(s) : personThread(p, s)}`,
    foot: `${d.length ? `<button type="button" class="paybar" data-a="shoot-pay" data-id="${s.id}"><span class="grow"><b>Pay ${d.length === 1 ? 'the deposit' : plural(d.length, 'deposit')}</b><span>${d.map((x) => esc(first(x.talent.name))).join(', ')} accepted</span></span><b class="money">${gbp(dueP)}</b><span aria-hidden="true">›</span></button>` : ''}
      ${canMsg ? `<form id="f-shootmsg" class="scompose" data-id="${s.id}" data-who="${who}"><input class="in" name="body" required maxlength="4000" autocomplete="off" aria-label="Message" placeholder="${who === 'all' ? 'Message everyone' : 'Message ' + esc(first(p.talent.name))}"><button class="btn ink" type="submit">Send</button></form>` : ''}`,
    after: (root) => { const th = root.querySelector('.shootthread .bd'); if (th && who !== 'all') th.scrollTop = th.scrollHeight; },
  };
}

export async function openShoot(id, who = 'all') {
  const s = await rpc('shoot_detail', { p_id: id });
  const layer = shootLayer(s, who);
  if (topLayer()?.shoot === id) refreshTop(layer); else openLayer(layer);
  if (layer.who !== 'all') rpc('booking_detail', { p_id: layer.who }).catch(() => {}); // marks their messages read
  return s;
}
A.shoot = (el) => openShoot(el.dataset.id, el.dataset.who || 'all');
A['shoot-who'] = (el) => openShoot(el.dataset.id, el.dataset.who);

F['f-shootmsg'] = async (form) => {
  const { id, who } = form.dataset;
  const body = formData(form).body;
  if (who === 'all') {
    const n = await rpc('shoot_message_all', { p_id: id, p_body: body });
    toast(`Sent to ${people(n)}, each in their own chat`);
  } else await rpc('send_message', { p_id: who, p_body: body });
  await openShoot(id, who);
};

A['shoot-withdraw'] = async (el) => {
  const ok = await confirmDialog({ title: 'Withdraw this offer?', body: 'They\'ll be told. Nothing has been paid for this person.', yes: 'Withdraw', danger: true });
  if (!ok) return;
  await rpc('withdraw_offer', { p_id: el.dataset.id });
  await openShoot(el.dataset.shoot, el.dataset.id);
};

// the brand answers a change: updating re-prices the offer with the same fee rules and a new agreement
A['change-answer'] = async (el) => {
  const { id, yes, shoot, booking, rate } = el.dataset;
  if (yes === '1' && rate) {
    const b = await rpc('booking_detail', { p_id: booking });
    const q = await rpc('quote', { p_talent: b.talent.id, p_day_rate: +rate, p_days: b.days, p_usage_fee: b.usage_fee || 0 });
    const ok = await confirmDialog({ title: `Update the offer to ${pounds(+rate)} a day?`,
      body: `${esc(first(b.talent.name))} would get ${gbp(q.talent_fee_p)}. Your total becomes ${gbp(q.total_p)} (was ${gbp(b.total_p)}), with a ${gbp(q.deposit_p)} deposit when they accept. The booking agreement is updated to match and you accept the new version. ${esc(first(b.talent.name))} still has to accept.`,
      yes: 'Update offer' });
    if (!ok) return;
  }
  await rpc('answer_change', { p_change: id, p_accept: yes === '1' });
  toast(yes === '1' ? 'Offer updated. They\'ve been told.' : 'Original offer kept. They\'ve been told.');
  await openShoot(shoot, booking || topLayer()?.who || 'all');
};

// moodboard and notes: a short sheet (DESIGN_RULES 3.1). The agreed date, place and call time aren't here:
// they're part of each booking agreement, so changes to those go in messages.
A['shoot-edit'] = async (el) => {
  const s = await rpc('shoot_detail', { p_id: el.dataset.id });
  const { moodEditor } = await import('./roster.js');
  openLayer({ kind: 'dialog', cls: 'fsheet', head: '<h2 class="t-24">Moodboard and notes</h2>',
    body: `<form id="f-shootedit" data-id="${s.id}">${moodEditor(s.moodboard, 'shoot-mood')}
      <label class="field mt16">Moodboard link <span class="hint">Pinterest, Drive or similar, optional</span><input class="in" name="board_link" type="url" placeholder="https://" value="${esc(s.board_link)}"></label>
      <label class="field mt16">Notes for everyone<textarea class="in" name="brief" rows="4">${esc(s.brief)}</textarea></label>
      <p class="xs g mt12">The date, place and call time are part of each booking agreement. To change one, message everyone.</p></form>`,
    foot: `<button class="btn quiet" data-a="close">Cancel</button><button class="btn ink" type="submit" form="f-shootedit">Save</button>` });
};
F['f-shootedit'] = async (form) => {
  const d = formData(form);
  const mood = [...form.querySelectorAll('[data-mood]')].map((x) => x.dataset.mood);
  await rpc('update_shoot', { p_id: form.dataset.id, p: { brief: d.brief, board_link: d.board_link, moodboard: mood } });
  closeLayer();
  toast('Brief updated. Everyone on the shoot sees the new version.');
  await openShoot(form.dataset.id, topLayer()?.who || 'all');
};

// ---------------------------------------------------------------- one checkout for the shoot
// Built on the existing per-booking deposit: each deposit is still its own Stripe Checkout, run one
// after another from here. A single combined payment needs new payment work (docs/dev/shoot-thread.md).
const PAYKEY = 'embr.shootpay';
function checkoutLayer(s, round = 0) {
  const d = due(s);
  const waiting = s.people.filter((p) => p.status === 'offer');
  const paid = s.people.filter((p) => ['confirmed', 'wrapped', 'completed'].includes(p.status));
  const dueP = d.reduce((n, p) => n + p.deposit_p, 0);
  const later = d.reduce((n, p) => n + p.balance_p, 0);
  const freeUntil = (d[0] || paid[0] || s.people[0])?.free_cancel_until;
  const row = (p, right, sub) => `<div class="ck-row">${thumb(p.talent)}<div class="grow"><div class="oc-nm">${esc(p.talent.name)}</div><div class="xs g">${esc(p.role || '')}${sub ? ' · ' + sub : ''}</div></div>${right}</div>`;
  return {
    kind: 'sheet', cls: 'scheck', checkout: s.id, label: 'Pay for ' + s.title,
    head: `<div class="grow st-hd"><b class="st-ttl">Pay for ${esc(s.title)}</b><span class="xs g">${dRange(s.shoot_date, s.days)}${s.location ? ' · ' + esc(s.location) : ''}</span></div>`,
    body: `${round ? `<div class="callout ok-c mb16">${plural(round, 'deposit')} paid. ${d.length ? `${plural(d.length, 'more')} to go.` : 'All done.'}</div>` : ''}
      <h3 class="rsec" style="margin-top:0">Due now</h3>
      ${d.length ? d.map((p) => row(p, `<b class="money">${gbp(p.deposit_p)}</b>`, '50% deposit')).join('') : '<p class="s g">Nothing is due right now.</p>'}
      ${paid.length ? `<h3 class="rsec">Paid</h3>${paid.map((p) => row(p, '<span class="st ok">Deposit paid</span>', '')).join('')}` : ''}
      ${waiting.length ? `<h3 class="rsec">Waiting to accept</h3>${waiting.map((p) => row(p, `<span class="s g">${gbp(p.deposit_p)}</span>`, 'pay only if they accept')).join('')}` : ''}
      ${d.length ? `<div class="panel tint mt24"><div class="ledger">
        <div class="r t" style="border:0;margin:0;padding-top:0"><span>Total due now</span><span>${gbp(dueP)}</span></div>
        <div class="r sub"><span>Balances at sign-off<span class="when">Charged to the same card after each person's shoot is signed off</span></span><span>${gbp(later)}</span></div></div></div>` : ''}

      <h3 class="rsec">If plans change</h3>
      <ol class="cxl" aria-label="Cancellation timeline">
        <li class="ok"><b>Until ${freeUntil ? dMed(freeUntil) : `${s.free_cancel_days} days before`}</b><span class="s g">Cancel anyone for a full refund of their deposit.</span></li>
        <li class="mid"><b>From then until the shoot</b><span class="s g">The creative is paid ${Math.round(s.late_cancel_share * 100)}% of their session fee from the deposit and the rest is refunded${d.length ? `: ${d.map((p) => `${esc(first(p.talent.name))} ${gbp(p.late_cancel_p)}`).join(', ')}` : ''}.</span></li>
        <li class="end"><b>${dMed(s.shoot_date)}</b><span class="s g">Shoot day.</span></li></ol>
      <p class="s g mt8">If a creative cancels, your deposit for them is refunded in full.</p>

      <h3 class="rsec">What protects you</h3>
      <ul class="prot">
        <li><b>Held, not paid out.</b> <span class="g">Stripe holds each deposit until that booking is signed off.</span></li>
        <li><b>Sign off when it's done.</b> <span class="g">After the shoot you have ${s.auto_signoff_hours} hours to sign off or report a problem. If you report one, nothing is paid out until Embr has heard from both sides.</span></li>
        <li><b>One agreement per person.</b> <span class="g">Each creative accepted the same Embr booking agreement you agreed to. <button type="button" class="link" data-a="agreement" data-id="${(d[0] || paid[0] || s.people[0]).id}">Read it</button></span></li></ul>
      <p class="xs draftnote mt16">${DRAFT}</p>
      ${d.length > 1 ? `<p class="xs g mt12">Each deposit is its own card payment for now, so Stripe opens ${d.length} times in a row. Your card is saved after the first.</p>` : ''}`,
    foot: d.length ? `<div class="grow rfoot"><b class="money">${gbp(dueP)}</b><span class="xs g">${plural(d.length, 'deposit')} · balances at sign-off</span></div>
      <button class="btn primary" data-a="shoot-pay-go" data-id="${s.id}" data-booking="${d[0].id}">${d.length > 1 ? `Pay ${esc(first(d[0].talent.name))}'s deposit first` : `Pay ${gbp(dueP)}`}</button>`
      : `<span class="grow"></span><button class="btn ink" data-a="shoot" data-id="${s.id}">Back to the shoot</button>`,
  };
}
export async function openCheckout(id, round = 0) {
  const s = await rpc('shoot_detail', { p_id: id });
  const layer = checkoutLayer(s, round);
  if (topLayer()?.checkout === id) refreshTop(layer); else openLayer(layer);
  return s;
}
A['shoot-pay'] = (el) => openCheckout(el.dataset.id);
A['shoot-pay-go'] = async (el) => {
  busy(el, true, 'Opening Stripe…');
  try {
    const prev = (() => { try { return JSON.parse(sessionStorage.getItem(PAYKEY) || 'null'); } catch { return null; } })();
    try { sessionStorage.setItem(PAYKEY, JSON.stringify({ id: el.dataset.id, booking: el.dataset.booking, round: prev?.id === el.dataset.id ? prev.round : 0 })); } catch { /* the checkout still works, it just won't reopen after Stripe */ }
    const r = await action('pay_deposit', { booking_id: el.dataset.booking });
    location.href = r.url;
  } catch (e) { busy(el, false); throw e; }
};
// back from Stripe on a booking: if it was paid from a shoot checkout, carry on with the next deposit
export async function continueShootPay(bookingId) {
  let st = null;
  try { st = JSON.parse(sessionStorage.getItem(PAYKEY) || 'null'); } catch { /* none */ }
  if (!st?.id || st.booking !== bookingId) return false;
  const round = (st.round || 0) + 1;
  closeLayer();
  const s = await openCheckout(st.id, round);
  if (due(s).length) { try { sessionStorage.setItem(PAYKEY, JSON.stringify({ id: st.id, round })); } catch { /* fine */ } }
  else { try { sessionStorage.removeItem(PAYKEY); } catch { /* fine */ } toast('Every deposit is paid. Those bookings are confirmed.', 5000); }
  return true;
}

// ---------------------------------------------------------------- brand Bookings: shoots first
export async function shootsSection() {
  const list = await rpc('my_shoots').catch(() => []);
  if (!list.length) return '';
  return `<h2 class="sec mt32">Shoots</h2><div class="list">${list.map((s) => {
    const live = s.people.filter(LIVE);
    const tag = s.to_pay ? `<span class="st act">Pay ${plural(s.to_pay, 'deposit')}</span>` : s.changes ? `<span class="st act">${plural(s.changes, 'change')} asked</span>` : s.unread ? '<span class="st act">New message</span>' : `<span class="st wait">${live.filter((p) => p.status !== 'offer').length} of ${live.length} accepted</span>`;
    return `<button class="item" data-a="${hasDay(s) ? 'shootday' : 'shoot'}" data-id="${s.id}"><span class="pc-stack sh-faces" aria-hidden="true">${s.people.slice(0, 3).map((p) => thumb(p)).join('')}</span>
      <div class="grow"><div class="ttl">${esc(s.title)}</div><div class="meta"><span>${dRange(s.shoot_date, s.days)}</span><span>${people(s.people.length)}</span>${s.location ? `<span>${esc(s.location)}</span>` : ''}</div></div>
      <div class="amt">${tag}</div></button>`;
  }).join('')}</div>`;
}

// ---------------------------------------------------------------- the creative's side, on their booking
// The brief for their booking only, and a way to ask the brand for a change before answering.
export function talentShootSec(b, sh) {
  if (!sh?.shoot) return '';
  const s = sh.shoot;
  return `<div class="cs-sec"><h4>The shoot brief</h4>${moodStrip(s)}${s.brief ? `<p class="s mt12 sb-txt">${esc(s.brief)}</p>` : ''}</div>`;
}
export function talentChangeSec(b, sh) {
  if (!sh?.shoot) return '';
  const cards = sh.changes.map((c) => changeCard(c, b, { id: sh.shoot.id }, 'talent')).join('');
  const canAsk = b.status === 'offer' && !sh.changes.some((c) => c.status === 'open');
  return `${cards}${canAsk ? `<div class="askrow"><span class="grow s g">Something not quite right?</span><button type="button" class="btn sm" data-a="ask-change" data-id="${b.id}">Ask ${esc(b.brand.name)} for a change</button></div>` : ''}`;
}
A['ask-change'] = async (el) => {
  const b = await rpc('booking_detail', { p_id: el.dataset.id });
  openLayer({ kind: 'dialog', head: '<h2 class="t-24">Ask for a change</h2>',
    body: `<form id="f-askchange" data-id="${b.id}">
      <label class="field">Day rate <span class="hint">Leave it as it is to keep the rate</span><span class="rr-rate"><span aria-hidden="true">£</span><input class="in" type="number" name="day_rate" inputmode="numeric" min="5" step="5" value="${b.day_rate}"></span></label>
      <label class="field mt16">What would you like to change?<textarea class="in" name="note" rows="3" maxlength="1000" placeholder="For example a later call time, or a fitting before the shoot"></textarea></label>
      <p class="xs g mt12">This asks ${esc(b.brand.name)} to update their offer. Only they can change it. You then accept or decline it as usual.</p></form>`,
    foot: `<button class="btn quiet" data-a="close">Back</button><button class="btn ink" type="submit" form="f-askchange">Send request</button>` });
};
F['f-askchange'] = async (form) => {
  const d = formData(form);
  await rpc('ask_change', { p_booking: form.dataset.id, p: { day_rate: d.day_rate, note: d.note } });
  closeLayer();
  toast('Sent. You\'ll be told when they answer.');
  await openBooking(form.dataset.id, { replace: true });
};

void today; void go; void $; void S;
