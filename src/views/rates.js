// Rates and availability: day-rate packages and blocked dates.
// Evidence for each choice is in docs/dev/rates-and-detail.md.
//
//   packages   Full day and Half day, each a price, hours and an optional "what's included" line
//              (Fiverr package tabs, Booksy service options with price and duration, Linktree
//              "Add a booking type"). Brands pick one; it only fills the offer's day rate and days,
//              so quotes, deposits, holds and payouts are unchanged.
//   editor     a full-screen editor with X and one sticky Save (DESIGN_RULES 3.2), opened from Profile
//   blocking   "First day / Last day" then Block (Fiverr "Set unavailable dates", Peerspace "Block time"),
//              a list of blocked ranges to undo, and the month grid for single days
//
// Talent set their own rates and dates here. Nothing here lets talent see briefs or reach brands.
import { S, A, C, F, rerender } from '../state.js';
import { rpc } from '../api.js';
import { $, esc, pounds, dMed, today, addDays, toast, openLayer, closeLayer, formData, plural } from '../ui.js';
import { calendar } from './common.js';

// ---------------------------------------------------------------- packages (shared with the brand screens)
export const PKG = {
  full: { label: 'Full day', lo: 4, hi: 12, dflt: 8 },
  half: { label: 'Half day', lo: 1, hi: 6, dflt: 4 },
};
// the packages a creative offers, full day first; empty when they have no rate yet
export function packagesOf(t) {
  const p = t?.packages || {};
  const out = [];
  if (t?.day_rate) out.push({ key: 'full', label: PKG.full.label, price: t.day_rate, hours: p.full?.hours || PKG.full.dflt, includes: p.full?.includes || '', days: null });
  if (t?.half_rate) out.push({ key: 'half', label: PKG.half.label, price: t.half_rate, hours: p.half?.hours || PKG.half.dflt, includes: p.half?.includes || '', days: 1 });
  return out;
}
export const pkgOf = (t, key) => packagesOf(t).find((p) => p.key === key) || packagesOf(t)[0] || null;
export const hoursTxt = (h) => `Up to ${h} hour${h === 1 ? '' : 's'}`;
// the line added to an offer's notes, so the creative sees which package was picked
export const pkgNote = (p) => `Package: ${p.label}, ${hoursTxt(p.hours).toLowerCase()}${p.includes ? `. Includes: ${p.includes}` : ''}.`;

