// Embr staff (admin) screens: overview, every booking, people, briefs with
// their rankings (Luke checks each list by eye in the pilot), and invites.
import { VIEWS, A, F, S, rerender } from '../state.js';
import { rpc } from '../api.js';
import { esc, gbp, pounds, dMed, ago, toast, opts, formData, plural, rolesTxt, confirmDialog } from '../ui.js';
import { bookingItem, thumb, comp } from './common.js';

const V = VIEWS.ops;

V.overview = async () => {
  const o = await rpc('ops_overview');
  const st = o.by_status || {};
  const fig = (l, v, n = '') => `<div class="fig"><div class="l">${l}</div><div class="v">${v}</div>${n ? `<div class="n">${n}</div>` : ''}</div>`;
  return `<h1 class="display t-48 mb24">Overview</h1>
  <div class="figs">${fig('Talent', o.talent, `${o.talent_live} live · ${o.talent_verified} ID-checked · ${o.talent_payouts} with payouts`)}${fig('Brands', o.brands, plural(o.briefs, 'brief') + ' posted')}${fig('Completed bookings', st.completed || 0, `${o.repeat_pairs} repeat brand–talent pairs`)}${fig('Embr fees earned', gbp(o.fees_p), gbp(o.gmv_p) + ' booked in total')}</div>
  <div class="figs mt24">${fig('Offers waiting', st.offer || 0)}${fig('Awaiting deposit', st.accepted || 0)}${fig('Confirmed', (st.confirmed || 0) + (st.wrapped || 0), gbp(o.held_p) + ' in deposits held')}${fig('Paid to talent', gbp(o.paid_to_talent_p))}</div>
  <h2 class="sec mt48">Problems reported</h2>${o.disputes.length ? `<div class="list">${o.disputes.map(bookingItem).join('')}</div>` : '<div class="empty" style="padding:16px 0">None.</div>'}
  <h2 class="sec mt32">Might be stuck</h2><p class="s g mb12">Wrapped bookings past their sign-off time, and accepted offers with no deposit after 3 days.</p>${o.stuck.length ? `<div class="list">${o.stuck.map(bookingItem).join('')}</div>` : '<div class="empty" style="padding:16px 0">None.</div>'}`;
};

let filter = '';
V.bookings = async () => {
  const list = await rpc('ops_bookings', { p_status: filter || null });
  const sts = ['', 'offer', 'accepted', 'confirmed', 'wrapped', 'disputed', 'completed', 'cancelled', 'declined', 'withdrawn'];
  return `<h1 class="display t-48 mb24">Bookings</h1>
  <div class="chips mb24">${sts.map((s) => `<button class="chip" data-a="opsfilter" data-s="${s}" aria-pressed="${filter === s}">${s || 'All'}</button>`).join('')}</div>
  ${list.length ? `<div class="list">${list.map(bookingItem).join('')}</div>` : '<div class="empty">No bookings.</div>'}`;
};
A.opsfilter = (el) => { filter = el.dataset.s; rerender(); };

V.people = async () => {
  const p = await rpc('ops_people');
  const idSt = (t) => (t.verified ? '<span class="st ok">18+ verified</span>' : t.identity_status === 'under_18' ? '<span class="st bad">Under 18</span>' : t.identity_status === 'review' ? '<span class="st warn">ID: confirm age</span>' : t.identity_status ? `<span class="st wait">${esc(t.identity_status)}</span>` : '<span class="st off">No ID check</span>');
  const review = p.talent.filter((t) => t.identity_status === 'review' && !t.verified);
  return `<h1 class="display t-48 mb24">People</h1>
  ${review.length ? `<section class="panel mb24"><h3>ID checks to confirm (${review.length})</h3><p class="s g mt8">Stripe passed these ID checks but Embr couldn't read the date of birth. Open Stripe (Identity, Verification sessions), find the person, check the date of birth shows 18 or over, then confirm.</p>
    <div class="list mt12">${review.map((t) => `<div class="item"><div class="grow"><div class="ttl">${esc(t.name || '(no name yet)')}</div><div class="meta"><span>${esc(t.email)}</span></div></div><a class="btn sm quiet" href="https://dashboard.stripe.com/test/identity/verification-sessions" target="_blank" rel="noopener">Open Stripe</a><button class="btn sm primary" data-a="confirm-age" data-id="${t.id}" data-name="${esc(t.name || t.email)}">Confirm 18+</button></div>`).join('')}</div></section>` : ''}
  <h2 class="sec">Talent (${p.talent.length})</h2>${p.talent.length ? `<div class="list mb48">${p.talent.map((t) => `<button class="item" data-a="talent" data-id="${t.id}">${thumb(t)}<div class="grow"><div class="ttl">${esc(t.name || '(no name yet)')}${t.handle ? ' <span class="s g">@' + esc(t.handle) + '</span>' : ''}</div><div class="meta"><span>${esc(t.email)}</span><span>${esc(rolesTxt(t))}, ${esc(t.city)}</span>${t.published ? "" : "<span>Hidden: profile not finished</span>"}<span>${t.day_rate ? pounds(t.day_rate) + ' a day' : 'No rate'}</span><span>Joined ${dMed(t.joined)}</span><span>${plural(t.bookings, 'booking')}</span></div></div>
    <div class="amt"><div>${idSt(t)}</div><div class="mt4">${t.payouts_enabled ? '<span class="st ok">Payouts</span>' : '<span class="st off">No payouts</span>'}</div><div class="mt4">${t.published ? '<span class="st ok">Live</span>' : '<span class="st off">Hidden</span>'}</div></div></button>`).join('')}</div>` : '<div class="empty">No talent yet. Send some invites.</div>'}
  <h2 class="sec">Brands (${p.brands.length})</h2>${p.brands.length ? `<div class="list">${p.brands.map((b) => `<div class="item">${thumb(b, true)}<div class="grow"><div class="ttl">${esc(b.name || '(no name yet)')}</div><div class="meta"><span>${esc(b.contact_name || '')}</span><span>${esc(b.email)}</span><span>${esc(b.city)}</span><span>Joined ${dMed(b.joined)}</span><span>${plural(b.briefs, 'brief')}, ${plural(b.bookings, 'booking')}</span></div></div></div>`).join('')}</div>` : '<div class="empty">No brands yet.</div>'}`;
};

