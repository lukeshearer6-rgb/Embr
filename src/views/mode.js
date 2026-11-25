// Brand and creative modes on one sign-in (design: docs/dev/mode-switcher.md).
// The active mode is profiles.role on the server, so it follows the person
// across devices and every database rule keeps checking it. Switching only
// swaps which tabs show; each mode's data stays its own.
import { A, F, S, TABS, go } from '../state.js';
import { rpc, agencyText } from '../api.js';
import { $, esc, opts, CITIES, formData, roleChips, pickedRoles, openLayer, closeAll, toast } from '../ui.js';
import { LOGO } from '../icons.js';
import { agencyBox } from './auth.js';

export const MODE_NAME = { brand: 'brand', talent: 'creative' };
export const holds = (r) => (r === 'brand' ? !!S.me?.brand : r === 'talent' ? !!S.me?.talent : false);
export const other = (r = S.me?.role) => (r === 'brand' ? 'talent' : r === 'talent' ? 'brand' : null);
export const canSwitch = () => !!other() && holds(other());
// the tab that holds the switcher (Account for brands, Profile for creatives)
export const homeTab = (r = S.me?.role) => TABS[r]?.at(-1)?.[0];

const SWAP = '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4 3 8l4 4"/><path d="M3 8h14"/><path d="m17 20 4-4-4-4"/><path d="M21 16H7"/></svg>';

// Floating "Switch to …" pill above the phone tab bar, on the Account/Profile tab only (Airbnb A-switch-1, A-switch-2)
export function renderModePill() {
  let pill = document.getElementById('modepill');
  const show = S.me && canSwitch() && S.tab === homeTab();
  document.body.classList.toggle('has-mpill', !!show);
  if (!show) { pill?.remove(); return; }
  if (!pill) { pill = document.createElement('button'); pill.id = 'modepill'; pill.className = 'mode-pill'; document.body.appendChild(pill); }
  const to = other();
  pill.dataset.a = 'switch-mode';
  pill.dataset.to = to;
  pill.innerHTML = `${SWAP}<span>Switch to ${MODE_NAME[to]}</span>`;
}
// the same switch in the desktop header, where Airbnb's web app keeps it
export const headerSwitch = () => (canSwitch() ? `<button class="link s hswitch" data-a="switch-mode" data-to="${other()}">Switch to ${MODE_NAME[other()]}</button>` : '');

// Account/Profile top block: rows for destinations that left the tab bar, and either
// which mode you're in or an "add the other one" card (Airbnb "Become a host", Fiverr "Seller mode")
export function modeBlock(rows = []) {
  const r = S.me.role;
  const o = other(r);
  const list = rows.length ? `<div class="list menu-rows phone-only mb24">${rows.map(([tab, label, sub]) => `<button class="item" style="width:100%" data-tab="${tab}"><div class="grow"><div class="ttl">${esc(label)}</div>${sub ? `<div class="xs g mt4">${esc(sub)}</div>` : ''}</div><span class="chev" aria-hidden="true">›</span></button>`).join('')}</div>` : '';
  if (!o) return list;
  if (holds(o)) {
    return `<div class="mode-card is-on mb24"><div class="grow"><div class="xs g">You're in ${MODE_NAME[r]} mode</div>
      <div class="s mt4">${r === 'brand' ? 'Your creative profile, bookings and wallet are in creative mode.' : 'Your brand, briefs and the bookings you made are in brand mode.'}</div></div>
      <button class="btn sm desk-only" data-a="switch-mode" data-to="${o}">Switch to ${MODE_NAME[o]}</button></div>${list}`;
  }
  const copy = r === 'brand'
    ? ['Also a model or creative?', 'Add a creative profile to this sign-in. Bookings, payments and messages stay separate for each.', 'Add a creative profile']
    : ['Run a brand as well?', 'Add a brand profile to this sign-in. Your creative profile, bookings and wallet stay separate.', 'Add a brand profile'];
  return `<div class="mode-card mb24"><div class="grow"><div class="ttl">${copy[0]}</div><div class="s g mt4">${copy[1]}</div></div>
    <button class="btn sm" data-a="add-mode" data-to="${o}">${copy[2]}</button></div>${list}`;
}