// ---------------------------------------------------------------- blocked dates as ranges
// consecutive off days become one range: [{from, to, n}]
export function rangesOf(days) {
  const out = [];
  [...(days || [])].sort().forEach((d) => {
    const last = out[out.length - 1];
    if (last && addDaysTo(last.to, 1) === d) { last.to = d; last.n++; } else out.push({ from: d, to: d, n: 1 });
  });
  return out;
}
function addDaysTo(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
const rangeTxt = (r) => (r.n === 1 ? dMed(r.from) : `${dMed(r.from)} – ${dMed(r.to)}`);

// ---------------------------------------------------------------- the summary card on Profile
export function rateCard(t) {
  const pk = packagesOf(t);
  const off = (t.off_days || []).length;
  return `<div class="panel ratecard"><h3>Rates and availability</h3>
    <div class="rc-list">${pk.length ? pk.map((p) => `<div class="rc-row"><span class="grow">${p.label}<span class="xs g">${hoursTxt(p.hours)}</span></span><b class="money">${pounds(p.price)}</b></div>`).join('')
      : '<div class="rc-row"><span class="grow">No rate yet<span class="xs g">Brands need a day rate to see your profile</span></span></div>'}
      ${t.day_rate && !t.half_rate ? '<div class="rc-row"><span class="grow g">Half day<span class="xs g">Not offered</span></span></div>' : ''}
      <div class="rc-row"><span class="grow">Blocked dates<span class="xs g">${off ? 'Brands can\'t book you on these' : 'Every day is open to offers'}</span></span><b>${off ? plural(off, 'day') : 'None'}</b></div></div>
    <button type="button" class="btn ${t.day_rate ? '' : 'primary'} full mt12" data-a="rates-edit">${t.day_rate ? 'Edit rates and dates' : 'Set your rates'}</button></div>`;
}

// ---------------------------------------------------------------- the editor
const hoursOpts = (k, v) => { const { lo, hi } = PKG[k]; let h = ''; for (let i = lo; i <= hi; i++) h += `<option value="${i}" ${+v === i ? 'selected' : ''}>${i} hours</option>`; return h; };

function blockedList(t) {
  const rs = rangesOf(t.off_days);
  if (!rs.length) return '<p class="s g blk-none">No dates blocked. Every day is open to offers.</p>';
  return `<ul class="blk-list">${rs.map((r) => `<li><span class="grow"><b>${rangeTxt(r)}</b><span class="xs g">${plural(r.n, 'day')}</span></span><button type="button" class="btn sm quiet" data-a="unblock" data-from="${r.from}" data-to="${r.to}" aria-label="Unblock ${esc(rangeTxt(r))}">Unblock</button></li>`).join('')}</ul>`;
}

function preview(form) {
  const d = formData(form);
  const t = { day_rate: +d.day_rate || 0, half_rate: d.half_on ? +d.half_rate || 0 : 0, packages: { full: { hours: +d.full_hours, includes: d.full_includes.trim() }, half: { hours: +d.half_hours, includes: d.half_includes.trim() } } };
  const pk = packagesOf(t);
  return pk.length ? pk.map((p) => `<div class="pkg pkg-static"><span class="grow"><b>${p.label}</b><span class="s g">${hoursTxt(p.hours)}</span>${p.includes ? `<span class="xs pk-inc">${esc(p.includes)}</span>` : ''}</span><b class="money">${pounds(p.price)}</b></div>`).join('')
    : '<p class="s g">Add a full-day rate to see how brands will see it.</p>';
}

export function ratesLayer(t) {
  const p = t.packages || {};
  const halfOn = !!t.half_rate;
  return {
    kind: 'sheet', label: 'Rates and availability', rates: true,
    head: '<div class="grow st-hd"><b class="st-ttl">Rates and availability</b></div>',
    body: `<form id="f-rates" class="rates">
      <h2 class="t-24">Your packages</h2>
      <p class="s g mt8 measure">Brands pick a package when they add you to a shoot. They still send you an offer with the date and terms, and you accept or decline it.</p>
      <fieldset class="pe">
        <legend class="pe-hd"><b>Full day</b></legend>
        <div class="pe-row">
          <label class="field">Price<span class="pe-money"><span aria-hidden="true">£</span><input class="in" type="number" inputmode="numeric" name="day_rate" min="5" step="5" required value="${t.day_rate ?? ''}" data-input="rates-preview" aria-label="Full-day price in pounds"></span></label>
          <label class="field">Length<select class="in" name="full_hours" data-change="rates-preview">${hoursOpts('full', p.full?.hours || PKG.full.dflt)}</select></label>
        </div>
        <label class="field">What's included <span class="hint">Optional. For example: two looks, hair and make-up time</span><input class="in" name="full_includes" maxlength="160" value="${esc(p.full?.includes || '')}" data-input="rates-preview"></label>
      </fieldset>
      <fieldset class="pe ${halfOn ? '' : 'off'}" id="pe-half">
        <legend class="pe-hd"><b>Half day</b></legend>
        <label class="switch"><input type="checkbox" name="half_on" ${halfOn ? 'checked' : ''} data-change="half-toggle"><span class="sw" aria-hidden="true"></span><span>Offer half days</span></label>
        <div class="pe-fields" ${halfOn ? '' : 'hidden'}>
          <div class="pe-row">
            <label class="field">Price<span class="pe-money"><span aria-hidden="true">£</span><input class="in" type="number" inputmode="numeric" name="half_rate" min="5" step="5" value="${t.half_rate ?? ''}" ${halfOn ? 'required' : ''} data-input="rates-preview" aria-label="Half-day price in pounds"></span></label>
            <label class="field">Length<select class="in" name="half_hours" data-change="rates-preview">${hoursOpts('half', p.half?.hours || PKG.half.dflt)}</select></label>
          </div>
          <label class="field">What's included <span class="hint">Optional</span><input class="in" name="half_includes" maxlength="160" value="${esc(p.half?.includes || '')}" data-input="rates-preview"></label>
        </div>
      </fieldset>
      <h3 class="s g mt24 mb8">How brands see it</h3>
      <div class="pkgs" id="pe-preview"></div>
    </form>

    <h2 class="t-24 mt48" id="blk">Blocked dates</h2>
    <p class="s g mt8 measure">Brands can't send you an offer for these days, and you won't come up when they search for them. Brands only see the day as unavailable, never a reason.</p>
    <form id="f-block" class="blk-form">
      <label class="field">First day<input class="in" type="date" name="from" required min="${today()}" value="${today()}" data-change="blk-from"></label>
      <label class="field">Last day<input class="in" type="date" name="to" required min="${today()}" value="${today()}"></label>
      <button class="btn ink full" type="submit">Block these dates</button>
    </form>
    <div id="blk-list" class="mt16">${blockedList(t)}</div>
    <h3 class="mt32 mb8">Or tap single days</h3>
    <div id="cal">${calendar(t, true)}</div>`,
    foot: '<span class="grow xs g">Blocked dates save as you change them.</span><button class="btn primary" type="submit" form="f-rates">Save rates</button>',
    after: () => { const f = $('#f-rates'); if (f) $('#pe-preview').innerHTML = preview(f); },
  };
}

A['rates-edit'] = () => openLayer(ratesLayer(S.me.talent));
C['rates-preview'] = (el) => { const f = el.form || $('#f-rates'); if (f) $('#pe-preview').innerHTML = preview(f); };
C['half-toggle'] = (el) => {
  const on = el.checked;
  const fs = $('#pe-half');
  fs.classList.toggle('off', !on);
  fs.querySelector('.pe-fields').hidden = !on;
  fs.querySelector('[name=half_rate]').required = on;
  if (on && !fs.querySelector('[name=half_rate]').value) fs.querySelector('[name=half_rate]').focus();
  C['rates-preview'](el);
};
C['blk-from'] = (el) => { const to = el.form.to; to.min = el.value; if (to.value < el.value) to.value = el.value; };

F['f-rates'] = async (form) => {
  const d = formData(form);
  S.me = await rpc('save_rates', { p: {
    day_rate: d.day_rate, half_rate: d.half_on ? d.half_rate : '',
    full: { hours: d.full_hours, includes: d.full_includes }, half: { hours: d.half_hours || PKG.half.dflt, includes: d.half_includes || '' },
  } });
  closeLayer();
  toast(S.me.talent.published ? 'Rates saved. Brands see them on your profile.' : 'Rates saved');
  rerender();
};

// redraws the list and the month grid after any change to blocked dates
export function refreshDates() {
  const t = S.me.talent;
  if ($('#blk-list')) $('#blk-list').innerHTML = blockedList(t);
  if ($('#cal')) $('#cal').innerHTML = calendar(t, true);
}
F['f-block'] = async (form) => {
  const d = formData(form);
  S.me = await rpc('set_off_range', { p_from: d.from, p_to: d.to, p_off: true });
  refreshDates();
  toast(d.from === d.to ? `${dMed(d.from)} blocked` : `${dMed(d.from)} to ${dMed(d.to)} blocked`);
};
A.unblock = async (el) => {
  const { from, to } = el.dataset;
  S.me = await rpc('set_off_range', { p_from: from, p_to: to, p_off: false });
  refreshDates();
  toast(from === to ? `${dMed(from)} is open again` : `${dMed(from)} to ${dMed(to)} are open again`);
};
