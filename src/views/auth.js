// Welcome, sign-in by emailed code, and first-time account setup.
import { SITE, VIEWS, F, A, S, go, refreshMe } from '../state.js';
import { sendCode, verifyCode, rpc, sb } from '../api.js';
import { $, esc, toast, opts, CITIES, formData, roleChips, pickedRoles } from '../ui.js';
import { LOGO } from '../icons.js';

const VIA = 'embr-via';
export const via = () => { try { return JSON.parse(sessionStorage.getItem(VIA) || '{}'); } catch { return {}; } };
export const setVia = (v) => { try { sessionStorage.setItem(VIA, JSON.stringify(v)); } catch { /* private mode */ } };

const frame = (inner) => `<header class="top"><div class="shell topbar"><a class="brandmark" href="/" data-go="/"><img src="${LOGO}" alt="Embr"></a></div></header>
  <main class="shell" id="main"><div class="welcome" style="padding-top:24px">${inner}</div></main>`;

VIEWS.auth.welcome = (app) => {
  app.dataset.role = '';
  app.innerHTML = frame(`<img src="${LOGO}" alt="Embr" style="height:34px">
    <h1 class="display t-72 mt24">Unsigned, not unseen.</h1>
    <p class="g mt16 measure">Brands book models and creatives directly, with the terms agreed in writing and a deposit paid up front. Talent keep everything they earn: Embr takes 0% of your fee.</p>
    <div class="choices" style="grid-template-columns:repeat(2,1fr)">
      <button class="choice" data-go="/signin?as=brand"><b>I'm a brand</b><div class="s g mt4">Find and book talent</div></button>
      <button class="choice" data-go="/signin?as=talent"><b>I'm talent</b><div class="s g mt4">Let work find you</div></button>
    </div>
    <p class="s mt24">Already have an account? <button class="link s" data-go="/signin">Sign in</button></p>
    <p class="xs g mt24">Embr is invite-only during the pilot, and for talent aged 18 and over.</p>`);
};

VIEWS.auth.signin = (app) => {
  app.dataset.role = '';
  const q0 = new URLSearchParams(location.search);
  if (SITE === 'admin' && q0.get('invite')) setVia({ invite: q0.get('invite').toUpperCase(), as: 'ops' });
  if (S.session) return go('/', { replace: true });
  const q = new URLSearchParams(location.search);
  if (q.get('invite')) setVia({ ...via(), invite: q.get('invite').toUpperCase(), as: q.get('as') || undefined });
  if (q.get('as')) setVia({ ...via(), as: q.get('as') });
  app.innerHTML = frame(`<h1 class="display t-48">${SITE === 'admin' ? 'Embr admin' : 'Sign in'}</h1>${SITE === 'admin' ? '<p class="s g mt8">For Embr staff. Talent and brands use the app.</p>' : ''}
    <p class="g mt16 measure">Enter your email and we'll send you a sign-in code. No password needed.</p>
    <form id="f-email" class="mt24" style="max-width:420px">
      <label class="field">Email<input class="in" type="email" name="email" required autocomplete="email" inputmode="email" placeholder="you@example.com"></label>
      <button class="btn primary full mt16" type="submit">Email me a code</button>
      <p class="s g mt16"><button class="link s" type="button" data-a="have-code">I already have a code</button></p>
    </form>
    <form id="f-code" class="mt24" style="max-width:420px" hidden>
      <p class="s">We sent a code to <b id="code-to"></b>. It can take a minute to arrive.</p>
      <label class="field mt16">Code from the email<input class="in" name="token" required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,8}" maxlength="8" style="letter-spacing:.3em;font-size:22px"></label>
      <button class="btn primary full mt16" type="submit">Sign in</button>
      <p class="s g mt16"><button class="link s" type="button" data-a="code-back">Use a different email</button> · <button class="link s" type="button" data-a="code-resend">Send a new code</button></p>
    </form>
    <p class="xs g mt32">By signing in you agree to Embr's pilot terms and privacy notice.</p>`);
};

