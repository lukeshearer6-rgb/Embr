// Shoot Roster: a brand groups several creatives under one shoot (date, days, location, call time),
// sees the combined cost, is told which roles are still missing, and sends every offer in one go.
// Evidence for each choice is in docs/dev/shoot-roster.md.
//
//   bar      a black bar on the board with the shoot, head count and combined day rates, opening
//            the roster (Instacart, Blinkit, Skip and DoorDash cart bars while browsing)
//   header   one shared when and where for everyone (Uber Eats group order, Wolt "Where? When?")
//   people   one row each with their role and day rate (Uber Eats, Shopee and Grab group baskets)
//   missing  "Need a make-up artist?" rows that open the board on that role and date
//            (Navan "Add to trip" with Book, Trainline "Add a place to stay")
//   money    one combined breakdown before sending (Airbnb "Request to book" price details)
//   send     "Send 3 offers": each creative still gets their own offer through create_offer,
//            accepts or declines, and is paid through their own booking. Nothing about payments changes.
//
// A roster is a draft kept on this device until it is sent (localStorage, per brand account).
// Brand-only: talent never see it, and the database refuses offers from anyone but a brand.
import { S, A, C, F, go } from '../state.js';
import { rpc, photoUrl, uploadImage } from '../api.js';
import { $, esc, gbp, pounds, dMed, today, addDays, opts, USAGE, TERMS, toast, openLayer, closeLayer, refreshTop, topLayer, first, plural, rolesOf, emptyState } from '../ui.js';
import { ICON, RICON } from '../icons.js';
import { pkgOf, pkgNote, hoursTxt } from './rates.js';

// ---------------------------------------------------------------- storage (a draft on this device)
const key = () => `embr.roster.${S.me?.id || 'anon'}`;
export function load() {
  try { const r = JSON.parse(localStorage.getItem(key()) || '{}'); return Array.isArray(r.shoots) ? r : { shoots: [] }; } catch { return { shoots: [] }; }
}
function save(r) { try { localStorage.setItem(key(), JSON.stringify(r)); } catch { /* private mode: the roster lasts for this visit only */ } mem = r; }
let mem = null;
const roster = () => (mem && mem.uid === S.me?.id ? mem : (mem = { ...load(), uid: S.me?.id }));
const shootOf = (id) => roster().shoots.find((s) => s.id === id);
const newId = () => Math.random().toString(36).slice(2, 10);

// ---------------------------------------------------------------- missing roles
// On-camera talent need someone to shoot them and usually hair, make-up and styling.
// A roster with only crew needs someone in front of the camera. Shown as prompts, never added for the brand.
const ON_CAMERA = ['Model', 'Actor', 'UGC creator', 'Content creator'];
const CAMERA = ['Photographer', 'Videographer'];
export function missingRoles(crew) {
  const have = new Set(crew.map((c) => c.role));
  const out = [];
  const onCam = ON_CAMERA.some((r) => have.has(r));
  if (!onCam && crew.length) out.push('Model');
  if (onCam && !CAMERA.some((r) => have.has(r)) && !have.has('UGC creator')) out.push('Photographer');
  if (onCam) ['Make-up artist', 'Hair stylist', 'Stylist'].forEach((r) => { if (!have.has(r)) out.push(r); });
  return out.slice(0, 3);
}
const people = (n) => (n === 1 ? '1 person' : `${n} people`);
const aRole = (r) => 'a ' + r.toLowerCase();

// ---------------------------------------------------------------- adding people
// A package picked on the creative's profile (Full day or Half day) sets their rate in the roster, and a
// half day books one day whatever the shoot's length. It only fills the offer's day rate and days.
const crewPkg = (t, key) => { const p = key ? pkgOf(t, key) : null; return p ? { key: p.key, label: p.label, hours: p.hours, includes: p.includes, days: p.days, price: p.price } : null; };
export const crewDays = (c, s) => c.pkg?.days || +s.days || 1;
function addTo(shoot, t, briefRole, pkgKey) {
  const pkg = crewPkg(t, pkgKey);
  const had = shoot.crew.find((c) => c.id === t.id);
  if (had) {
    if (!pkg || had.pkg?.key === pkg.key) return false;
    Object.assign(had, { pkg, day_rate: pkg.price }); // picked another package: switch, don't add twice
    shoot.updated = Date.now();
    return 'switched';
  }
  const rs = rolesOf(t);
  shoot.crew.push({ id: t.id, name: t.name, photo: t.photo || null, roles: rs, role: rs.includes(briefRole) ? briefRole : rs[0] || '', day_rate: pkg?.price || t.day_rate || 200, pkg, city: t.city, verified: !!t.verified });
  shoot.updated = Date.now();
  return true;
}

