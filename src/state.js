// Shared app state, the registries screens add themselves to, and navigation.
import { rpc } from './api.js';
import { $, esc, ago, openLayer, closeAll } from './ui.js';
import { ICON } from './icons.js';

// Two sites from one codebase: the app (talent and brands, at /) and the Embr
// admin website (staff only, at /admin, desktop). <html data-site="admin"> picks it.
export const SITE = document.documentElement.dataset.site === 'admin' ? 'admin' : 'app';
export const BASE = SITE === 'admin' ? '/admin' : '';
export const S = { me: null, session: null, tab: null, route: null, flags: {} };
export const A = {};       // click actions:  data-a="name"
export const F = {};       // form submits:   <form id="name">
export const C = {};       // change/input:   data-change="name" / data-input="name"
export const VIEWS = { brand: {}, talent: {}, ops: {}, auth: {}, public: {} };
export const NAV = {
  brand: [['board', 'Board'], ['jobs', 'Jobs'], ['bookings', 'Bookings'], ['inbox', 'Messages'], ['shortlist', 'Shortlist'], ['account', 'Account']],
  talent: [['today', 'Today'], ['bookings', 'Bookings'], ['wallet', 'Wallet'], ['inbox', 'Messages'], ['profile', 'Profile'], ['invite', 'Links']],
  ops: [['overview', 'Overview'], ['bookings', 'Bookings'], ['people', 'People'], ['briefs', 'Briefs'], ['invites', 'Invites']],
};
// Phone tab bar: 4 or 5 tabs per mode, Account/Profile last (DESIGN_RULES 1.1, 1.2, 1.7).
// Destinations left off the bar are rows at the top of that last tab.
export const TABS = {
  brand: [['board', 'Board'], ['bookings', 'Bookings'], ['inbox', 'Messages'], ['shortlist', 'Shortlist'], ['account', 'Account']],
  talent: [['today', 'Today'], ['bookings', 'Bookings'], ['wallet', 'Wallet'], ['inbox', 'Messages'], ['profile', 'Profile']],
};

let routeFn = () => {};
export const onRoute = (fn) => { routeFn = fn; };
export function go(path, { replace = false } = {}) {
  if (BASE && path.startsWith('/') && !path.startsWith(BASE)) path = path === '/' ? BASE : BASE + path;
  if (path !== location.pathname + location.search) history[replace ? 'replaceState' : 'pushState']({}, '', path);
  routeFn();
}
window.addEventListener('popstate', () => { closeAll(); routeFn(); });

export async function refreshMe() {
  S.me = await rpc('me');
  return S.me;
}
export const rerender = () => routeFn();

export function renderBell() {
  const el = $('#bell');
  if (!el || !S.me) return;
  const un = S.me.unread || 0;
  el.innerHTML = `<button class="bell" data-a="notifs" aria-label="Notifications${un ? ', ' + un + ' unread' : ''}">${ICON.bell}${un ? `<span class="ct">${un}</span>` : ''}</button>`;
}

A.notifs = async () => {
  const list = await rpc('notifications');
  openLayer({
    kind: 'dialog', head: '<h2 class="t-24">Notifications</h2>',
    body: list.length ? `<div class="list">${list.map((n) => `<button class="item" style="width:100%;${n.read ? '' : 'box-shadow:inset 3px 0 0 var(--embr);padding-left:12px'}" data-go="${esc(n.url || '/')}"><div class="grow"><div class="s">${esc(n.text)}</div><div class="xs g mt4">${ago(n.at)}</div></div></button>`).join('')}</div>` : '<div class="empty">Nothing yet. You\'ll be told here and by email when something needs you.</div>',
  });
  if (list.some((n) => !n.read)) { await rpc('read_notifications'); S.me.unread = 0; renderBell(); }
};
