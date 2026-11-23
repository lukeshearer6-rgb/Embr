// Pieces used on several screens: talent cards, booking rows, status labels, calendar.
import { S } from '../state.js';
import { photoUrl } from '../api.js';
import { esc, gbp, pounds, pct, dMed, dLong, addDays, iso, initials, plural, whenTxt } from '../ui.js';
import { ICON } from '../icons.js';

export const role = () => S.me?.role;

export function comp(t, { save = true } = {}) {
  const ph = photoUrl(t.photo);
  const stat2 = t.category === 'Model' && t.height ? ['Height', t.height] : ['Category', t.category];
  return `<div class="comp-wrap" style="position:relative"><button class="comp" data-a="talent" data-id="${t.id}" aria-label="${esc(t.name)}, ${esc(t.category)}, ${esc(t.city)}">
    <div class="shot" style="${ph ? `background-image:url('${ph}')` : ''}">${ph ? '' : `<span class="cat">${esc(t.category)}</span><span class="tname">${esc(t.name).replace(' ', '<br>')}</span>`}</div>
    <div class="nm">${esc(t.name)}${t.verified ? ICON.tick : ''}</div>
    ${t.rebooked_by ? `<div class="xs" style="font-weight:600;color:var(--ok);margin-top:2px">Rebooked by ${plural(t.rebooked_by, 'brand')}</div>` : ''}
    <dl class="meas"><div><dt>Based</dt><dd>${esc(t.city)}</dd></div><div><dt>${stat2[0]}</dt><dd>${esc(stat2[1])}</dd></div><div><dt>Day rate</dt><dd>${t.day_rate ? pounds(t.day_rate) : '–'}</dd></div></dl></button>
    ${save && role() === 'brand' ? `<button class="save" data-a="save" data-id="${t.id}" aria-pressed="${!!t.saved}" aria-label="${t.saved ? 'Remove from shortlist' : 'Save to shortlist'}" style="position:absolute;top:10px;right:10px">${ICON.heart}</button>` : ''}</div>`;
}

export function thumb(p, isBrand) {
  if (isBrand) return `<div class="logo-sq" aria-hidden="true">${esc(initials(p?.name))}</div>`;
  const ph = photoUrl(p?.photo);
  return `<div class="thumb" style="${ph ? `background-image:url('${ph}')` : ''}" aria-hidden="true">${ph ? '' : esc(initials(p?.name))}</div>`;
}

// [label, tone] for a booking from the viewer's side
export function status(b, r = role()) {
  switch (b.status) {
    case 'offer': return r === 'talent' ? ['New offer', 'act'] : ['Offer sent', 'wait'];
    case 'accepted': return r === 'talent' ? ['Accepted, awaiting deposit', 'wait'] : ['Accepted, pay deposit', 'act'];
    case 'confirmed': return ['Confirmed', 'ok'];
    case 'wrapped':
      if (b.balance_checkout_url) return r === 'brand' ? ['Confirm balance payment', 'act'] : ['Wrapped, awaiting payment', 'wait'];
      return r === 'brand' ? ['Wrapped, sign off', 'act'] : ['Wrapped, awaiting sign-off', 'wait'];
    case 'completed': return ['Paid', 'off'];
    case 'disputed': return ['Problem reported', 'bad'];
    case 'declined': return ['Declined', 'off'];
    case 'withdrawn': return ['Withdrawn', 'off'];
    case 'cancelled': return ['Cancelled', 'off'];
    default: return [b.status, 'off'];
  }
}
export const stHTML = (b) => { const [l, c] = status(b); return `<span class="st ${c}">${esc(l)}</span>`; };

export function bookingItem(b) {
  const r = role();
  const other = r === 'talent' ? b.brand : b.talent;
  const amt = r === 'talent' ? b.talent_fee_p : b.total_p;
  return `<button class="item" data-a="booking" data-id="${b.id}">${thumb(other, r === 'talent')}
    <div class="grow"><div class="ttl">${esc(b.title)}</div><div class="meta"><span>${esc(r === 'ops' ? b.brand.name + ' → ' + b.talent.name : other.name)}</span><span>${dMed(b.shoot_date)}${b.days > 1 ? ', ' + b.days + ' days' : ''}</span>${b.unread ? '<span style="color:var(--embr-text);font-weight:600">New message</span>' : ''}${r === 'ops' ? `<span>${esc(b.ref)}</span>` : ''}</div></div>
    <div class="amt"><div class="money">${gbp(amt)}</div><div class="mt4">${stHTML(b)}</div></div></button>`;
}

export function groupBookings(list) {
  const r = role();
  const needs = (b) => (r === 'talent' ? b.status === 'offer' || (b.status === 'confirmed' && b.shoot_date <= iso(new Date()))
    : b.status === 'accepted' || b.status === 'wrapped');
  return {
    needs: list.filter(needs),
    upcoming: list.filter((b) => !needs(b) && ['offer', 'accepted', 'confirmed', 'wrapped', 'disputed'].includes(b.status)).sort((a, c) => a.shoot_date.localeCompare(c.shoot_date)),
    past: list.filter((b) => ['completed', 'declined', 'withdrawn', 'cancelled'].includes(b.status)),
  };
}

export function calendar(t, edit, n = 42) {
  const off = new Set(t.off_days || []);
  const bkd = new Set(t.booked_days || []);
  const dow = (new Date().getDay() + 6) % 7;
  let h = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<div class="d hd">${d}</div>`).join('');
  for (let i = 0; i < dow; i++) h += '<div></div>';
  for (let i = 0; i < n; i++) {
    const d = addDays(i);
    const c = bkd.has(d) ? 'bkd' : off.has(d) ? 'off' : 'free';
    h += `<div class="d ${c}" ${edit && c !== 'bkd' ? `role="button" tabindex="0" data-a="day" data-d="${d}"` : ''} title="${dLong(d)}${c === 'bkd' ? ', booked' : c === 'off' ? ', unavailable' : ', available'}">${Number(d.slice(8))}</div>`;
  }
  return `<div class="cal ${edit ? 'edit' : ''}">${h}</div><div class="legend"><span><i style="background:var(--backdrop2)"></i>Available</span><span><i style="background:var(--ink)"></i>Booked</span><span><i style="box-shadow:inset 0 0 0 1px var(--line2)"></i>Unavailable</span></div>`;
}

export function gallery(t) {
  const ph = (t.photos || []).map((p) => photoUrl(p.path));
  if (!ph.length) return `<div style="background:var(--backdrop);padding:48px 24px 24px"><div class="pname">${esc(t.name).replace(' ', '<br>')}</div><p class="s g mt16">No photos yet.</p></div>`;
  return `<div class="gallery">${ph.slice(0, 6).map((u) => `<div style="background-image:url('${u}')"></div>`).join('')}</div>`;
}

export function feeLine(rate) {
  const st = S.me?.settings;
  return `${pct(rate)} Embr fee`;
}

export function signoffNote(b) {
  return b.auto_signoff_at ? `Signs off automatically ${whenTxt(b.auto_signoff_at)} unless a problem is reported.` : '';
}
