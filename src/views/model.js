// Model details: the comp-card stats (height, bust/chest, waist, hips, sizes,
// shoe, hair, eyes). Talent fill them in; brands see them and filter on them.
// Height in cm (shown with feet and inches), body measurements in inches, UK sizes.
import { esc, opts } from '../ui.js';

export const DRESS = [4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
export const SUITS = ['34', '36', '38', '40', '42', '44', '46', '48'];
export const SHOES = Array.from({ length: 23 }, (_, i) => String(2 + i / 2));
const ftIn = (cm) => { if (!cm) return ''; const i = Math.round(cm / 2.54); return `${Math.floor(i / 12)}'${i % 12}"`; };
const inch = (v) => (v == null || v === '' ? '' : `${+v}"`);

// read-only stats block (brand profile sheet, Book-me page)
export function statsHTML(st) {
  if (!st || !st.sizing) return '';
  const w = st.sizing === 'womenswear';
  const rows = [
    ['Height', st.height_cm ? `${ftIn(st.height_cm)} (${st.height_cm}cm)` : ''],
    w ? ['Bust', inch(st.bust_in)] : ['Chest', inch(st.chest_in)],
    ['Waist', inch(st.waist_in)],
    w ? ['Hips', inch(st.hips_in)] : ['Inside leg', inch(st.inside_leg_in)],
    w ? ['Dress', st.dress_uk ? 'UK ' + st.dress_uk : ''] : ['Suit', st.suit || ''],
    ['Shoe', st.shoe_uk ? 'UK ' + +st.shoe_uk : ''],
    ['Hair', st.hair || ''], ['Eyes', st.eyes || ''],
    w ? ['Bra', st.bra || ''] : ['Collar', inch(st.collar_in)],
    w ? ['Inside leg', inch(st.inside_leg_in)] : ['', ''],
  ].filter(([k, v]) => k && v);
  return `<dl class="statline stats-grid" aria-label="Model details">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    <p class="xs g mt8">${w ? 'Womenswear' : 'Menswear'} sizes · measurements in inches</p>`;
}

// the talent's own form, inside the Model section of their profile
export function statsForm(st = {}, o) {
  const sizing = st.sizing || '';
  const w = sizing === 'womenswear', m = sizing === 'menswear';
  const num = (name, label, val, attrs, hint = '', req = true) => `<label class="field">${label}${req ? '' : ' <span class="hint">Optional</span>'}<input class="in" type="number" inputmode="decimal" name="${name}" value="${val ?? ''}" ${attrs}>${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
  const sel = (name, label, list, val, req = true) => `<label class="field">${label}${req ? '' : ' <span class="hint">Optional</span>'}<select class="in" name="${name}"><option value="">Choose</option>${list.map((x) => `<option ${String(x) === String(val ?? '') ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>`;
  return `<form id="f-stats" class="stats-form"><h4 class="s mb8">Model details <span class="g">(all needed except where it says optional)</span></h4>
    <div class="fgrid">
      <label class="field span">Sizes you model<select class="in" name="sizing" data-change="sizing"><option value="">Choose</option>
        <option value="womenswear" ${w ? 'selected' : ''}>Womenswear (bust, hips, dress size)</option>
        <option value="menswear" ${m ? 'selected' : ''}>Menswear (chest, inside leg, suit size)</option></select>
        <span class="hint">Pick the clothes brands would book you to wear.</span></label>
      ${sizing ? `
      ${num('height_cm', 'Height, cm', st.height_cm, 'min="120" max="220" step="1"', st.height_cm ? ftIn(st.height_cm) : "For example 175 (5'9\")")}
      ${w ? num('bust_in', 'Bust, inches', st.bust_in, 'min="20" max="60" step="0.5"') : num('chest_in', 'Chest, inches', st.chest_in, 'min="20" max="60" step="0.5"')}
      ${num('waist_in', 'Waist, inches', st.waist_in, 'min="18" max="60" step="0.5"')}
      ${w ? num('hips_in', 'Hips, inches', st.hips_in, 'min="20" max="64" step="0.5"') : num('inside_leg_in', 'Inside leg, inches', st.inside_leg_in, 'min="20" max="40" step="0.5"')}
      ${w ? sel('dress_uk', 'Dress size, UK', DRESS, st.dress_uk) : `<label class="field">Suit size<input class="in" name="suit" value="${esc(st.suit || '')}" pattern="[0-9]{2}\\s*[SRLsrl]" placeholder="40R"><span class="hint">Chest and fit: S short, R regular, L long</span></label>`}
      ${sel('shoe_uk', 'Shoe size, UK', SHOES, st.shoe_uk != null ? String(+st.shoe_uk) : '')}
      ${sel('hair', 'Hair colour', o.hair, st.hair)}
      ${sel('eyes', 'Eye colour', o.eyes, st.eyes)}
      ${w ? `<label class="field">Bra size <span class="hint">Optional</span><input class="in" name="bra" value="${esc(st.bra || '')}" placeholder="34B"></label>
             ${num('inside_leg_in', 'Inside leg, inches', st.inside_leg_in, 'min="20" max="40" step="0.5"', '', false)}`
        : num('collar_in', 'Collar, inches', st.collar_in, 'min="12" max="22" step="0.5"', '', false)}` : ''}
    </div>${sizing ? '<button class="btn sm ink mt16" type="submit">Save model details</button>' : ''}
    <p class="xs g mt8">Measure without shoes, over underwear, with the tape level and snug. Bust or chest at the fullest point, waist at the narrowest, hips at the fullest part.</p></form>`;
}

// what a brand can ask for in a brief (or the board's model filters)
export function specsFields(o, sp = {}) {
  const chips = (name, list, picked = []) => `<div class="chips mt8">${list.map((x) => `<button type="button" class="chip" data-a="spec-chip" data-name="${name}" data-v="${esc(x)}" aria-pressed="${picked.map(String).includes(String(x))}">${esc(x)}</button>`).join('')}</div>`;
  const sizing = sp.sizing || '';
  return `<fieldset class="field span specs" data-specs><legend>Model details you need <span class="hint">Optional. Embr only shows models who fit.</span></legend>
    <div class="fgrid mt8">
      <label class="field span">Sizes<select class="in" name="sizing" data-change="spec-sizing"><option value="">Any</option><option value="womenswear" ${sizing === 'womenswear' ? 'selected' : ''}>Womenswear</option><option value="menswear" ${sizing === 'menswear' ? 'selected' : ''}>Menswear</option></select></label>
      <label class="field">Height from, cm<input class="in" type="number" name="height_min" min="120" max="220" value="${sp.height_min ?? ''}" placeholder="Any"></label>
      <label class="field">Height to, cm<input class="in" type="number" name="height_max" min="120" max="220" value="${sp.height_max ?? ''}" placeholder="Any"></label>
      <label class="field">Shoe from, UK<select class="in" name="shoe_min"><option value="">Any</option>${opts(SHOES, sp.shoe_min != null ? String(sp.shoe_min) : '')}</select></label>
      <label class="field">Shoe to, UK<select class="in" name="shoe_max"><option value="">Any</option>${opts(SHOES, sp.shoe_max != null ? String(sp.shoe_max) : '')}</select></label>
      ${sizing === 'womenswear' ? `<div class="field span">Dress sizes, UK <span class="hint">Pick all that work</span>${chips('dress', DRESS, sp.dress)}</div>` : ''}
      ${sizing === 'menswear' ? `<div class="field span">Suit sizes (chest) <span class="hint">Pick all that work</span>${chips('suit', SUITS, sp.suit)}</div>` : ''}
      <div class="field span">Hair <span class="hint">Leave blank for any</span>${chips('hair', o.hair, sp.hair)}</div>
      <div class="field span">Eyes <span class="hint">Leave blank for any</span>${chips('eyes', o.eyes, sp.eyes)}</div>
    </div></fieldset>`;
}
export function readSpecs(form) {
  const box = form.querySelector('[data-specs]');
  if (!box) return {};
  const v = (n) => box.querySelector(`[name=${n}]`)?.value || '';
  const picked = (n) => [...box.querySelectorAll(`[data-a=spec-chip][data-name=${n}][aria-pressed=true]`)].map((b) => b.dataset.v);
  const sp = { sizing: v('sizing'), height_min: v('height_min') ? +v('height_min') : '', height_max: v('height_max') ? +v('height_max') : '',
    shoe_min: v('shoe_min') ? +v('shoe_min') : '', shoe_max: v('shoe_max') ? +v('shoe_max') : '',
    dress: picked('dress').map(Number), suit: picked('suit'), hair: picked('hair'), eyes: picked('eyes') };
  if (sp.sizing !== 'womenswear') sp.dress = [];
  if (sp.sizing !== 'menswear') sp.suit = [];
  return sp;
}
// "Womenswear · 172–183cm · UK 8 or 10 · shoe UK 5–7"
export function specsTxt(sp) {
  if (!sp || !Object.keys(sp).length) return '';
  const out = [];
  if (sp.sizing) out.push(sp.sizing === 'womenswear' ? 'Womenswear' : 'Menswear');
  if (sp.height_min || sp.height_max) out.push(sp.height_min && sp.height_max ? `${sp.height_min}–${sp.height_max}cm` : sp.height_min ? `${sp.height_min}cm and up` : `up to ${sp.height_max}cm`);
  if (sp.dress?.length) out.push('dress UK ' + sp.dress.join(', '));
  if (sp.suit?.length) out.push('suit ' + sp.suit.join(', '));
  if (sp.shoe_min || sp.shoe_max) out.push(sp.shoe_min && sp.shoe_max ? `shoe UK ${sp.shoe_min}–${sp.shoe_max}` : sp.shoe_min ? `shoe UK ${sp.shoe_min}+` : `shoe up to UK ${sp.shoe_max}`);
  if (sp.hair?.length) out.push(sp.hair.join(' or ') + ' hair');
  if (sp.eyes?.length) out.push(sp.eyes.join(' or ') + ' eyes');
  return out.join(' · ');
}
