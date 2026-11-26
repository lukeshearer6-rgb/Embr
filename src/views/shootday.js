// Shoot Day Hub: the brand's screen for a shoot once people are confirmed.
// Evidence for each choice is in docs/dev/shoot-day-hub.md (Mobbin, iOS, checked 2026-11-25).
//
//   day band    when, call time, place and one-tap directions at the top
//               (Airbnb trip "Check-in / Checkout" block, Eventbrite ticket date and venue, Uber "Meet at your pickup spot")
//   on set      the confirmed roster as a call sheet: face, role, call time, status, tap to their chat
//               (Uber driver card with name and contact, Airbnb "Who's coming")
//   group chat  the latest shoot messages and one composer that reaches everyone
//               (Airbnb "Message your host" row, Uber "Any pickup notes?" field)
//   tracker     a vertical stepper after the shoot; the current step opens as a card with its action
//               (CVS order steps, Bolt Food timed steps, Vestiaire Collective "In progress" card, X Card stepper)
//
// Rules kept: the tracker only reads the existing flow (confirmed → wrapped by the creative → signed off,
// which pays the creative). Signing off still happens on each booking, which shows the money first.
// Deliverables and reviews have no data on Embr yet, so they show as not started (see the doc for what
// the final round would need). Directions open the phone's own maps app through a plain link, no map API.
import { A, F } from '../state.js';
import { rpc } from '../api.js';
import { esc, dMed, dLong, today, toast, openLayer, refreshTop, topLayer, belowTop, closeLayer, formData, first, ago, whenTxt, dRangeLong, andList, dRange } from '../ui.js';
import { RICON } from '../icons.js';
import { thumb, status } from './common.js';

const ON = ['confirmed', 'wrapped', 'completed'];
const PENDING = ['offer', 'accepted'];