// "Add to shoot" on the CreativeCard: a short sheet (DESIGN_RULES 3.1) listing the brand's shoot rosters,
// then open briefs to start one from, then a new shoot. Picking adds the creative and keeps the brand browsing.
A['add-shoot'] = async (el) => {
  const { id, name, pkg = '' } = el.dataset;
  const r = roster();
  const briefs = (await rpc('my_briefs')).filter((b) => b.status === 'open' && b.shoot_date >= today() && !r.shoots.some((s) => s.brief_id === b.id));
  const row = (attrs, ttl, sub) => `<button type="button" class="shoot-row" data-a="shoot-pick" data-id="${id}" data-pkg="${esc(pkg)}" ${attrs}><span class="grow"><span class="ttl">${ttl}</span><span class="s g">${sub}</span></span><span aria-hidden="true">›</span></button>`;
  const rosters = r.shoots.map((s) => row(`data-shoot="${s.id}"`, esc(s.title || 'Untitled shoot'), `${s.date ? dMed(s.date) : 'No date yet'}${s.location ? ' · ' + esc(s.location) : ''} · ${people(s.crew.length)}${s.crew.some((c) => c.id === id) ? ' · already in' : ''}`)).join('');
  openLayer({
    kind: 'dialog',
    cls: 'fsheet shootsheet',
    head: `<h2 class="t-24">Add ${esc(first(name))} to a shoot</h2>`,
    body: `${rosters ? `<h3 class="s g mb8">Your shoot rosters</h3>${rosters}` : ''}
      ${briefs.length ? `<h3 class="s g mb8${rosters ? ' mt24' : ''}">Start from a brief</h3>${briefs.map((b) => row(`data-brief="${b.id}"`, esc(b.title), `${dMed(b.shoot_date)} · ${esc(b.category)} · ${pounds(b.day_rate)} a day`)).join('')}` : ''}
      ${row('', 'A new shoot', 'Set the date and place in the roster')}
      <p class="xs g mt16">Group everyone for one shoot, then send their offers together. Each person accepts or declines their own offer.</p>`,
  });
};
A['shoot-pick'] = async (el) => {
  const { id, shoot: sid, brief: bid, pkg } = el.dataset;
  const r = roster();
  const t = await rpc('talent_detail', { p_id: id });
  let s = sid && shootOf(sid);
  let briefRole = null;
  if (!s && bid) {
    const b = await rpc('brief_detail', { p_id: bid });
    briefRole = b.category;
    s = { id: newId(), brief_id: b.id, title: b.title, date: b.shoot_date, days: b.days || 1, location: '', call_time: '', usage_where: (b.usage || '').split(',')[0] || USAGE[0], usage_term: '12 months', content_agreed: '', notes: b.description || '', crew: [] };
    r.shoots.unshift(s);
  }
  if (!s) { s = { id: newId(), brief_id: null, title: '', date: addDays(14), days: 1, location: '', call_time: '', usage_where: USAGE[0], usage_term: '12 months', content_agreed: '', notes: '', crew: [] }; r.shoots.unshift(s); }
  const added = addTo(s, t, briefRole, pkg);
  r.current = s.id;
  save(r);
  closeLayer();
  renderRosterBar();
  const p = s.crew.find((c) => c.id === t.id)?.pkg;
  toast(added === 'switched' ? `${first(t.name)} is now booked for a ${p.label.toLowerCase()} in ${s.title || 'this shoot'}`
    : added ? `${first(t.name)} added to ${s.title || 'your new shoot'}${p ? ` for a ${p.label.toLowerCase()}` : ''}` : `${first(t.name)} is already in this shoot`);
  if (!s.title) openRoster(s.id);
};

