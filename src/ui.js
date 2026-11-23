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

export const CATS = ['Model', 'Content creator', 'Photographer', 'Videographer', 'Make-up artist', 'Stylist'];
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
export const layerCount = () => stack.length;
export function refreshTop(layer) { if (stack.length) { stack[stack.length - 1] = layer; drawLayers(false); } }

function drawLayers(focusNew) {
  const root = $('#layers');
  document.body.style.overflow = stack.length ? 'hidden' : '';
  root.innerHTML = stack.map((l, i) => {
    const over = i > 0 ? ' over' : '';
    const x = `<button class="xbtn" data-a="close" aria-label="Close">${ICON.x}</button>`;
    if (l.kind === 'sheet') {
      return `<div class="scrim${over}" data-a="close"></div><section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(l.label || '')}" style="z-index:${41 + i * 2}">
        <div class="hd">${l.head || ''}${x}</div><div class="bd">${l.body}</div>${l.foot ? `<div class="ft">${l.foot}</div>` : ''}</section>`;
    }
    return `<div class="scrim${over}" data-a="close" style="z-index:${42 + i * 2}"></div><section class="dialog${l.lg ? ' lg' : ''}" role="dialog" aria-modal="true" style="z-index:${43 + i * 2}">
      <div class="hd">${l.head || ''}${x}</div><div class="bd">${l.body}</div>${l.foot ? `<div class="ft">${l.foot}</div>` : ''}</section>`;
  }).join('');
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
export const initials = (n) => String(n || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();
