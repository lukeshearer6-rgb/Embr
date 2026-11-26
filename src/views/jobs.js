// Jobs (briefs), brand-only. Brand snag list 2 (Luke, 2026-11-26); evidence in docs/dev/brand-snags-2.md.
//
//   form     a brief holds several roles ("Model × 1, 1 day, £300–£400 a day, £1,000 usage, travel paid";
//            "Nail technician, 2 days, £100–£200, no usage"). Each role is its own card with a From/To
//            day-rate pair (Vinted and eBay price filters: two boxes side by side) and "Add another role"
//            below the last card. One switch: only show talent inside each range.
//   edit     the same form, filled in, from the job screen. Offers already sent keep their terms.
//   job      one section per role: the options list (1st, 2nd, 3rd), a prompt when Embr needs the brand
//            to decide on the next option (Zocdoc "Find a new provider / No thanks"), then Embr's best fit.
//   options  pick backups in order before anything goes wrong (Amazon "Choose a backup", Shipt "Select
//            backups"). Talent see "Optioned" only, never their number. Embr never moves on by itself:
//            it asks the brand.
//   roster   each job opens its own Shoot Roster, so several shoots can run at once.
// Talent never see briefs or options lists, and can't apply: the database refuses them.
import { VIEWS, A, F, C, S, rerender } from '../state.js';
import { rpc, modelOptions, photoUrl } from '../api.js';
import { specsFields, readSpecs, specsTxt } from './model.js';
import { $, esc, pounds, dMed, today, addDays, opts, CATS, CITIES, CASTS, toast, openLayer, closeLayer, refreshTop, topLayer, confirmDialog, plural, first, dRange, tShort } from '../ui.js';
import { usagePicker, readUsage, usageOk } from './contract.js';
import { ICON } from '../icons.js';
import { comp, bookingItem } from './common.js';
import { rosterForBrief } from './roster.js';

const V = VIEWS.brand;
const ON_CAMERA = ['Model', 'Actor', 'UGC creator', 'Content creator'];
export const TRAVEL = [['local', 'Local talent only'], ['covered', 'Travel paid for non-local talent']];
const travelLabel = (k) => (TRAVEL.find(([x]) => x === k) || TRAVEL[0])[1];
const castLabel = (k) => (CASTS.find(([x]) => x === k) || CASTS[0])[1];
export const rangeTxt = (r) => (r.rate_min === r.rate_max ? pounds(r.rate_max) : `${pounds(r.rate_min)}–${pounds(r.rate_max)}`);
// "Model × 2 · 1 day · £300–£400 a day · £1,000 usage · travel paid"
export function roleLine(r) {
  return [`${r.category}${r.spots > 1 ? ' × ' + r.spots : ''}`, plural(r.days, 'day'), `${rangeTxt(r)} a day`,
    r.usage_fee ? `${pounds(r.usage_fee)} usage` : 'no usage fee', r.travel === 'covered' ? 'travel paid' : 'local only'].join(' · ');
}
const rolesSummary = (j) => (j.roles?.length ? j.roles : [{ category: j.category, spots: j.spots }]).map((r) => r.category + (r.spots > 1 ? ' × ' + r.spots : '')).join(', ');

// ---------------------------------------------------------------- the jobs list
V.jobs = async () => {
  const list = await rpc('my_briefs');
  return `<div class="row between top-al wrap mb24"><h1 class="display t-48">Jobs</h1><button class="btn primary" data-a="postjob">${ICON.plus}Post a brief</button></div>
  <p class="g measure mb24">Post a brief and Embr ranks the talent who fit each role. You choose who to option and who gets an offer. Talent can't apply, so you only deal with people you pick.</p>
  ${list.length ? `<div class="list" style="border:0">${list.map((j) => {
    const r0 = j.roles?.[0];
    return `<button class="job" data-a="job" data-id="${j.id}"><div class="ttl">${esc(j.title)}${j.status === 'closed' ? '<span class="tag-f" style="color:var(--mist)">Closed</span>' : ''}${j.needs_you ? '<span class="st act" style="margin-left:8px">Needs you</span>' : ''}</div><div class="rate">${r0 ? rangeTxt(r0) : pounds(j.day_rate)}</div>
    <div class="facts"><span><b>${esc(rolesSummary(j))}</b></span><span>${dRange(j.shoot_date, j.days)}</span><span>${esc(j.city)}</span><span>${plural(j.offers, 'offer')} sent${j.booked ? ', ' + j.booked + ' booked' : ''}</span></div></button>`;
  }).join('')}</div>`
    : '<div class="empty">No briefs yet. Posting one takes about two minutes.</div>'}`;
};