// ---------------------------------------------------------------- the bar on the board
export function renderRosterBar() {
  let bar = document.getElementById('rosterbar');
  const show = S.me?.role === 'brand' && S.tab === 'board' && roster().shoots.some((s) => s.crew.length);
  document.body.classList.toggle('has-rbar', !!show);
  if (!show) { bar?.remove(); return; }
  if (!bar) { bar = document.createElement('div'); bar.id = 'rosterbar'; document.body.appendChild(bar); }
  const r = roster();
  const s = shootOf(r.current) || r.shoots.find((x) => x.crew.length);
  const rates = s.crew.reduce((n, c) => n + (+c.day_rate || 0), 0);
  const more = r.shoots.filter((x) => x !== s && x.crew.length).length;
  bar.innerHTML = `<button type="button" class="rbar" data-a="roster" data-shoot="${s.id}" aria-label="Shoot roster: ${esc(s.title || 'new shoot')}, ${people(s.crew.length)}, ${pounds(rates)} in day rates">
    <span class="rb-faces" aria-hidden="true">${s.crew.slice(0, 3).map((c) => `<i style="${c.photo ? `background-image:url('${esc(photoUrl(c.photo))}')` : ''}">${c.photo ? '' : esc(c.name[0] || '')}</i>`).join('')}</span>
    <span class="grow rb-txt"><b>${esc(s.title || 'New shoot')}</b><span>${s.date ? dMed(s.date) + ' · ' : ''}${people(s.crew.length)}${more ? ` · ${plural(more, 'other shoot')}` : ''}</span></span>
    <span class="rb-sum"><b>${pounds(rates)}</b><span>day rates</span></span></button>`;
}

// ---------------------------------------------------------------- the roster screen
// A pushed full screen with a sticky footer, because it ends in offers that commit money (DESIGN_RULES 3.3).
A.roster = (el) => openRoster(el.dataset.shoot);
export function openRoster(sid) {
  const r = roster();
  const s = shootOf(sid) || r.shoots[0];
  if (!s) return toast('Add someone to a shoot from the board first');
  r.current = s.id; save(r);
  const layer = rosterLayer(s);
  if (topLayer()?.roster) refreshTop(layer); else openLayer(layer);
}