// Full-screen "Switching to … mode" moment between the two tab sets (Airbnb A-switch-3)
function curtain(to) {
  const el = document.createElement('div');
  el.className = 'mode-curtain';
  el.setAttribute('role', 'status');
  el.innerHTML = `<img src="${LOGO}" alt=""><p>Switching to ${MODE_NAME[to]} mode</p>`;
  document.body.appendChild(el);
  return el;
}
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export async function switchTo(to) {
  closeAll();
  const c = curtain(to);
  try {
    const [me] = await Promise.all([rpc('switch_mode', { p_role: to }), pause(reduced() ? 0 : 650)]);
    S.me = me;
    go('/' + TABS[to][0][0]);
  } finally {
    c.classList.add('out');
    setTimeout(() => c.remove(), reduced() ? 0 : 220);
  }
}
A['switch-mode'] = (el) => switchTo(el.dataset.to);

A['add-mode'] = async (el) => {
  const to = el.dataset.to;
  const agency = to === 'talent' ? await agencyText().catch(() => '') : '';
  const t = S.me.talent; const b = S.me.brand;
  const invite = `<label class="field span">Invite code<input class="in" name="invite" required autocapitalize="characters" placeholder="${to === 'brand' ? 'B-XXXXXX' : 'T-XXXXXX'}">
    <span class="hint">Embr is invite-only during the pilot, so each profile needs its own invite.</span></label>`;
  const body = to === 'brand'
    ? `<form id="f-addmode" data-role="brand"><div class="fgrid">${invite}
        <label class="field span">Brand or company name<input class="in" name="name" required autocomplete="organization"></label>
        <label class="field">Your name<input class="in" name="contact_name" required autocomplete="name" value="${esc(t?.name || '')}"></label>
        <label class="field">City<select class="in" name="city">${opts(CITIES, t?.city || 'Manchester')}</select></label></div>
        <button class="btn primary full mt24" type="submit">Add brand profile</button></form>`
    : `<form id="f-addmode" data-role="talent"><div class="fgrid">${invite}
        <label class="field span">Your name<input class="in" name="name" required autocomplete="name" value="${esc(b?.contact_name || '')}"></label>
        ${roleChips([], 'What do you do?')}
        <label class="field span">Based in<select class="in" name="city">${opts(CITIES, b?.city || 'Manchester')}</select></label>
        <label class="field span">Date of birth<input class="in" type="date" name="dob" required max="${new Date(Date.now() - 18 * 365.25 * 864e5).toISOString().slice(0, 10)}">
          <span class="hint">Creative profiles are for people aged 18 and over. You'll confirm it with a quick ID check before your first booking.</span></label>
        ${agencyBox(agency)}</div>
        <button class="btn primary full mt24" type="submit">Add creative profile</button></form>`;
  openLayer({ kind: 'sheet', label: to === 'brand' ? 'Add a brand profile' : 'Add a creative profile',
    head: `<h2 class="t-24 grow">${to === 'brand' ? 'Add a brand profile' : 'Add a creative profile'}</h2>`, body });
};
F['f-addmode'] = async (form) => {
  const role = form.dataset.role;
  const d = formData(form);
  if (role === 'talent') { d.roles = pickedRoles(form); if (!d.roles.length) throw new Error('Pick at least one thing you do'); }
  // keep the sheet open until the server says yes, so a wrong invite code can be fixed in place
  S.me = await rpc('add_mode', { p_role: role, p_invite: d.invite, p_data: d });
  closeAll();
  const c = curtain(role);
  await pause(reduced() ? 0 : 650);
  go(role === 'talent' ? '/profile' : '/' + TABS.brand[0][0]);
  c.classList.add('out'); setTimeout(() => c.remove(), reduced() ? 0 : 220);
  toast(role === 'talent' ? 'Creative profile added. Next: your photos and rates.' : 'Brand profile added.');
};
void $;