let pendingEmail = '';
function showCodeForm(email, sent = true) {
  pendingEmail = email;
  $('#f-email').hidden = true;
  const f2 = $('#f-code');
  f2.hidden = false;
  f2.querySelector('p.s').innerHTML = sent ? `We sent a code to <b>${esc(email)}</b>. It can take a minute to arrive.` : `Enter the code for <b>${esc(email)}</b>.`;
  f2.querySelector('input').focus();
}
F['f-email'] = async (form, btn) => {
  const email = formData(form).email.trim().toLowerCase();
  btn.textContent = 'Sending…';
  await sendCode(email);
  showCodeForm(email);
};
// a code from an earlier email (or, in testing, one Embr staff made), when a new email can't be sent
A['have-code'] = () => {
  const input = $('#f-email input[name=email]');
  if (!input.reportValidity()) return;
  showCodeForm(input.value.trim().toLowerCase(), false);
};
F['f-code'] = async (form, btn) => {
  btn.textContent = 'Checking…';
  const session = await verifyCode(pendingEmail, formData(form).token.replace(/\s/g, ''));
  S.session = session;
  const me = await refreshMe();
  const v = via();
  if (me?.role) setVia({});
  go(v.back || '/', { replace: true });
};
A['code-back'] = () => { $('#f-code').hidden = true; $('#f-email').hidden = false; $('#f-email input').focus(); };
A['code-resend'] = async () => { await sendCode(pendingEmail); toast('New code sent'); };

VIEWS.auth.onboarding = async (app) => {
  app.dataset.role = '';
  const v = via();
  if (v.invite && !v.as) {
    const inv = await rpc('check_invite', { p_code: v.invite }).catch(() => ({}));
    if (inv.ok) setVia({ ...v, as: inv.role });
    return VIEWS.auth.onboarding2(app);
  }
  return VIEWS.auth.onboarding2(app);
};
VIEWS.auth.onboarding2 = (app) => {
  const v = via();
  const as = v.as || (v.link || v.handle ? 'brand' : 'talent');
  if (as === 'ops') {
    // a staff invite opened in the app: send it to the admin website instead
    app.innerHTML = frame(`<h1 class="display t-48">This is a staff invite</h1>
      <p class="g mt16 measure">Embr staff use the admin website on a computer, not the app.</p>
      <a class="btn primary mt24" href="/admin/join?invite=${encodeURIComponent(v.invite || '')}">Open the admin website</a>`);
    setVia({});
    return;
  }
  app.innerHTML = frame(`<h1 class="display t-48">Set up your account</h1>
    <p class="g mt16">Signed in as ${esc(S.me?.email)}. <button class="link" data-a="signout">Not you?</button></p>
    <div class="seg mt24" style="max-width:420px" role="group" aria-label="Account type">
      <button data-a="ob-role" data-r="brand" aria-pressed="${as === 'brand'}">I'm a brand</button>
      <button data-a="ob-role" data-r="talent" aria-pressed="${as === 'talent'}">I'm talent</button>
    </div>
    <div id="ob-form" class="mt24" style="max-width:520px">${obForm(as, v)}</div>`);
};
function obForm(as, v) {
  const viaLink = as === 'brand' && (v.link || v.handle);
  const invite = `<label class="field span">Invite code${viaLink ? ' <span class="hint">Not needed: you came from a talent\'s link</span>' : ''}<input class="in" name="invite" value="${esc(v.invite || '')}" ${viaLink ? '' : 'required'} autocapitalize="characters" placeholder="${as === 'brand' ? 'B-XXXXXX' : 'T-XXXXXX'}"></label>`;
  if (as === 'brand') {
    return `<form id="f-onboard" data-role="brand"><div class="fgrid">${invite}
      <label class="field span">Brand or company name<input class="in" name="name" required autocomplete="organization"></label>
      <label class="field">Your name<input class="in" name="contact_name" required autocomplete="name"></label>
      <label class="field">City<select class="in" name="city">${opts(CITIES, 'Manchester')}</select></label></div>
      <button class="btn primary full mt24" type="submit">Create brand account</button></form>`;
  }
  return `<form id="f-onboard" data-role="talent"><div class="fgrid">${invite}
    <label class="field span">Your name<input class="in" name="name" required autocomplete="name"></label>
    ${roleChips([], 'What do you do?')}
    <label class="field span">Based in<select class="in" name="city">${opts(CITIES, 'Manchester')}</select></label>
    <label class="field span">Date of birth<input class="in" type="date" name="dob" required max="${new Date(Date.now() - 18 * 365.25 * 864e5).toISOString().slice(0, 10)}">
      <span class="hint">Embr is for talent aged 18 and over. You'll confirm it with a quick ID check before your first booking.</span></label></div>
    <button class="btn primary full mt24" type="submit">Create talent account</button></form>`;
}
A['ob-role'] = (el) => {
  document.querySelectorAll('[data-a=ob-role]').forEach((b) => b.setAttribute('aria-pressed', b === el));
  setVia({ ...via(), as: el.dataset.r });
  $('#ob-form').innerHTML = obForm(el.dataset.r, via());
};
F['f-onboard'] = async (form) => {
  const d = formData(form);
  const v = via();
  let role = form.dataset.role;
  if (d.invite && role !== 'ops') {
    const inv = await rpc('check_invite', { p_code: d.invite });
    if (inv.ok && inv.role === 'ops') { setVia({ invite: d.invite, as: 'ops' }); return VIEWS.auth.onboarding2($('#app')); }
  }
  if (role === 'talent') {
    d.roles = pickedRoles(form);
    if (!d.roles.length) throw new Error('Pick at least one thing you do');
  }
  S.me = await rpc('create_profile', {
    p_role: role, p_invite: d.invite || null,
    p_link: role === 'brand' ? v.link || null : null, p_handle: role === 'brand' ? v.handle || null : null,
    p_data: d,
  });
  const back = v.back;
  setVia({});
  toast(role === 'talent' ? 'Welcome to Embr. Next: your profile.' : 'Welcome to Embr.');
  if (role === 'ops') return go('/overview', { replace: true });
  go(back || (role === 'talent' ? '/profile' : '/'), { replace: true });
};