// an empty roster: the shoot's details are kept, and the next step is the board on the shoot date
// (HBX and Nike empty bag: icon, one line, one black button; Warby Parker adds quick routes by type)
function emptyCrew(s) {
  const quick = ['Model', 'Photographer', 'Make-up artist'];
  return emptyState({ cls: 'left', icon: RICON.people, title: 'No one on this shoot yet',
    body: `Tap “Add to shoot” on anyone on the board. Each creative gets their own offer with ${s.date ? dMed(s.date) : 'this date'}${s.location ? ', ' + esc(s.location) : ''} and the brief below.`,
    actions: [{ label: s.date ? `See who's free ${dMed(s.date)}` : 'Browse the board', a: 'roster-find', data: { role: '', shoot: s.id }, primary: true },
      ...quick.map((r) => ({ label: r, a: 'roster-find', data: { role: r, shoot: s.id } }))] });
}
function rosterLayer(s) {
  const r = roster();
  const others = r.shoots.filter((x) => x.id !== s.id);
  const miss = missingRoles(s.crew);
  const unsent = s.crew.filter((c) => !c.sent);
  const person = (c) => {
    const ph = photoUrl(c.photo);
    return `<div class="rrow" data-crew="${c.id}"><div class="thumb" style="${ph ? `background-image:url('${esc(ph)}')` : ''}">${ph ? '' : esc(c.name[0] || '')}</div>
      <div class="grow rr-main"><div class="rr-nm">${esc(c.name)}${c.verified ? ICON.tick : ''}</div>
        ${c.roles.length > 1 ? `<label class="rr-role"><span class="sr">Booking ${esc(first(c.name))} as</span><select class="in" data-change="roster-edit" data-crew="${c.id}" data-k="role">${opts(c.roles, c.role)}</select></label>` : `<div class="s g">${esc(c.role)}, ${esc(c.city)}</div>`}
        ${c.pkg ? `<div class="xs rr-pkg">${esc(c.pkg.label)} · ${esc(hoursTxt(c.pkg.hours).toLowerCase())}${c.pkg.days ? ' · one day' : ''}</div>` : ''}
        ${c.err ? `<p class="xs rr-err" role="alert">${esc(c.err)}</p>` : ''}</div>
      ${c.sent ? `<button type="button" class="link s" data-a="booking" data-id="${c.sent}">Offer sent</button>`
        : `<label class="rr-rate"><span class="sr">${esc(first(c.name))}'s day rate in pounds</span><span aria-hidden="true">£</span><input class="in" type="number" inputmode="numeric" min="5" step="5" value="${esc(c.day_rate)}" data-input="roster-edit" data-crew="${c.id}" data-k="day_rate"></label>
        <button type="button" class="rr-x" data-a="roster-remove" data-crew="${c.id}" aria-label="Remove ${esc(c.name)}">${ICON.x}</button>`}</div>`;
  };
  return {
    kind: 'sheet', roster: s.id, label: 'Shoot roster',
    head: `<div class="grow st-hd"><b class="st-ttl">Shoot roster</b>${others.length ? `<span class="xs g">${plural(r.shoots.length, 'shoot')}</span>` : ''}</div>`,
    body: `${others.length ? `<nav class="chips rshoots mb16" aria-label="Your shoots">${r.shoots.map((x) => `<button type="button" class="chip" data-a="roster" data-shoot="${x.id}" aria-pressed="${x.id === s.id}">${esc(x.title || 'New shoot')}</button>`).join('')}</nav>` : ''}
    <form id="f-roster" data-shoot="${s.id}" class="rform">
      <label class="field"><span class="sr">Shoot name</span><input class="in rtitle display" name="title" required value="${esc(s.title)}" placeholder="Name this shoot" data-input="roster-field" autocomplete="off"></label>
      <section class="rwhen" aria-label="When and where">
        <label class="field">Shoot date<input class="in" type="date" name="date" required min="${today()}" value="${esc(s.date)}" data-change="roster-field"></label>
        <label class="field">Days<input class="in" type="number" name="days" min="1" max="14" value="${esc(s.days)}" data-input="roster-field"></label>
        <label class="field span">Location<input class="in" name="location" value="${esc(s.location)}" placeholder="Studio or address" data-input="roster-field"></label>
        <label class="field span">Call time<input class="in" name="call_time" value="${esc(s.call_time)}" placeholder="9am" data-input="roster-field"></label>
      </section>

      <h3 class="rsec">Who's booked <span class="g">${s.crew.length}</span></h3>
      <div class="rcrew">${s.crew.map(person).join('') || emptyCrew(s)}</div>
      ${miss.length && s.crew.length ? `<div class="rmiss" aria-label="Roles not in this shoot yet">${miss.map((m) => `<button type="button" class="rneed" data-a="roster-find" data-role="${esc(m)}" data-shoot="${s.id}">${RICON[m] || ICON.plus}<span class="grow"><b>Need ${aRole(m)}?</b><span class="s g">See who's free ${s.date ? 'on ' + dMed(s.date) : ''}</span></span><span aria-hidden="true">›</span></button>`).join('')}</div>` : ''}
      ${s.crew.length ? `<button type="button" class="btn sm mt12" data-a="roster-find" data-role="" data-shoot="${s.id}">${ICON.plus}Add someone else</button>` : ''}

      <h3 class="rsec">Where you'll use the images</h3>
      <div class="fgrid2"><label class="field">Where<select class="in" name="usage_where" data-change="roster-field">${opts(USAGE, s.usage_where)}</select></label>
        <label class="field">For how long<select class="in" name="usage_term" data-change="roster-field">${opts(TERMS, s.usage_term)}</select></label></div>
      <label class="field mt16">What you'll ask them to do <span class="hint">Nothing outside this can be asked on the day.</span><textarea class="in" name="content_agreed" rows="2" data-input="roster-field">${esc(s.content_agreed)}</textarea></label>
      <h3 class="rsec">Shoot brief</h3>
      <p class="s g mb8">Everyone gets the same brief with their offer, pinned at the top of the shoot thread.</p>
      ${moodEditor(s.mood || [], 'roster-mood', s.id)}
      <label class="field mt16">Moodboard link <span class="hint">Pinterest, Drive or similar, optional</span><input class="in" name="board_link" type="url" placeholder="https://" value="${esc(s.board_link || '')}" data-input="roster-field"></label>
      <label class="field mt16">Notes for everyone <span class="hint">The look, what to bring</span><textarea class="in" name="notes" rows="2" data-input="roster-field">${esc(s.notes)}</textarea></label>

      <h3 class="rsec">Combined cost</h3>
      <div class="panel tint" id="rquote">${unsent.length ? '<div class="empty">Working it out…</div>' : '<p class="s g">Every offer in this shoot has been sent.</p>'}</div>
      ${unsent.length ? `<label class="check mt24"><input type="checkbox" name="agree" required> <span>I accept the <button class="link" type="button" data-a="agreement-preview">Embr booking agreement</button> for each offer, including the 50% deposit when each person accepts and free cancellation until ${S.me.settings.free_cancel_days} days before the shoot.</span></label>` : ''}
      <button type="button" class="link s mt24 rdel" data-a="roster-delete" data-shoot="${s.id}">Delete this roster</button>
    </form>`,
    foot: unsent.length ? `<div class="grow rfoot"><b class="money" id="rtotal">–</b><span class="xs g">Each person gets their own offer. You pay nothing until they accept.</span></div><button class="btn primary" type="submit" form="f-roster">Send ${unsent.length === 1 ? 'offer' : plural(unsent.length, 'offer')}</button>` : '',
    after: () => quoteAll(s.id),
  };
}