// ---------------------------------------------------------------- the brief form (post and edit)
function roleCard(r, i, mo, n) {
  const sel = (name, list, v) => `<select class="in" name="${name}">${list.map(([k, l]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  return `<fieldset class="rolecard" data-id="${esc(r.id || '')}"><legend class="rc-hd"><b>Role ${i + 1}</b>${n > 1 ? `<button type="button" class="link s" data-a="role-remove">Remove</button>` : ''}</legend>
    <div class="fgrid">
      <label class="field span">Looking for<select class="in" name="category" data-change="role-cat">${opts(CATS, r.category)}</select></label>
      <label class="field">How many<input class="in" type="number" inputmode="numeric" name="spots" min="1" max="20" value="${r.spots || 1}"></label>
      <label class="field">Days<input class="in" type="number" inputmode="numeric" name="days" min="1" max="14" value="${r.days || 1}"><span class="hint">Within the shoot</span></label>
      <div class="field span"><span>Day rate</span><div class="range2 mt4">
        <label class="money-in"><span>£</span><input class="in" type="number" inputmode="numeric" name="rate_min" min="5" step="5" required value="${r.rate_min ?? 200}" aria-label="Day rate from"></label>
        <span class="g" aria-hidden="true">to</span>
        <label class="money-in"><span>£</span><input class="in" type="number" inputmode="numeric" name="rate_max" min="5" step="5" required value="${r.rate_max ?? 300}" aria-label="Day rate to"></label></div>
        <span class="hint">For their time (the basic studio fee). A range shows you everyone who charges within it.</span></div>
      <label class="field span">Usage fee per person, £ <span class="hint">Separate from the day rate: what you pay to use the photos. £0 if none.</span><input class="in" type="number" inputmode="numeric" name="usage_fee" min="0" step="5" value="${r.usage_fee ?? (ON_CAMERA.includes(r.category || 'Model') ? 0 : 0)}"></label>
      <label class="field">Travel${sel('travel', TRAVEL, r.travel || 'local')}</label>
      <label class="field">Casting${sel('gender', CASTS, r.gender || 'any')}<span class="hint">Optional. Only pick one when the look of the role needs it, for example womenswear.</span></label>
      <div class="span" data-rspecs>${(r.category || CATS[0]) === 'Model' ? specsFields(mo, r.specs || {}) : ''}</div>
    </div></fieldset>`;
}
async function briefForm(j = null) {
  const mo = await modelOptions();
  const roles = j?.roles?.length ? j.roles : [{ category: CATS[0], spots: 1, days: 1, rate_min: 200, rate_max: 300, usage_fee: 0, travel: 'local', gender: 'any' }];
  const n = roles.length;
  return {
    kind: 'sheet', label: j ? 'Edit brief' : 'Post a brief', head: '<div class="grow s g">Only you and Embr see your brief. Talent never see it.</div>',
    body: `<h2 class="display t-48">${j ? 'Edit brief' : 'Post a brief'}</h2>
    ${j?.bookings?.length ? '<p class="callout mt16">Offers you\'ve already sent keep their own terms. Changes here apply to new options and offers.</p>' : ''}
    <form id="f-job" data-id="${esc(j?.id || '')}" class="mt24" style="max-width:720px"><div class="fgrid">
      <label class="field span">Title<input class="in" name="title" required value="${esc(j?.title || '')}" placeholder="Spring campaign"></label>
      <label class="field">City<select class="in" name="city">${opts(CITIES, j?.city || S.me.brand?.city)}</select></label>
      <label class="field">Shoot date<input class="in" type="date" name="shoot_date" required min="${today()}" value="${esc(j?.shoot_date || addDays(14))}"></label>
      <label class="field">Shoot length, days<input class="in" type="number" inputmode="numeric" name="shoot_days" min="1" max="14" value="${j?.days || 1}"></label></div>
      <h3 class="mt32">Who you're looking for</h3>
      <p class="s g mt4">Add a role for each kind of person, with their own days, day-rate range and usage fee.</p>
      <div id="rolecards" class="mt12">${roles.map((r, i) => roleCard(r, i, mo, n)).join('')}</div>
      <button type="button" class="btn mt12" data-a="role-add">${ICON.plus}Add another role</button>
      <label class="check mt24"><input type="checkbox" name="only_in_range" ${j?.only_in_range ? 'checked' : ''}> <span>Only show talent within each day-rate range<span class="hint" style="display:block">Leave this off and Embr also shows people who fit the brief but charge more or less, marked as outside your range.</span></span></label>
      <h3 class="mt32">Where you'll use the photos</h3>
      <div class="mt12">${usagePicker(j?.usage_terms?.where ? j.usage_terms : null, { who: 'brand', noHours: true })}</div>
      <label class="field mt16">Brief<textarea class="in" name="description" placeholder="What you're shooting, the look, what's provided">${esc(j?.description || '')}</textarea></label></form>`,
    foot: `<span class="grow"></span><button class="btn primary" type="submit" form="f-job">${j ? 'Save changes' : 'Post and see who fits'}</button>`,
  };
}
function renumber() {
  const cards = [...document.querySelectorAll('#rolecards .rolecard')];
  cards.forEach((c, i) => {
    c.querySelector('.rc-hd b').textContent = `Role ${i + 1}`;
    const rm = c.querySelector('[data-a=role-remove]');
    if (cards.length > 1 && !rm) c.querySelector('.rc-hd').insertAdjacentHTML('beforeend', '<button type="button" class="link s" data-a="role-remove">Remove</button>');
    if (cards.length === 1 && rm) rm.remove();
  });
}
A.postjob = async () => openLayer(await briefForm());
A['job-edit'] = async (el) => {
  const j = await rpc('brief_detail', { p_id: el.dataset.id });
  openLayer(await briefForm(j));
};
A['role-add'] = async () => {
  const box = $('#rolecards');
  const last = box.querySelector('.rolecard:last-child');
  const days = last?.querySelector('[name=days]')?.value || 1;
  box.insertAdjacentHTML('beforeend', roleCard({ category: 'Photographer', days: +days, rate_min: 150, rate_max: 300, usage_fee: 0, travel: 'local', gender: 'any' }, box.children.length, await modelOptions(), 2));
  renumber();
  box.lastElementChild.querySelector('[name=category]').focus();
};
A['role-remove'] = (el) => { el.closest('.rolecard').remove(); renumber(); };
C['role-cat'] = async (sel) => {
  const box = sel.closest('.rolecard').querySelector('[data-rspecs]');
  box.innerHTML = sel.value === 'Model' ? specsFields(await modelOptions()) : '';
};
function readRoles(form) {
  return [...form.querySelectorAll('.rolecard')].map((c) => {
    const v = (n) => c.querySelector(`[name=${n}]`)?.value;
    const r = { id: c.dataset.id || null, category: v('category'), spots: +v('spots') || 1, days: +v('days') || 1, rate_min: +v('rate_min') || 0,
      rate_max: +v('rate_max') || 0, usage_fee: +v('usage_fee') || 0, travel: v('travel'), gender: v('gender') };
    if (r.rate_max < r.rate_min) throw new Error(`The top of the ${r.category.toLowerCase()} day-rate range is below the bottom`);
    r.specs = r.category === 'Model' ? readSpecs(c.querySelector('[data-rspecs]')) : {};
    return r;
  });
}
F['f-job'] = async (form) => {
  const usage_terms = readUsage(form);
  if (!usage_terms.where.length) throw new Error('Pick where you\'ll use the photos');
  if (!usageOk(usage_terms)) throw new Error('Type how many months the photos can be used for, from 1 to 120');
  const p = { title: form.title.value, city: form.city.value, shoot_date: form.shoot_date.value, days: +form.shoot_days.value || 1, only_in_range: form.only_in_range.checked,
    usage_terms, description: form.description.value, roles: readRoles(form) };
  if (p.roles.some((r) => r.days > p.days)) throw new Error('A role can\'t be booked for more days than the shoot');
  const id = form.dataset.id ? await rpc('update_brief', { p_id: form.dataset.id, p }) : await rpc('create_brief', { p });
  closeLayer();
  if (form.dataset.id) { closeLayer(); toast('Brief updated'); } // back past the old job screen, then reopen it fresh
  rerender();
  A.job({ dataset: { id } });
};

// ---------------------------------------------------------------- the job screen
// why each person is in the best-fit list, checked against the role
function fitLines(t, j, r) {
  const rate = t.day_rate;
  const rows = [
    [true, `Free ${dRange(j.shoot_date, r.days)}`],
    [true, t.away ? `Travels from ${t.city}` : `Based in ${j.city}`],
    !rate ? [false, 'No day rate set'] : t.in_range ? [true, `${pounds(rate)} a day, in your range`]
      : [false, rate > r.rate_max ? `${pounds(rate)} a day, ${pounds(rate - r.rate_max)} over your range` : `${pounds(rate)} a day, under your range`],
    ...(r.gender !== 'any' ? [[!t.gender_unstated, t.gender_unstated ? 'Hasn\'t said their gender' : `Casting: ${castLabel(r.gender).toLowerCase()}`]] : []),
    ...(specsTxt(r.specs) ? [[true, 'Matches your model details']] : []),
  ];
  return `<ul class="fit" aria-label="Why ${esc(t.name)} fits">${rows.map(([ok, l]) => `<li class="${ok ? 'ok' : 'no'}">${esc(l)}</li>`).join('')}</ul>`;
}
const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
const active = (o) => ['held', 'offered', 'booked'].includes(o.status);
function optionRow(o, i, r, j, opts) {
  const t = o.talent;
  const st = o.status === 'booked' ? '<span class="st ok">Booked</span>'
    : o.status === 'declined' ? '<span class="st bad">Can\'t do it</span>'
      : o.status === 'offered' ? (['accepted'].includes(o.booking_status) ? '<span class="st ok">Accepted, deposit due</span>'
        : o.lapsed ? '<span class="st act">No answer in time</span>' : `<span class="st wait">Offer sent · answer by ${dMed(o.respond_by)} ${tShort(o.respond_by)}</span>`)
        : '<span class="st off">Optioned</span>';
  const firstHeld = opts.filter(active).find((x) => x.status === 'held');
  const nothingOut = !opts.some((x) => x.status === 'offered' && !x.lapsed && ['offer', 'accepted'].includes(x.booking_status));
  const canOffer = o.status === 'held' && o.id === firstHeld?.id && nothingOut && j.status === 'open';
  return `<div class="optrow"><span class="opt-n" aria-label="Option ${i + 1}">${ORD[i] || i + 1}</span>
    <button type="button" class="thumb" data-a="talent" data-id="${t.id}" data-brief="${j.id}" style="${t.photo ? `background-image:url('${esc(photoUrl(t.photo))}')` : ''}" aria-label="${esc(t.name)}">${t.photo ? '' : esc(t.name[0] || '')}</button>
    <div class="grow"><div class="ttl">${esc(t.name)}</div><div class="mt4">${st}</div></div>
    <div class="opt-act">
      ${canOffer ? `<button class="btn sm primary" data-a="offer" data-id="${t.id}" data-brief="${j.id}" data-role="${r.id}" data-option="${o.id}">Send offer</button>` : ''}
      ${o.booking_id && o.status !== 'held' ? `<button class="btn sm quiet" data-a="booking" data-id="${o.booking_id}">See offer</button>` : ''}
      ${o.status === 'held' && i > 0 ? `<button type="button" class="iconbtn" data-a="option-up" data-id="${o.id}" aria-label="Move ${esc(first(t.name))} up">↑</button>` : ''}
      ${o.status === 'held' ? `<button type="button" class="iconbtn" data-a="option-remove" data-id="${o.id}" aria-label="Release ${esc(first(t.name))}">${ICON.x}</button>` : ''}</div></div>`;
}

// the decision Embr hands back to the brand: option N didn't answer in time or can't do it
function nextPrompt(r, j) {
  const opts = r.options;
  const stuck = opts.find((o) => (o.status === 'offered' && o.lapsed) || o.status === 'declined');
  if (!stuck || j.status !== 'open') return '';
  const busyOffer = opts.some((o) => o.status === 'offered' && !o.lapsed && ['offer', 'accepted'].includes(o.booking_status));
  if (busyOffer) return '';
  const next = opts.find((o) => o.status === 'held');
  const who = first(stuck.talent.name);
  const why = stuck.status === 'declined' ? `${esc(who)} can't do it.` : `${esc(who)} hasn't answered in time.`;
  return `<div class="callout act nextopt mt12" role="status"><p><b>${why}</b> ${next ? `Move to your next option, ${esc(next.talent.name)}? They get the same kind of offer and ${esc(who)}${stuck.status === 'offered' ? '\'s offer is withdrawn' : ' comes off your list'}.` : 'You have no more options for this role. Option someone below, or search the board.'}</p>
    <div class="row mt12">${next ? `<button class="btn sm primary" data-a="option-next" data-pass="${stuck.id}" data-next="${next.id}" data-id="${next.talent.id}" data-brief="${j.id}" data-role="${r.id}" data-lapsed="${stuck.status === 'offered'}">Offer to ${esc(first(next.talent.name))}</button>` : `<button class="btn sm" data-a="option-next" data-pass="${stuck.id}" data-brief="${j.id}">Clear ${esc(who)}</button>`}
      ${stuck.status === 'offered' ? '<button class="btn sm quiet" data-a="opt-wait">Keep waiting</button>' : ''}</div></div>`;
}
function roleSection(r, j) {
  const opts = r.options || [];
  const live = opts.filter(active);
  const room = live.length < 3 * r.spots && j.status === 'open';
  const filled = r.booked >= r.spots;
  return `<section class="jrole" aria-label="${esc(r.category)}">
    <h3 class="mt32">${esc(r.category)}${r.spots > 1 ? ` × ${r.spots}` : ''}${filled ? ' <span class="st ok">Booked</span>' : ''}</h3>
    <p class="s g mt4">${esc([plural(r.days, 'day'), `${rangeTxt(r)} a day`, r.usage_fee ? `${pounds(r.usage_fee)} usage per person` : 'no usage fee', travelLabel(r.travel), r.gender !== 'any' ? 'casting ' + castLabel(r.gender).toLowerCase() : ''].filter(Boolean).join(' · '))}</p>
    ${specsTxt(r.specs) ? `<p class="s mt4"><b>Model details:</b> ${esc(specsTxt(r.specs))}</p>` : ''}
    ${nextPrompt(r, j)}
    ${opts.length ? `<h4 class="s mt16 mb8">Your options</h4><div class="optlist">${opts.map((o, i) => optionRow(o, i, r, j, opts)).join('')}</div>
      <p class="xs g mt8">They only see that they're optioned, never their number. If your 1st option doesn't answer in time or you can't agree, Embr asks you before moving to the next.</p>` : ''}
    <h4 class="s mt24 mb8">Best fit</h4>
    <p class="xs g mb12">${j.only_in_range ? `Only people charging ${rangeTxt(r)} a day. ` : 'People in your range first, then others who fit. '}Ranked by who's free, where they're based and their day rate. Option up to ${3 * r.spots} in order${r.spots > 1 ? ' (3 for each place)' : ''}.</p>
    ${r.ranked.length ? `<div class="comps fitgrid">${r.ranked.map((t) => `<div>${comp(t, { save: false }).replace('data-a="talent"', `data-a="talent" data-brief="${j.id}"`)}${fitLines(t, j, r)}
        ${t.offered ? '<p class="xs g mt4">Offer sent</p>' : t.optioned ? '<p class="xs g mt4">On your options</p>' : `<div class="row mt8 fitacts">${room ? `<button class="btn sm" data-a="option-add" data-role="${r.id}" data-id="${t.id}" data-brief="${j.id}">Option</button>` : ''}<button class="btn sm ${room ? 'quiet' : 'full'}" data-a="offer" data-id="${t.id}" data-brief="${j.id}" data-role="${r.id}">Send offer</button></div>`}</div>`).join('')}</div>`
      : `<div class="empty">No one free fits this role yet.${j.only_in_range ? ' Try turning off "only within range" in Edit.' : ' Try another date, or search the board.'}</div>`}
  </section>`;
}
function jobLayer(j) {
  return {
    kind: 'sheet', job: j.id, label: j.title, head: `<div class="grow s g">Posted ${dMed(j.created_at)}${j.updated_at ? ' · edited ' + dMed(j.updated_at) : ''}</div>`,
    body: `<h2 class="display t-48">${esc(j.title)}</h2>
    <dl class="statline"><div><dt>Date</dt><dd>${dRange(j.shoot_date, j.days)}</dd></div><div><dt>Where</dt><dd>${esc(j.city)}</dd></div><div><dt>Roles</dt><dd>${esc(rolesSummary(j))}</dd></div></dl>
    ${j.status === 'open' ? `<div class="row wrap mt16 jobacts"><button class="btn sm" data-a="job-edit" data-id="${j.id}">Edit brief</button><button class="btn sm" data-a="job-roster" data-id="${j.id}">Shoot roster</button></div>` : ''}
    ${j.description ? `<p class="measure mt24">${esc(j.description)}</p>` : ''}${j.usage ? `<p class="s g mt8">Usage: ${esc(j.usage)}</p>` : ''}
    ${(j.roles || []).map((r) => roleSection(r, j)).join('')}
    ${j.bookings.length ? `<h3 class="mt32 mb8">Offers</h3><div class="list">${j.bookings.map(bookingItem).join('')}</div>` : ''}`,
    foot: j.status === 'open' ? `<button class="btn quiet" data-a="closejob" data-id="${j.id}">Close brief</button><span class="grow"></span><button class="btn" data-tab="board">Search the board instead</button>` : '<span class="s g">This brief is closed.</span>',
  };
}
async function refreshJob(id, j) {
  j = j || await rpc('brief_detail', { p_id: id });
  if (topLayer()?.job === id) refreshTop(jobLayer(j)); else openLayer(jobLayer(j));
}
A.job = async (el) => refreshJob(el.dataset.id);
A.closejob = async (el) => {
  const ok = await confirmDialog({ title: 'Close this brief?', body: 'Anyone you\'ve optioned is released and told their dates are free. Offers already sent stay as they are.', yes: 'Close brief' });
  if (!ok) return;
  await rpc('close_brief', { p_id: el.dataset.id }); closeLayer(); toast('Brief closed'); rerender();
};
A['option-add'] = async (el) => {
  const j = await rpc('option_add', { p_role: el.dataset.role, p_talent: el.dataset.id });
  toast('Optioned. They\'re told they\'re on hold, not their number.');
  refreshJob(j.id, j);
};
A['option-remove'] = async (el) => {
  const ok = await confirmDialog({ title: 'Release this option?', body: 'They\'re told the hold has been released and their dates are free.', yes: 'Release' });
  if (!ok) return;
  const j = await rpc('option_remove', { p_option: el.dataset.id });
  refreshJob(j.id, j);
};
A['option-up'] = async (el) => { const j = await rpc('option_up', { p_option: el.dataset.id }); refreshJob(j.id, j); };
// move on: withdraw the unanswered offer (if there is one), then open the offer for the next option
A['option-next'] = async (el) => {
  if (el.dataset.lapsed === 'true') {
    const ok = await confirmDialog({ title: 'Move to your next option?', body: 'Your unanswered offer is withdrawn and they\'re told, the same as any withdrawn offer.', yes: 'Withdraw and move on' });
    if (!ok) return;
  }
  const j = await rpc('option_pass', { p_option: el.dataset.pass });
  await refreshJob(j.id, j);
  if (el.dataset.next) A.offer({ dataset: { id: el.dataset.id, brief: el.dataset.brief, role: el.dataset.role, option: el.dataset.next }, closest: () => null });
};
A['job-roster'] = async (el) => {
  const j = await rpc('brief_detail', { p_id: el.dataset.id });
  rosterForBrief(j);
};
// keep waiting: hide the prompt for now; it comes back next time the job opens while there's still no answer
A['opt-wait'] = (el) => el.closest('.nextopt')?.remove();