A['confirm-age'] = async (el) => {
  const yes = await confirmDialog({ title: `Confirm ${el.dataset.name} is 18 or over?`, body: 'Only confirm after checking the date of birth on their passed ID check in Stripe.', yes: 'Confirm 18+' });
  if (!yes) return;
  await rpc('ops_confirm_age', { p_id: el.dataset.id });
  toast('Confirmed 18+'); rerender();
};

V.briefs = async () => {
  const list = await rpc('ops_briefs');
  return `<h1 class="display t-48 mb24">Open briefs</h1><p class="g measure mb24">The talent Embr ranks for each brief. Check each list by eye during the pilot. Brands choose who gets an offer.</p>
  ${list.length ? list.map((j) => `<section class="mb48"><div class="row between wrap"><h2 class="t-24">${esc(j.title)}</h2><span class="s g">${esc(j.brand)} · ${esc(j.category)} · ${esc(j.city)} · ${dMed(j.shoot_date)} · ${pounds(j.day_rate)} a day · ${j.travel === 'local' ? 'local only' : 'travel paid'}</span></div>
    ${j.description ? `<p class="s g mt8 measure">${esc(j.description)}</p>` : ''}
    ${j.ranked.length ? `<div class="comps mt16" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:24px 16px">${j.ranked.map((t) => comp(t, { save: false })).join('')}</div>` : '<div class="empty" style="padding:16px 0">No one free fits this brief.</div>'}</section>`).join('') : '<div class="empty">No open briefs.</div>'}`;
};

V.invites = async () => {
  const list = await rpc('ops_invites');
  return `<h1 class="display t-48 mb24">Invites</h1><p class="g measure mb24">Embr is invite-only during the pilot. Each code works once. Brands can also join from a talent's booking link or Book-me page without a code.</p>
  <form id="f-invite" class="row wrap mb32" style="gap:8px"><select class="in" name="role" style="width:auto"><option value="talent">Talent</option><option value="brand">Brand</option><option value="ops">Embr staff</option></select>
    <input class="in" name="note" placeholder="Who it's for (only you see this)" style="flex:1;min-width:200px"><button class="btn primary" type="submit">Create invite</button></form>
  <div class="list">${list.map((i) => `<div class="item"><div class="grow"><div class="ttl" style="font-family:ui-monospace,monospace">${esc(i.code)}</div><div class="meta"><span>${esc(i.role)}</span>${i.note ? `<span>${esc(i.note)}</span>` : ''}<span>Created ${ago(i.created_at)}</span>${i.used_by ? `<span>Used by ${esc(i.used_by)}</span>` : ''}</div></div>
    ${i.used_at ? '<span class="st off">Used</span>' : `<button class="btn sm" data-a="copy" data-text="${esc(location.origin)}/join?invite=${esc(i.code)}&as=${esc(i.role)}">Copy invite link</button>`}</div>`).join('') || '<div class="empty">No invites yet.</div>'}</div>`;
};
F['f-invite'] = async (form) => {
  const d = formData(form);
  const code = await rpc('ops_create_invite', { p_role: d.role, p_note: d.note || null });
  const url = `${location.origin}/join?invite=${code}&as=${d.role}`;
  try { await navigator.clipboard.writeText(url); toast('Invite created and link copied: ' + code, 5000); } catch { toast('Invite created: ' + code, 6000); }
  rerender();
};
void S; void opts;