// keep the session in step with sign-in changes made in other tabs
sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_IN' && !S.me) refreshMe().catch(() => {}); });

// ---------------------------------------------------------------- admin website only
// First sign-in on the admin site: an Embr staff invite code makes a staff account.
VIEWS.auth.staffJoin = (app) => {
  app.dataset.role = '';
  const v = via();
  app.innerHTML = frame(`<h1 class="display t-48">Embr admin</h1><p class="g mt16">Signed in as ${esc(S.me?.email)}. <button class="link" data-a="signout">Not you?</button></p>
    <form id="f-staff" class="mt24" style="max-width:420px"><label class="field">Staff invite code<input class="in" name="invite" required autocapitalize="characters" value="${esc(v.invite || '')}"></label>
    <button class="btn primary full mt24" type="submit">Create staff account</button></form>`);
};
F['f-staff'] = async (form) => {
  const d = formData(form);
  S.me = await rpc('create_profile', { p_role: 'ops', p_invite: d.invite, p_link: null, p_handle: null, p_data: {} });
  setVia({});
  go('/overview', { replace: true });
};
// Signed in on the wrong site (staff in the app, or talent/brand on the admin site)
VIEWS.auth.wrongSite = (app, to) => {
  app.dataset.role = '';
  app.innerHTML = frame(to === 'admin'
    ? `<h1 class="display t-48">You're signed in as Embr staff</h1><p class="g mt16 measure">The app is for talent and brands. Staff use the admin website on a computer.</p>
       <div class="row mt24"><a class="btn primary" href="/admin">Open the admin website</a><button class="btn" data-a="signout">Sign out</button></div>`
    : `<h1 class="display t-48">This is the Embr admin website</h1><p class="g mt16 measure">It's for Embr staff. Your account is in the app.</p>
       <div class="row mt24"><a class="btn primary" href="/">Open Embr</a><button class="btn" data-a="signout">Sign out</button></div>`);
};
