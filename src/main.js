// Embr pilot app: start-up, routing, the app shell and event wiring.
import './style.css';
import { sb, rpc } from './api.js';
import { $, esc, toast, closeLayer, closeAll, layerCount, loading, openLayer } from './ui.js';
import { ICON, NICON, LOGO } from './icons.js';
import { S, A, F, C, VIEWS, NAV, go, onRoute, refreshMe, renderBell, SITE, BASE } from './state.js';
// role chips anywhere in a form toggle on and off
A['pick-role'] = (el) => {
  const form = el.closest('form');
  const on = el.getAttribute('aria-pressed') === 'true';
  if (on && form?.id === 'f-profile' && form.querySelectorAll('[data-a=pick-role][aria-pressed=true]').length === 1) return toast('Keep at least one thing you do');
  el.setAttribute('aria-pressed', !on);
  form?.dispatchEvent(new Event('roles-changed', { bubbles: true }));
};
A['spec-chip'] = (el) => el.setAttribute('aria-pressed', el.getAttribute('aria-pressed') !== 'true');
import './views/auth.js';
import './views/brand.js';
import './views/booking.js';
import { renderRosterBar } from './views/roster.js';
// the app never loads the staff screens; the admin site never loads the talent or public ones
if (SITE === 'admin') await import('./views/ops.js');
else await Promise.all([import('./views/talent.js'), import('./views/public.js')]);

const app = $('#app');

function shell(role, tab) {
  const nav = NAV[role];
  const flags = S.flags || {};
  const mob = nav.length > 5 ? nav.slice(0, 4) : nav;
  return `<header class="top"><div class="shell topbar">
      <button class="brandmark" data-go="/" aria-label="Embr home"><img src="${LOGO}" alt="Embr"></button>
      <nav class="main" aria-label="Main">${nav.map(([k, l]) => `<button data-tab="${k}" ${tab === k ? 'aria-current="page"' : ''}>${l}${flags[k] ? '<span class="flag" aria-label="needs attention"></span>' : ''}</button>`).join('')}</nav>
      <div class="who"><span class="s g whoami">${esc(S.me.brand?.name || S.me.talent?.name || S.me.email)}${role === 'ops' ? ' · Embr admin' : ''}</span>
        <span id="bell"></span>
        <button class="link s" data-a="signout">Sign out</button></div>
    </div></header>
    <main class="shell" id="main">${loading()}</main>
    ${SITE === 'admin' ? '' : `<nav class="botnav" aria-label="Main">${mob.map(([k, l]) => `<button data-tab="${k}" ${tab === k ? 'aria-current="page"' : ''}>${NICON[k] || NICON.today}<span>${l}</span>${flags[k] ? '<span class="flag"></span>' : ''}</button>`).join('')}${nav.length > 5 ? `<button data-a="more" ${nav.slice(4).some(([k]) => k === tab) ? 'aria-current="page"' : ''}>${NICON.more}<span>More</span></button>` : ''}</nav>`}`;
}

export const bare = (inner) => `<header class="top"><div class="shell topbar"><a class="brandmark" href="/" data-go="/"><img src="${LOGO}" alt="Embr"></a>
  <div class="who">${S.session ? '<button class="link s" data-go="/">Open Embr</button>' : '<button class="link s" data-go="/signin">Sign in</button>'}</div></div></header><main class="shell" id="main">${inner}</main>`;