// one quote per person, added up; each quote is the same server quote the single offer form uses
let qSeq = 0;
async function quoteAll(sid) {
  const s = shootOf(sid);
  const box = $('#rquote');
  if (!s || !box) return;
  const crew = s.crew.filter((c) => !c.sent);
  if (!crew.length) return;
  const seq = ++qSeq;
  const qs = await Promise.all(crew.map((c) => rpc('quote', { p_talent: c.id, p_day_rate: +c.day_rate || 0, p_days: crewDays(c, s), p_usage_fee: 0 }).catch(() => null)));
  if (seq !== qSeq || !document.contains(box) || qs.some((q) => !q)) return;
  const sum = (k) => qs.reduce((n, q) => n + q[k], 0);
  box.innerHTML = `<div class="ledger">
    ${crew.map((c, i) => `<div class="r"><span>${esc(c.name)}<span class="when">${esc(c.role)} · ${c.pkg?.days ? esc(c.pkg.label.toLowerCase()) : `${crewDays(c, s)} day${crewDays(c, s) > 1 ? 's' : ''}`} at ${pounds(c.day_rate)}</span></span><span>${gbp(qs[i].talent_fee_p)}</span></div>`).join('')}
    <div class="r"><span>Embr fees<span class="when">Set per person, the same as booking each one on their own</span></span><span>${gbp(sum('embr_fee_p'))}</span></div>
    <div class="r t"><span>Total for ${people(crew.length)}</span><span>${gbp(sum('total_p'))}</span></div>
    <div class="r sub"><span>Deposits, paid as each person accepts</span><span>${gbp(sum('deposit_p'))}</span></div>
    <div class="r sub"><span>Balances at sign-off</span><span>${gbp(sum('balance_p'))}</span></div></div>
    <p class="xs g mt8">Each person gets their fee in full. Embr takes no commission from talent.</p>`;
  const tot = $('#rtotal');
  if (tot) tot.textContent = gbp(sum('total_p'));
}

// ---------------------------------------------------------------- editing
let qT;
const requote = (sid) => { clearTimeout(qT); qT = setTimeout(() => quoteAll(sid), 250); };
C['roster-field'] = (el) => {
  const s = shootOf(el.form.dataset.shoot);
  if (!s) return;
  s[el.name] = el.name === 'days' ? Math.max(1, Math.min(14, +el.value || 1)) : el.value;
  s.updated = Date.now();
  save(roster());
  renderRosterBar();
  if (el.name === 'days') requote(s.id);
};
C['roster-edit'] = (el) => {
  const s = shootOf(el.closest('form').dataset.shoot);
  const c = s?.crew.find((x) => x.id === el.dataset.crew);
  if (!c) return;
  c[el.dataset.k] = el.dataset.k === 'day_rate' ? +el.value || 0 : el.value;
  save(roster());
  renderRosterBar();
  if (el.dataset.k === 'role') openRoster(s.id); else requote(s.id);
};
A['roster-remove'] = (el) => {
  const s = shootOf(el.closest('form').dataset.shoot);
  s.crew = s.crew.filter((c) => c.id !== el.dataset.crew);
  save(roster());
  renderRosterBar();
  openRoster(s.id);
};
A['roster-delete'] = (el) => {
  const r = roster();
  r.shoots = r.shoots.filter((s) => s.id !== el.dataset.shoot);
  save(r);
  closeLayer();
  renderRosterBar();
  toast('Roster deleted');
};
// "Need a make-up artist?": back to the board on that role, free on the shoot date (handled by the board)
A['roster-find'] = (el) => {
  const s = shootOf(el.dataset.shoot);
  closeLayer();
  A['board-find']?.({ role: el.dataset.role, date: s?.date || '' });
};