// Apple Maps on iPhone and iPad, Google Maps everywhere else. Both open the installed app from a plain
// https link and need no key. https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/MapLinks/MapLinks.html
// https://developers.google.com/maps/documentation/urls/get-started (both checked 2026-11-25)
export function mapsUrl(place) {
  const q = encodeURIComponent(place);
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const ios = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return ios ? `https://maps.apple.com/?daddr=${q}` : `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}
export const dirBtn = (place, cls = '') => (place ? `<a class="btn dirbtn ${cls}" href="${esc(mapsUrl(place))}" target="_blank" rel="noopener" data-maps>${RICON.pin}<span>Directions</span></a>` : '');

export const hasDay = (s) => (s.people || []).some((p) => ON.includes(p.status));

function whenLabel(d) {
  const t = today();
  if (d === t) return 'Today';
  const n = Math.round((new Date(d) - new Date(t)) / 864e5);
  if (n === 1) return 'Tomorrow';
  if (n > 1) return `In ${n} days`;
  return 'Shoot done';
}

// the latest messages across the shoot. A message to everyone is copied into each person's chat,
// so copies with the same text sent within a minute show once.
function latest(s, n = 3) {
  const all = s.people.flatMap((p) => p.messages.map((m) => ({ ...m, who: m.mine ? 'You' : m.from === 'talent' ? first(p.talent.name) : 'Embr', pid: p.id })));
  const seen = new Set();
  const out = [];
  for (const m of all.sort((a, b) => String(b.at).localeCompare(String(a.at)))) {
    const k = m.mine ? m.body + '|' + String(m.at).slice(0, 16) : m.id;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ ...m, all: m.mine && all.filter((x) => x.mine && x.body === m.body && String(x.at).slice(0, 16) === String(m.at).slice(0, 16)).length > 1 });
    if (out.length === n) break;
  }
  return out.reverse();
}

// once confirmed, a Call button sits beside each person (Uber Eats, Hyatt and Expedia put Call on the confirmed
// booking); the number comes from the database only from the deposit until 14 days after the shoot
function rosterRow(p, s) {
  const [stl, stc] = status(p, 'brand');
  const call = p.call_time || s.call_time;
  const tel = p.phone ? `<a class="sd-tel" href="tel:${esc(p.phone)}" aria-label="Call ${esc(p.talent.name)} on ${esc(p.phone)}">${RICON.phone}</a>` : '';
  return `<div class="sd-line"><button type="button" class="sd-row" data-a="shoot-who" data-id="${s.id}" data-who="${p.id}">
    ${thumb(p.talent)}<span class="grow"><span class="sd-nm">${esc(p.talent.name)}${p.unread ? '<span class="flag" aria-label="new message"></span>' : ''}</span><span class="xs g">${esc(p.roles?.length ? andList(p.roles) : p.role || p.talent.category)}${p.days > 1 || p.shoot_date !== s.shoot_date ? ' · ' + esc(dRange(p.shoot_date, p.days)) : ''}</span></span>
    <span class="sd-r"><b class="sd-call">${call ? esc(call) : '<span class="g">Call time to confirm</span>'}</b><span class="st ${stc} xs">${esc(stl)}</span></span></button>${tel}</div>`;
}

// the post-shoot tracker. Every live step is read from the existing booking statuses.
function tracker(s) {
  const on = s.people.filter((p) => ON.includes(p.status));
  const wrapped = on.filter((p) => ['wrapped', 'completed'].includes(p.status));
  const signed = on.filter((p) => p.status === 'completed');
  const toSign = on.filter((p) => p.status === 'wrapped');
  const dayDone = s.shoot_date < today() || wrapped.length > 0;
  const steps = [
    { k: 'day', l: 'Shoot day', done: dayDone, sub: dMed(s.shoot_date) },
    { k: 'wrap', l: 'Wrapped', done: on.length > 0 && wrapped.length === on.length, sub: `${wrapped.length} of ${on.length} marked wrapped by the creative` },
    { k: 'sign', l: 'Signed off and paid', done: on.length > 0 && signed.length === on.length, sub: `${signed.length} of ${on.length} signed off. Each creative is paid in full when you sign off.` },
    { k: 'files', l: 'Deliverables', soon: true },
    { k: 'review', l: 'Review', soon: true },
  ];
  // anyone waiting for sign-off makes that the step that needs the brand, even if others haven't wrapped
  const now = toSign.length ? 2 : steps.findIndex((x) => !x.done && !x.soon);
  const card = (x) => {
    if (x.k === 'sign' && toSign.length) {
      return `<div class="sd-now">${toSign.map((p) => `<div class="sd-sign">${thumb(p.talent)}<span class="grow"><b>${esc(first(p.talent.name))} has wrapped</b><span class="xs g">${p.auto_signoff_at ? 'Signs off automatically ' + esc(whenTxt(p.auto_signoff_at)) : 'Waiting for you'}</span></span>
        <button type="button" class="btn sm ink" data-a="booking" data-id="${p.id}">Sign off</button></div>`).join('')}
        <p class="xs g">Signing off opens the booking, with the balance shown before you pay. Something wrong? Report a problem there instead.</p></div>`;
    }
    if (x.k === 'wrap' && dayDone) return `<div class="sd-now"><p class="s g">Each creative marks the booking wrapped after the shoot. Then you sign off.</p></div>`;
    return '';
  };
  return `<ol class="sd-track" aria-label="After the shoot">${steps.map((x, i) => `<li class="${x.done ? 'done' : i === now ? (x.k === 'sign' ? 'now act' : 'now') : x.soon ? 'soon' : ''}">
      <span class="sd-dot" aria-hidden="true"></span><div class="grow"><div class="sd-l"><b>${x.l}</b>${x.done ? '<span class="st ok xs">Done</span>' : i === now ? `<span class="st ${x.k === 'sign' ? 'act' : 'wait'} xs">${x.k === 'sign' ? 'Needs you' : 'Next'}</span>` : x.soon ? '<span class="xs m">Not on Embr yet</span>' : ''}</div>
      ${x.sub ? `<div class="xs g">${x.sub}</div>` : ''}${i === now ? card(x) : ''}</div></li>`).join('')}</ol>
    <p class="xs g mt8">Embr doesn't track deliverables or reviews yet. Agree what's delivered in messages for now.</p>`;
}

function hubLayer(s) {
  const on = s.people.filter((p) => ON.includes(p.status));
  const pend = s.people.filter((p) => PENDING.includes(p.status));
  const msgs = latest(s);
  const calls = [...new Set(on.map((p) => p.call_time || s.call_time).filter(Boolean))];
  const call = calls.length === 1 ? calls[0] : calls.length ? 'See below' : s.call_time;
  return {
    kind: 'sheet', cls: 'shootday', shootday: s.id, label: s.title + ' shoot day',
    head: `<div class="grow st-hd"><b class="st-ttl">${esc(s.title)}</b><span class="xs g">Shoot day</span></div>`,
    body: `<section class="sd-band" aria-label="When and where">
        <div class="sd-when"><span class="sd-tag">${whenLabel(s.shoot_date)}</span><span>${dRangeLong(s.shoot_date, s.days)}</span></div>
        <div class="sd-kv"><div><span class="xs">Call time</span><b>${call ? esc(call) : 'To confirm'}</b></div>
          <div><span class="xs">Location</span><b>${s.location ? esc(s.location) : 'To confirm'}</b></div></div>
        ${s.location ? `<div class="sd-acts">${dirBtn(s.location, 'onblack')}<button type="button" class="btn quiet onblack" data-a="copy-place" data-place="${esc(s.location)}">Copy</button></div>` : ''}
      </section>

      <h3 class="rsec">On set <span class="g">· ${on.length} confirmed</span></h3>
      <div class="sd-roster">${on.map((p) => rosterRow(p, s)).join('') || '<p class="s g">No one is confirmed yet.</p>'}</div>
      ${pend.length ? `<details class="sd-pend"><summary class="s">${pend.length} more not confirmed yet</summary>${pend.map((p) => rosterRow(p, s)).join('')}</details>` : ''}

      <h3 class="rsec">Group chat</h3>
      <div class="sd-chat">${msgs.length ? msgs.map((m) => `<div class="sd-msg"><b class="xs">${esc(m.who)}${m.all ? ' to everyone' : ''}</b><span class="s">${esc(m.body)}</span><span class="xs m">${ago(m.at)}</span></div>`).join('') : '<p class="s g">No messages yet. Running late, parking, what to bring: send it to everyone here.</p>'}
        ${on.length ? `<form id="f-daymsg" class="scompose" data-id="${s.id}"><input class="in" name="body" required maxlength="4000" autocomplete="off" aria-label="Message everyone" placeholder="Message everyone"><button class="btn ink" type="submit">Send</button></form>` : ''}
        <button type="button" class="btn quiet sd-thread" data-a="shoot" data-id="${s.id}">${RICON.chat}<span>Open each person's chat</span></button></div>

      <h3 class="rsec">Deliverables and review</h3>
      ${tracker(s)}`,
  };
}

export async function openShootDay(id) {
  const s = await rpc('shoot_detail', { p_id: id });
  const layer = hubLayer(s);
  // from the shoot thread opened off this hub, go back to the hub rather than stacking a second one
  if (topLayer()?.shoot === id && belowTop()?.shootday === id) closeLayer();
  if (topLayer()?.shootday === id) refreshTop(layer); else openLayer(layer);
  return s;
}
A.shootday = (el) => openShootDay(el.dataset.id);

A['copy-place'] = async (el) => {
  try { await navigator.clipboard.writeText(el.dataset.place); toast('Address copied'); } catch { toast(el.dataset.place); }
};

// a message to everyone confirmed or still answering, each into their own booking chat (shoot_message_all)
F['f-daymsg'] = async (form) => {
  const n = await rpc('shoot_message_all', { p_id: form.dataset.id, p_body: formData(form).body });
  toast(`Sent to ${n === 1 ? '1 person' : n + ' people'}, each in their own chat`);
  await openShootDay(form.dataset.id);
};