let renderSeq = 0;
async function render() {
  const seq = ++renderSeq;
  const path = location.pathname.slice(BASE.length).replace(/\/+$/, '') || '/';
  const parts = path.split('/').filter(Boolean);
  S.route = { path, parts, query: new URLSearchParams(location.search) };

  if (SITE === 'app') {
    // public pages work signed in or out
    if (parts[0]?.startsWith('@')) return VIEWS.public.bookme(app, parts[0].slice(1));
    if (parts[0] === 'l' && parts[1]) return VIEWS.public.link(app, parts[1]);
  }
  if (parts[0] === 'signin' || parts[0] === 'join') return VIEWS.auth.signin(app);
  if (!S.session) return SITE === 'admin' ? VIEWS.auth.signin(app) : VIEWS.auth.welcome(app);
  if (!S.me) await refreshMe();
  if (seq !== renderSeq) return;
  if (!S.me?.role) return SITE === 'admin' ? VIEWS.auth.staffJoin(app) : VIEWS.auth.onboarding(app);
  // each site is for its own people only
  if (SITE === 'app' && S.me.role === 'ops') return VIEWS.auth.wrongSite(app, 'admin');
  if (SITE === 'admin' && S.me.role !== 'ops') return VIEWS.auth.wrongSite(app, 'app');

  const role = S.me.role;
  let tab = parts[0];
  let openBooking = null;
  if (tab === 'booking' && parts[1]) { openBooking = parts[1]; tab = 'bookings'; }
  if (!VIEWS[role][tab]) tab = NAV[role][0][0];
  S.tab = tab;
  if (!$('#main') || app.dataset.role !== role || !$('.topbar nav.main')) { app.innerHTML = shell(role, tab); app.dataset.role = role; }
  else {
    document.querySelectorAll('header [data-tab], .botnav [data-tab]').forEach((b) => { if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  }
  renderBell();
  const main = $('#main');
  try {
    const html = await VIEWS[role][tab](main);
    if (seq !== renderSeq) return;
    if (typeof html === 'string') main.innerHTML = html;
    VIEWS[role][tab].after?.(main);
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="callout bad mt24">Couldn't load this page: ${esc(e.message)}. <button class="link" data-a="reload">Try again</button></div>`;
  }
  if (SITE === 'app') renderRosterBar();
  if (openBooking && layerCount() === 0) A.booking({ dataset: { id: openBooking } });
}
onRoute(render);

// ---------------------------------------------------------------- events
document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-a],[data-tab],[data-go]');
  if (!t) return;
  if (t.tagName === 'A' && (e.metaKey || e.ctrlKey)) return;
  if (t.dataset.tab) { e.preventDefault(); closeAll(); return go('/' + t.dataset.tab); }
  if (t.dataset.go) { e.preventDefault(); closeAll(); return go(t.dataset.go); }
  const fn = A[t.dataset.a];
  if (!fn) return;
  e.preventDefault();
  try { await fn(t, e); } catch (err) { console.error(err); toast(err.message || 'Something went wrong'); }
});
document.addEventListener('submit', async (e) => {
  const fn = F[e.target.id];
  if (!fn) return;
  e.preventDefault();
  const btn = e.submitter || e.target.querySelector('[type=submit]');
  const label = btn?.innerHTML;
  if (btn) btn.disabled = true;
  try { await fn(e.target, btn, e); } catch (err) { console.error(err); toast(err.message || 'Something went wrong', 5000); }
  finally { if (btn && document.contains(btn)) { btn.disabled = false; if (label && btn.textContent === 'Working…') btn.innerHTML = label; } }
});
document.addEventListener('change', async (e) => {
  const t = e.target.closest('[data-change]');
  const fn = t && C[t.dataset.change];
  if (fn) { try { await fn(t, e); } catch (err) { toast(err.message); } }
});
document.addEventListener('input', (e) => {
  const t = e.target.closest('[data-input]');
  const fn = t && C[t.dataset.input];
  if (fn) fn(t, e);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && layerCount()) closeLayer();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button][data-a]')) { e.preventDefault(); e.target.click(); }
});

A.close = () => closeLayer();
A.reload = () => render();
A.signout = async () => { await sb.auth.signOut(); S.me = null; S.session = null; closeAll(); go('/'); };
A.more = () => {
  const nav = NAV[S.me.role].slice(4);
  openLayer({ kind: 'dialog', head: '<h2 class="t-24">More</h2>',
    body: `<div class="list">${nav.map(([k, l]) => `<button class="item" style="width:100%" data-tab="${k}"><span class="ttl grow">${l}</span></button>`).join('')}<button class="item" style="width:100%" data-a="signout"><span class="ttl grow">Sign out</span></button></div>` });
};

// ---------------------------------------------------------------- start
sb.auth.onAuthStateChange((event, session) => {
  const was = !!S.session;
  S.session = session;
  if (event === 'SIGNED_OUT') { S.me = null; if (was) render(); }
});
(async () => {
  const { data } = await sb.auth.getSession();
  S.session = data.session;
  await render();
  // keep notifications fresh while the app is open
  setInterval(() => { if (S.session && S.me?.role && document.visibilityState === 'visible') refreshMe().then(renderBell).catch(() => {}); }, 60000);
})();

if (SITE === 'app' && 'serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
export { render };
void ICON; void rpc;
