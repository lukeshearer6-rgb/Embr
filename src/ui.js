// Small UI helpers shared by every screen. Markup follows the v11 prototype.
import { ICON } from './icons.js';

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const first = (n) => String(n || '').split(' ')[0];
export const gbp = (pence) => {
  const v = (pence || 0) / 100;
  return '£' + (Number.isInteger(v) ? v.toLocaleString('en-GB') : v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
};
export const pounds = (n) => gbp((n || 0) * 100);
export const pct = (r) => Math.round(Number(r) * 1000) / 10 + '%';
const D = (d) => new Date(String(d).length === 10 ? d + 'T12:00:00' : d);
export const dMed = (d) => D(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
export const dLong = (d) => D(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const dWeekday = (d) => D(d).toLocaleDateString('en-GB', { weekday: 'long' });
export const dShort = (d) => D(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
export const tShort = (d) => D(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
export const iso = (dt) => { const z = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
export const today = () => iso(new Date());
export const addDays = (n, from) => { const d = from ? D(from) : new Date(); d.setDate(d.getDate() + n); return iso(d); };
export function ago(t) {
  const s = (Date.now() - new Date(t).getTime()) / 1000;
  if (s < 60) return 'Just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  if (s < 86400 * 7) return Math.floor(s / 86400) + ' d ago';
  return dShort(t);
}
export function whenTxt(t) {
  const h = (new Date(t).getTime() - Date.now()) / 3600000;
  if (h <= 0) return 'shortly';
  if (h < 1) return 'within the hour';
  if (h < 24) return 'in ' + Math.round(h) + ' hours';
  return 'on ' + dMed(t) + ' at ' + tShort(t);
}
export const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
export const opts = (arr, v) => arr.map((x) => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('');

// the roles a person can pick (the same list as role_rules() in the database)
export const CATS = ['Model', 'UGC creator', 'Actor', 'Content creator', 'Photographer', 'Videographer', 'Make-up artist', 'Hair stylist', 'Nail technician', 'Stylist'];
export const rolesOf = (t) => (t?.roles?.length ? t.roles : t?.category ? [t.category] : []);
// "Model, UGC creator and Actor"
export const rolesTxt = (t) => { const r = rolesOf(t); return r.length < 2 ? r.join('') : r.slice(0, -1).join(', ') + ' and ' + r.at(-1); };
// role chips for a form: pressed chips are read back with pickedRoles(form)
export const roleChips = (picked = [], label = 'What you do') => `<fieldset class="field span roles-pick"><legend>${esc(label)} <span class="hint">Pick everything that applies</span></legend>
  <div class="chips mt8">${CATS.map((c) => `<button type="button" class="chip" data-a="pick-role" data-role="${esc(c)}" aria-pressed="${picked.includes(c)}">${esc(c)}</button>`).join('')}</div></fieldset>`;
// "UGC creators", "models": for sentences like "Show me models in Leeds"
export const rolePlural = (c) => (c === 'UGC creator' ? 'UGC creators' : c.toLowerCase() + 's');
export const pickedRoles = (form) => [...form.querySelectorAll('[data-a=pick-role][aria-pressed=true]')].map((b) => b.dataset.role);
// travel is a preference, not a promise: talent still decide offer by offer
export const TRAVEL_RANGE = [['local', 'Local to my city'], ['region', 'Around my region'], ['uk', 'Anywhere in the UK'], ['international', 'UK and abroad']];
export const TRAVEL_COSTS = [['paid', 'Brand covers travel'], ['nearby_included', 'Nearby travel included, further paid'], ['discuss', 'Agree it per booking']];
// keep in step with _region() in the database
export const REGIONS = { north: ['Manchester', 'Liverpool', 'Leeds'], midlands: ['Birmingham'], south: ['London', 'Bristol'], scotland: ['Glasgow'] };
export const nearby = (city) => (Object.values(REGIONS).find((r) => r.includes(city)) || []).filter((c) => c !== city);
export const travelTxt = (t) => {
  const r = (TRAVEL_RANGE.find(([k]) => k === (t.travel_range || (t.travels ? 'uk' : 'local'))) || TRAVEL_RANGE[0])[1];
  if ((t.travel_range || 'local') === 'local' && !t.travels) return r;
  const c = { paid: 'travel paid', nearby_included: 'nearby travel included', discuss: 'costs agreed per booking' }[t.travel_costs || 'paid'];
  return `${r}, ${c}`;
};
export const CITIES = ['Manchester', 'London', 'Birmingham', 'Leeds', 'Glasgow', 'Bristol', 'Liverpool'];
export const USAGE = ['Instagram and TikTok', 'Paid social ads', 'Website and online shop', 'Email newsletters', 'Posters and print', 'All of it'];
export const TERMS = ['3 months', '6 months', '12 months', '24 months'];

// ---------------------------------------------------------------- toast
let toastT;
export function toast(msg, ms = 3200) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => { el.hidden = true; }, ms);
}

// ---------------------------------------------------------------- layers (sheets and dialogs)
const stack = [];
let lastFocus = null;
export function openLayer(layer) {
  if (!stack.length) lastFocus = document.activeElement;
  stack.push(layer);
  drawLayers(true);
}
export function replaceLayer(layer) { stack.pop(); stack.push(layer); drawLayers(true); }
export function closeLayer() {
  const top = stack.pop();
  top?.onClose?.();
  drawLayers(false);
  if (!stack.length && lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
}
export function closeAll() { while (stack.length) stack.pop()?.onClose?.(); drawLayers(false); }
export const topLayer = () => stack[stack.length - 1];
export const belowTop = () => stack[stack.length - 2];
export const layerCount = () => stack.length;
export function refreshTop(layer) { if (stack.length) { stack[stack.length - 1] = layer; drawLayers(false); } }

function drawLayers(focusNew) {
  const root = $('#layers');
  document.body.style.overflow = stack.length ? 'hidden' : '';
  // a layer underneath keeps its scroll position when one opens or closes above it
  const keep = [...root.querySelectorAll('.sheet,.dialog')].map((el) => el.querySelector('.bd')?.scrollTop || 0);
  root.innerHTML = stack.map((l, i) => {
    const over = i > 0 ? ' over' : '';
    const x = `<button class="xbtn" data-a="close" aria-label="Close">${ICON.x}</button>`;
    if (l.kind === 'sheet') {
      return `<div class="scrim${over}" data-a="close"></div><section class="sheet${l.cls ? ' ' + l.cls : ''}" role="dialog" aria-modal="true" aria-label="${esc(l.label || '')}" style="z-index:${41 + i * 2}">
        <div class="hd">${l.head || ''}${x}</div><div class="bd">${l.body}</div>${l.foot ? `<div class="ft">${l.foot}</div>` : ''}</section>`;
    }
    return `<div class="scrim${over}" data-a="close" style="z-index:${42 + i * 2}"></div><section class="dialog${l.lg ? ' lg' : ''}${l.cls ? ' ' + l.cls : ''}" role="dialog" aria-modal="true" style="z-index:${43 + i * 2}">
      <div class="hd">${l.head || ''}${x}</div><div class="bd">${l.body}</div>${l.foot ? `<div class="ft">${l.foot}</div>` : ''}</section>`;
  }).join('');
  root.querySelectorAll('.sheet,.dialog').forEach((el, i) => { const bd = el.querySelector('.bd'); if (bd && keep[i] && (i < stack.length - 1 || !focusNew)) bd.scrollTop = keep[i]; });
  if (focusNew && stack.length) {
    const panel = root.querySelectorAll('.sheet,.dialog');
    const el = panel[panel.length - 1];
    (el?.querySelector('input:not([type=hidden]),select,textarea') || el?.querySelector('.xbtn'))?.focus({ preventScroll: true });
  }
  stack[stack.length - 1]?.after?.(root);
}

export function confirmDialog({ title, body, yes = 'Confirm', danger = false, field = null }) {
  return new Promise((ok) => {
    openLayer({
      kind: 'dialog',
      head: `<h2 class="t-24">${esc(title)}</h2>`,
      body: `<p class="g">${body}</p>${field ? `<label class="field mt16">${esc(field.label)}<textarea class="in" id="cd-field" ${field.required ? 'required' : ''} placeholder="${esc(field.placeholder || '')}"></textarea></label>` : ''}`,
      foot: `<button class="btn quiet" data-a="cd-no">Back</button><button class="btn ${danger ? 'danger' : 'ink'}" data-a="cd-yes">${esc(yes)}</button>`,
      onClose: () => ok(null),
      after: (root) => {
        root.querySelector('[data-a=cd-no]').onclick = (e) => { e.stopPropagation(); closeLayer(); };
        root.querySelector('[data-a=cd-yes]').onclick = (e) => {
          e.stopPropagation();
          const v = field ? root.querySelector('#cd-field').value.trim() : true;
          if (field?.required && !v) { root.querySelector('#cd-field').focus(); return; }
          const top = stack.pop(); drawLayers(false); top && ok(v);
        };
      },
    });
  });
}

// ---------------------------------------------------------------- misc
export const formData = (form) => Object.fromEntries(new FormData(form).entries());
export function busy(btn, on = true, label = 'Working…') {
  if (!btn) return;
  if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.textContent = label; }
  else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
}
export const loading = () => '<div class="empty">Loading…</div>';
// ---------------------------------------------------------------- skeletons and empty states (docs/dev/mobile-polish.md)
// grey blocks in the shape of a CreativeCard: a 4:5 photo, then name and role lines (Airbnb, Faire)
export const skelCards = (n = 4) => `<div class="feed skel" aria-busy="true" aria-label="Loading talent">${Array.from({ length: n }, () =>
  '<div class="cc" aria-hidden="true"><div class="cc-frame sk-b"></div><div class="cc-body"><i class="sk-l t w70"></i><i class="sk-l w90"></i><i class="sk-l w50"></i></div></div>').join('')}</div>`;
// icon, one bold line, one line of why, then clear actions: [{ label, a, data, primary, link, tab }]
export function emptyState({ icon = '', title, body = '', actions = [], cls = '', extra = '' }) {
  const act = (x) => {
    const data = Object.entries(x.data || {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
    const hook = x.tab ? ` data-tab="${esc(x.tab)}"` : ` data-a="${esc(x.a)}"`;
    return x.html || `<button type="button" class="${x.link ? 'link s' : `btn ${x.primary ? 'ink' : ''}`}"${hook}${data}>${esc(x.label)}</button>`;
  };
  return `<div class="estate ${cls}" role="status">${icon ? `<span class="es-ic" aria-hidden="true">${icon}</span>` : ''}<h3>${esc(title)}</h3>${body ? `<p>${body}</p>` : ''}${extra}${actions.length ? `<div class="es-acts">${actions.map(act).join('')}</div>` : ''}</div>`;
}
// photos fade in over their grey tile once loaded (or failed), so tiles never flash white
if (typeof document !== 'undefined') {
  const done = (e) => { const t = e.target; if (t?.tagName === 'IMG') t.parentElement?.classList.add('ld'); };
  document.addEventListener('load', done, true);
  document.addEventListener('error', done, true);
}
export const initials = (n) => String(n || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();