// ---------------------------------------------------------------- moodboard (roster and shoot thread)
// Up to 12 images, uploaded to the brand's own folder in the photos bucket. The database only accepts
// paths inside that folder. A grid of tiles with a remove button each (shown in the shoot thread brief).
export function moodEditor(paths, kind, sid = '') {
  return `<div class="moodedit" data-kind="${kind}" data-shoot="${esc(sid)}"><div class="me-grid">${paths.map((m) => `<div class="me-i" data-mood="${esc(m)}"><img src="${esc(photoUrl(m))}" alt=""><button type="button" class="me-x" data-a="mood-remove" aria-label="Remove image">${ICON.x}</button></div>`).join('')}
    ${paths.length < 12 ? `<label class="me-add">${ICON.plus}<span class="xs">Add images</span><input type="file" accept="image/*" multiple class="sr" data-change="mood-add"></label>` : ''}</div></div>`;
}
function moodPaths(box) { return [...box.querySelectorAll('[data-mood]')].map((x) => x.dataset.mood); }
function moodSave(box) {
  if (box.dataset.kind !== 'roster-mood') return;
  const sh = shootOf(box.dataset.shoot);
  if (sh) { sh.mood = moodPaths(box); save(roster()); }
}
C['mood-add'] = async (el) => {
  const box = el.closest('.moodedit');
  const files = [...el.files].slice(0, 12 - moodPaths(box).length);
  el.closest('.me-add').classList.add('busy');
  try {
    for (const f of files) {
      const path = await uploadImage(S.me.id, f);
      el.closest('.me-add').insertAdjacentHTML('beforebegin', `<div class="me-i" data-mood="${esc(path)}"><img src="${esc(photoUrl(path))}" alt=""><button type="button" class="me-x" data-a="mood-remove" aria-label="Remove image">${ICON.x}</button></div>`);
    }
  } finally { el.closest('.me-add')?.classList.remove('busy'); el.value = ''; }
  moodSave(box);
};
A['mood-remove'] = (el) => { const box = el.closest('.moodedit'); el.closest('.me-i').remove(); moodSave(box); };

// ---------------------------------------------------------------- sending
// One offer per person through the same create_offer the single offer form uses, so the database checks
// (brand only, profile published, date free, agreement ticked) and the payment flow are unchanged.
// If one fails, the others still go and the failure stays in the roster with its reason.
export async function sendRoster(form) {
  const s = shootOf(form.dataset.shoot);
  if (!s) return;
  const d = Object.fromEntries(new FormData(form).entries());
  const crew = s.crew.filter((c) => !c.sent);
  if (!crew.length) return;
  const usage = d.usage_where ? `${d.usage_where}, ${d.usage_term}` : '';
  if (!d.agree) throw new Error('Tick the box to accept the booking agreement');
  // the shared brief becomes a shoot (kept on the draft, so a resend after a failure reuses it),
  // then one offer per person through shoot_offer, which takes the shared details from the shoot
  if (!s.shoot_id) {
    s.shoot_id = await rpc('create_shoot', { p: { title: s.title, shoot_date: s.date, days: s.days, location: s.location, call_time: s.call_time,
      usage, content_agreed: s.content_agreed, brief: s.notes, moodboard: s.mood || [], board_link: s.board_link || '', brief_id: s.brief_id || null } });
    save(roster());
  }
  for (const c of crew) {
    try {
      c.sent = await rpc('shoot_offer', { p_shoot: s.shoot_id, p: {
        talent_id: c.id, days: crewDays(c, s), day_rate: +c.day_rate,
        // the package goes in their offer's notes, as long as the brand hasn't changed the rate from it
        // (the shared notes travel as the shoot brief, so they aren't repeated here)
        notes: c.pkg && +c.day_rate === c.pkg.price ? pkgNote(c.pkg) : '', agree: !!d.agree, role: c.role || null,
      } });
      c.err = null;
    } catch (e) { c.err = e.message; }
  }
  const sent = crew.filter((c) => c.sent), failed = crew.filter((c) => !c.sent);
  const r = roster();
  if (!failed.length) r.shoots = r.shoots.filter((x) => x.id !== s.id); else s.crew = s.crew.filter((c) => !c.sent);
  save(r);
  renderRosterBar();
  if (!failed.length) {
    closeLayer();
    toast(`${sent.length === 1 ? 'Offer' : plural(sent.length, 'offer')} sent for ${s.title}. You'll be told as each person answers.`, 5000);
    go('/bookings');
    const { openShoot } = await import('./shoot.js');
    return openShoot(s.shoot_id);
  }
  openRoster(s.id);
  toast(`${plural(sent.length, 'offer')} sent. ${plural(failed.length, 'offer')} couldn't be sent: see the reason under each name.`, 6000);
}
F['f-roster'] = sendRoster;
