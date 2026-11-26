// The booking sheet (call sheet, money, actions, messages) shared by brand,
// talent and Embr staff, plus the payment actions.
import { A, F, S, go, rerender, refreshMe } from '../state.js';
import { rpc, action, photoUrl } from '../api.js';
import { $, esc, gbp, pounds, pct, dMed, dLong, dShort, dWeekday, tShort, ago, today, toast, openLayer, closeLayer, refreshTop, topLayer, confirmDialog, formData, first, busy, whenTxt } from '../ui.js';
import { ICON } from '../icons.js';
import { thumb, status, stHTML } from './common.js';
import { talentShootSec, talentChangeSec, continueShootPay } from './shoot.js';

function money(b, r) {
  const rows = [
    ['Session', `${b.days} day${b.days > 1 ? 's' : ''} at ${pounds(b.day_rate)}`, b.session_p],
    ...(b.talent_fee_p > b.session_p ? [['Usage', '', b.talent_fee_p - b.session_p]] : []),
  ];
  if (r === 'talent') {
    return `<div class="ledger">${rows.map(([l, w, v]) => `<div class="r"><span>${l}<span class="when">${w}</span></span><span>${gbp(v)}</span></div>`).join('')}
      <div class="r t"><span>You get</span><span>${gbp(b.talent_fee_p)}</span></div>
      <div class="r sub"><span>Embr commission</span><span>£0</span></div>
      ${b.paid_to_talent_p ? `<div class="r sub"><span>Paid to you</span><span style="color:var(--ok)">${gbp(b.paid_to_talent_p)}</span></div>` : ''}</div>
      <p class="xs g mt8">${b.status === 'completed' ? 'Paid to your bank through Stripe. Stripe pays out to your account on its usual schedule.' : 'The brand pays a 50% deposit when you accept. You\'re paid in full at sign-off.'}</p>`;
  }
  return `<div class="ledger">${rows.map(([l, w, v]) => `<div class="r"><span>${l}<span class="when">${w}</span></span><span>${gbp(v)}</span></div>`).join('')}
    <div class="r"><span>Embr fee, ${pct(b.fee_rate)}<span class="when">${esc(b.fee_label)}</span></span><span>${gbp(b.embr_fee_p)}</span></div>
    <div class="r t"><span>Total</span><span>${gbp(b.total_p)}</span></div>
    <div class="r sub"><span>Deposit, 50%${b.deposit_paid_at ? ' <span style="color:var(--ok)">paid</span>' : ''}</span><span>${gbp(b.deposit_p)}</span></div>
    <div class="r sub"><span>Balance at sign-off${b.balance_paid_at ? ' <span style="color:var(--ok)">paid</span>' : ''}</span><span>${gbp(b.balance_p)}</span></div>
    ${b.refunded_p ? `<div class="r sub"><span>Refunded</span><span>${gbp(b.refunded_p)}</span></div>` : ''}
    ${r === 'ops' && b.paid_to_talent_p ? `<div class="r sub"><span>Paid to talent</span><span>${gbp(b.paid_to_talent_p)}</span></div>` : ''}</div>`;
}

function steps(b) {
  const live = !['declined', 'withdrawn', 'cancelled'].includes(b.status);
  const s = [
    ['Offer sent', true, b.created_at],
    ['Accepted', !!b.talent_agreed_at, b.talent_agreed_at],
    ['Deposit paid', !!b.deposit_paid_at, b.deposit_paid_at],
    ['Shoot day', b.status === 'wrapped' || b.status === 'completed', null, dMed(b.shoot_date)],
    ['Signed off and paid', b.status === 'completed', b.completed_at],
  ];
  const now = s.findIndex((x) => !x[1]);
  return `<div class="sched">${s.map(([l, done, at, sub], i) => `<span class="dot ${done ? 'done' : i === now && live ? 'now' : ''}"></span><span class="lbl">${l}</span><span class="xs g">${at ? dMed(at) : sub || ''}</span><span class="sub">${i === 4 && b.status === 'wrapped' && b.auto_signoff_at ? 'Signs off automatically ' + whenTxt(b.auto_signoff_at) : ''}</span>`).join('')}</div>`;
}

function footFor(b, r, me) {
  const t = b.talent, br = b.brand;
  if (b.busy) return '<span class="s g">A payment step is running. Refresh in a moment.</span>';
  if (r === 'brand') {
    if (b.status === 'offer') return `<button class="btn danger" data-a="withdraw" data-id="${b.id}">Withdraw offer</button><span class="grow"></span><span class="s g">Waiting for ${esc(first(t.name))}</span>`;
    if (b.status === 'accepted') return `<button class="btn quiet" data-a="withdraw" data-id="${b.id}">Withdraw</button><span class="grow"></span><button class="btn primary" data-a="pay" data-id="${b.id}">Pay ${gbp(b.deposit_p)} deposit</button>`;
    if (b.status === 'confirmed') return `<button class="btn quiet" data-a="cancel" data-id="${b.id}">Cancel booking</button><button class="btn quiet" data-a="problem" data-id="${b.id}">Report a problem</button><span class="grow"></span><span class="s g">${b.shoot_date > today() ? 'Shoot ' + dMed(b.shoot_date) : 'Waiting for ' + esc(first(t.name)) + ' to mark it wrapped'}</span>`;
    if (b.status === 'wrapped') return `<button class="btn quiet" data-a="problem" data-id="${b.id}">Report a problem</button><span class="grow"></span>${b.balance_checkout_url ? `<a class="btn primary" href="${esc(b.balance_checkout_url)}">Confirm ${gbp(b.balance_p)} payment</a>` : `<button class="btn primary" data-a="signoff" data-id="${b.id}">Sign off and pay ${gbp(b.balance_p)}</button>`}`;
    if (b.status === 'completed') return `<span class="grow"></span><button class="btn" data-a="offer" data-id="${t.id}">Book again</button>`;
    return '';
  }
  if (r === 'talent') {
    // the pay sits beside the decision (inDrive, Airtasker, Orb Social offer screens)
    if (b.status === 'offer') return `<div class="payline"><span class="l">You get</span><b class="money">${gbp(b.talent_fee_p)}</b><span class="xs g">0% commission · paid at sign-off</span></div><button class="btn danger" data-a="decline" data-id="${b.id}">Decline</button><span class="grow"></span><button class="btn primary" data-a="accept" data-id="${b.id}">Accept offer</button>`;
    if (b.status === 'accepted') return `<button class="btn quiet" data-a="pullout" data-id="${b.id}">I can't do it</button><span class="grow"></span><span class="s g">Waiting for ${esc(br.name)} to pay the deposit. You'll be told when it's confirmed.</span>`;
    if (b.status === 'confirmed') return `<button class="btn quiet" data-a="cancel" data-id="${b.id}">Cancel booking</button><button class="btn quiet" data-a="problem" data-id="${b.id}">Report a problem</button><span class="grow"></span>${b.shoot_date <= today() ? `<button class="btn primary" data-a="wrap" data-id="${b.id}">Mark wrapped</button>` : `<span class="s g">Mark it wrapped after the shoot on ${dMed(b.shoot_date)}</span>`}`;
    if (b.status === 'wrapped') return `<span class="s g">Waiting for ${esc(br.name)} to sign off. ${b.auto_signoff_at ? 'If they don\'t, it signs off automatically ' + whenTxt(b.auto_signoff_at) + '.' : ''}</span>`;
    return '';
  }
  // Embr staff
  const out = [];
  if (b.status === 'confirmed') out.push(`<button class="btn quiet" data-a="cancel" data-id="${b.id}">Cancel with full refund</button>`);
  if (['offer', 'accepted'].includes(b.status)) out.push(`<button class="btn quiet" data-a="withdraw" data-id="${b.id}">Withdraw offer</button>`);
  if (b.status === 'disputed') out.push(`<button class="btn" data-a="resolve" data-id="${b.id}">Split the deposit</button>`);
  if (['wrapped', 'disputed'].includes(b.status)) out.push(`<span class="grow"></span><button class="btn primary" data-a="signoff" data-id="${b.id}">Sign off and pay talent in full</button>`);
  return out.join('');
}

function sheet(b, sh = null) {
  const r = S.me.role;
  const t = b.talent, br = b.brand;
  const other = r === 'talent' ? br : t;
  const [stl, stc] = status(b);
  const ph = photoUrl(t.photo);
  const notes = [];
  if (r === 'talent' && b.status === 'offer') {
    if (!S.me.talent?.verified) notes.push(`<div class="callout act">Before you can accept, <button class="link" data-a="verify">verify your ID (18+)</button>. It takes about two minutes with your passport or driving licence.</div>`);
    else if (!S.me.talent?.payouts_enabled) notes.push(`<div class="callout act">Before you can accept, <button class="link" data-a="payouts">set up payouts</button> so Embr can pay you through Stripe.</div>`);
  }
  if (b.status === 'disputed') notes.push(`<div class="callout bad"><b>Problem reported.</b> ${esc(b.dispute_reason)}<div class="s mt4">Payments are paused. Embr will talk to both sides and decide how the money held is split, in line with the agreement.</div></div>`);
  if (b.status === 'cancelled' || b.status === 'withdrawn' || b.status === 'declined') notes.push(`<div class="callout">${stl}${b.cancel_reason ? ': ' + esc(b.cancel_reason) : '.'}${b.refunded_p ? ` ${gbp(b.refunded_p)} refunded to the brand.` : ''}${b.paid_to_talent_p && b.status === 'cancelled' ? ` ${gbp(b.paid_to_talent_p)} paid to the talent.` : ''}</div>`);
  if (r === 'brand' && b.status === 'wrapped' && !b.balance_checkout_url) notes.push(`<div class="callout act">${esc(first(t.name))} has wrapped. Sign off to pay the ${gbp(b.balance_p)} balance to the card you used for the deposit. If something went wrong, report a problem instead. It signs off automatically ${whenTxt(b.auto_signoff_at)}.</div>`);

  return {
    kind: 'sheet', label: b.title, bookingId: b.id,
    head: `<div class="grow row" style="gap:10px"><span class="st ${stc}">${esc(stl)}</span><span class="s g">${esc(b.ref)}</span></div>`,
    body: `${notes.length ? `<div class="stack mb24">${notes.join('')}</div>` : ''}
    <div class="cs-head"><div><p class="s g">${r === 'talent' ? esc(br.name) : r === 'ops' ? esc(br.name) + ' booking ' + esc(t.name) : 'Booking ' + esc(t.name)}</p><h2 class="display t-48 mt8">${esc(b.title)}</h2></div>
      <div class="cs-date"><div class="d">${dShort(b.shoot_date)}</div><div class="s g">${dWeekday(b.shoot_date)}${b.days > 1 ? ', ' + b.days + ' days' : ''}</div></div></div>
    <div class="cs-grid"><div>
      ${sh?.shoot && r === 'brand' ? `<div class="cs-sec"><button class="btn sm" data-a="shoot" data-id="${sh.shoot.id}" data-who="${b.id}">Open the shoot thread</button></div>` : ''}
      ${r === 'talent' ? talentShootSec(b, sh) : ''}
      <div class="cs-sec"><h4>The day</h4><dl class="kv"><dt>Where</dt><dd>${esc(b.location) || '<span class="g">To confirm in messages</span>'}</dd><dt>Call time</dt><dd>${esc(b.call_time) || '<span class="g">To confirm in messages</span>'}</dd>${b.usage ? `<dt>Usage</dt><dd>${esc(b.usage)}${b.usage_fee ? ' (' + pounds(b.usage_fee) + ')' : ''}</dd>` : ''}${b.content_agreed ? `<dt>Content agreed</dt><dd>${esc(b.content_agreed)}</dd>` : ''}${b.notes ? `<dt>Notes</dt><dd style="white-space:pre-wrap">${esc(b.notes)}</dd>` : ''}</dl></div>
      <div class="cs-sec"><h4>People</h4><div class="people">
        <div class="person"><div class="thumb" style="${ph ? `background-image:url('${ph}')` : ''}">${ph ? '' : esc(t.name[0] || '')}</div><div><div style="font-weight:700">${esc(t.name)}${t.verified ? ICON.tick : ''}</div><div class="s g">${b.role ? "Booked as " + esc(b.role) : esc(t.category)}, ${esc(t.city)}</div></div></div>
        <div class="person">${thumb(br, true)}<div><div style="font-weight:700">${esc(br.name)}</div><div class="s g">${esc(br.contact_name || '')}${br.instagram ? ' · ' + esc(br.instagram) : ''}</div></div></div></div></div>
      <div class="cs-sec" id="msgs"><h4>Messages</h4>
        ${r === 'talent' ? talentChangeSec(b, sh) : ''}
        <div class="thread" id="thread">${b.messages.length ? b.messages.map((m) => `<div class="bubble ${m.mine ? 'me' : 'them'}">${m.from === 'embr' && !m.mine ? '<b>Embr</b><br>' : ''}${esc(m.body)}<div class="w">${m.mine ? 'You' : m.from === 'brand' ? esc(br.name) : m.from === 'talent' ? esc(first(t.name)) : 'Embr'} · ${ago(m.at)}</div></div>`).join('') : `<p class="s g">Messages about this booking go here: call sheet details, what to bring, running late. ${['completed', 'cancelled', 'declined', 'withdrawn'].includes(b.status) ? '' : 'Keep bookings and payments on Embr so the agreement covers them.'}</p>`}</div>
        ${['declined', 'withdrawn'].includes(b.status) ? '' : `<form id="f-msg" data-id="${b.id}" class="row mt8"><input class="in" name="body" required maxlength="4000" placeholder="Write a message" aria-label="Message" autocomplete="off"><button class="btn ink" type="submit">Send</button></form>`}</div>
    </div><aside>
      <div class="cs-sec"><h4>${r === 'talent' ? 'Your pay' : 'Money'}</h4>${money(b, r)}</div>
      <div class="cs-sec"><h4>Progress</h4>${steps(b)}</div>
      <div class="cs-sec"><h4>Agreement</h4><p class="s g">${b.brand_agreed_at ? 'Brand agreed ' + dMed(b.brand_agreed_at) + '. ' : ''}${b.talent_agreed_at ? 'Talent agreed ' + dMed(b.talent_agreed_at) + '.' : 'Talent agrees when they accept.'}</p><button class="btn sm mt8" data-a="agreement" data-id="${b.id}">Read the agreement</button></div>
      ${r !== 'talent' && b.status === 'confirmed' ? `<div class="cs-sec"><h4>Cancelling</h4><p class="s g">${b.free_cancel_until >= today() ? `Free cancellation until ${dMed(b.free_cancel_until)}. After that, ${esc(first(t.name))} is paid ${gbp(b.late_cancel_p)} from the deposit.` : `Less than ${S.me.settings.free_cancel_days} days to go: if you cancel, ${esc(first(t.name))} is paid ${gbp(b.late_cancel_p)} from the deposit and the rest is refunded.`}</p></div>` : ''}
      ${r === 'ops' ? `<div class="cs-sec"><h4>History</h4><div class="log">${b.events.map((e) => `<div><span>${dMed(e.at)} ${tShort(e.at)}</span><span>${esc(e.text)}</span></div>`).join('')}</div></div>` : ''}
    </aside></div>`,
    foot: footFor(b, r),
    after: (root) => { const th = root.querySelector('#thread'); if (th) th.scrollTop = th.scrollHeight; },
  };
}

export async function openBooking(id, { replace = false } = {}) {
  const [b, sh] = await Promise.all([rpc('booking_detail', { p_id: id }), rpc('booking_shoot', { p_booking: id }).catch(() => null)]);
  const top = topLayer();
  if (replace && top?.bookingId === id) refreshTop(sheet(b, sh)); else openLayer(sheet(b, sh));
  return b;
}
const reopen = async (id) => { await openBooking(id, { replace: true }); refreshMe().catch(() => {}); rerender(); };

A.booking = async (el) => {
  const id = el.dataset.id;
  const b = await openBooking(id);
  if (el.dataset.tabto === 'messages') setTimeout(() => $('#f-msg input')?.focus(), 50);
  // back from Stripe Checkout: the webhook may take a few seconds
  const paid = new URLSearchParams(location.search).get('paid');
  if (paid) {
    history.replaceState({}, '', location.pathname);
    const want = paid === 'deposit' ? 'confirmed' : 'completed';
    if (b.status !== want) {
      toast('Payment received. Confirming with Stripe…', 6000);
      for (let i = 0; i < 10; i++) {
        await new Promise((ok) => setTimeout(ok, 1500));
        const nb = await rpc('booking_detail', { p_id: id });
        if (nb.status === want || nb.status === 'wrapped' && want === 'completed' && !nb.balance_checkout_url) { if (want === 'confirmed' && await continueShootPay(id)) return; await reopen(id); toast(want === 'confirmed' ? 'Deposit paid. The booking is confirmed.' : 'Paid. Thanks for booking through Embr.'); return; }
      }
      toast('Stripe is still confirming the payment. It will show here shortly.');
    } else if (want === 'confirmed') await continueShootPay(id);
  }
};

F['f-msg'] = async (form) => {
  const body = formData(form).body;
  await rpc('send_message', { p_id: form.dataset.id, p_body: body });
  await openBooking(form.dataset.id, { replace: true });
  setTimeout(() => $('#f-msg input')?.focus(), 30);
};

A.agreement = async (el) => {
  const b = await rpc('booking_detail', { p_id: el.dataset.id });
  openLayer({ kind: 'dialog', lg: true, head: `<h2 class="t-24">Booking agreement</h2>`, body: `<div class="agreement">${esc(b.agreement_text)}</div>` });
};

// ---------------------------------------------------------------- brand actions
A.pay = async (el) => {
  busy(el, true, 'Opening Stripe…');
  try {
    const r = await action('pay_deposit', { booking_id: el.dataset.id });
    location.href = r.url;
  } catch (e) { busy(el, false); throw e; }
};
A.signoff = async (el) => {
  const b = await rpc('booking_detail', { p_id: el.dataset.id });
  const ops = S.me.role === 'ops';
  const ok = await confirmDialog({ title: ops ? 'Sign off for the brand?' : 'Sign off and pay?',
    body: `This charges the ${gbp(b.balance_p)} balance to the card ${ops ? 'the brand' : 'you'} used for the deposit, and pays ${esc(first(b.talent.name))} ${gbp(b.talent_fee_p)} in full.`, yes: 'Sign off and pay' });
  if (!ok) return;
  const r = await action('signoff', { booking_id: b.id });
  if (r.needs_action && r.url) { toast('Your bank needs you to confirm this payment'); location.href = r.url; return; }
  toast('Signed off. ' + first(b.talent.name) + ' has been paid.');
  await reopen(b.id);
};
A.withdraw = async (el) => {
  const ok = await confirmDialog({ title: 'Withdraw this offer?', body: 'Nothing has been charged. The talent will be told.', yes: 'Withdraw offer', danger: true });
  if (!ok) return;
  await rpc('withdraw_offer', { p_id: el.dataset.id });
  await reopen(el.dataset.id);
};
A.cancel = async (el) => {
  const b = await rpc('booking_detail', { p_id: el.dataset.id });
  const r = S.me.role;
  const late = r === 'brand' && b.free_cancel_until < today();
  const body = r === 'talent' ? `${esc(b.brand.name)} gets their ${gbp(b.deposit_p)} deposit back in full. Cancelling confirmed bookings affects whether brands book you again, so only do this if you have to.`
    : r === 'ops' ? `The brand's ${gbp(b.deposit_p)} deposit is refunded in full.`
      : late ? `It's less than ${S.me.settings.free_cancel_days} days to the shoot, so ${esc(first(b.talent.name))} is paid ${gbp(b.late_cancel_p)} from your deposit and ${gbp(b.deposit_p - b.late_cancel_p)} is refunded to you.`
        : `Your ${gbp(b.deposit_p)} deposit is refunded in full.`;
  const reason = await confirmDialog({ title: 'Cancel this booking?', body, yes: 'Cancel booking', danger: true, field: { label: 'Why are you cancelling?', required: true } });
  if (!reason) return;
  await action('cancel', { booking_id: b.id, reason });
  toast('Booking cancelled');
  await reopen(b.id);
};
A.problem = async (el) => {
  const reason = await confirmDialog({ title: 'Report a problem', body: 'Payments are paused while Embr talks to both of you. Say what happened.', yes: 'Report problem', danger: true, field: { label: 'What went wrong?', required: true } });
  if (!reason) return;
  await rpc('report_problem', { p_id: el.dataset.id, p_reason: reason });
  toast('Reported. Embr will be in touch.');
  await reopen(el.dataset.id);
};

// ---------------------------------------------------------------- talent actions
A.accept = async (el) => {
  const b = await rpc('booking_detail', { p_id: el.dataset.id });
  if (!S.me.talent?.verified) return A.verify();
  if (!S.me.talent?.payouts_enabled) return A.payouts();
  openLayer({ kind: 'dialog', lg: true, head: `<h2 class="t-24">Accept “${esc(b.title)}”?</h2>`,
    body: `<p class="s g mb16">You'll be paid ${gbp(b.talent_fee_p)} in full at sign-off. ${esc(b.brand.name)} pays a deposit now to confirm.</p><div class="agreement" style="max-height:40vh">${esc(b.agreement_text)}</div>
    <form id="f-accept" data-id="${b.id}"><label class="check mt16"><input type="checkbox" name="agree" required> <span>I've read and accept the booking agreement, and I'm 18 or over.</span></label></form>`,
    foot: `<button class="btn quiet" data-a="close">Back</button><button class="btn primary" type="submit" form="f-accept">Accept offer</button>` });
};
F['f-accept'] = async (form) => {
  await rpc('respond_offer', { p_id: form.dataset.id, p_accept: true, p_agree: true });
  closeLayer();
  toast('Accepted. You\'ll be told when the deposit is paid.');
  await reopen(form.dataset.id);
};
A.decline = async (el) => {
  const reason = await confirmDialog({ title: 'Decline this offer?', body: 'The brand will be told you can\'t do it. A reason is optional.', yes: 'Decline', danger: true, field: { label: 'Reason (optional)' } });
  if (reason === null) return;
  await rpc('respond_offer', { p_id: el.dataset.id, p_accept: false, p_reason: reason === true ? null : reason });
  await reopen(el.dataset.id);
};
A.pullout = async (el) => {
  const reason = await confirmDialog({ title: 'Pull out of this booking?', body: 'Nothing has been paid yet. The brand will be told.', yes: 'Pull out', danger: true, field: { label: 'Why?', required: true } });
  if (!reason) return;
  await rpc('talent_withdraw', { p_id: el.dataset.id, p_reason: reason });
  await reopen(el.dataset.id);
};
A.wrap = async (el) => {
  const ok = await confirmDialog({ title: 'Mark the job wrapped?', body: `The brand then has ${S.me.settings.auto_signoff_hours} hours to sign off or report a problem. If they do neither, it signs off automatically and you're paid.`, yes: 'Mark wrapped' });
  if (!ok) return;
  await rpc('mark_wrapped', { p_id: el.dataset.id });
  toast('Marked wrapped');
  await reopen(el.dataset.id);
};

// ---------------------------------------------------------------- Embr staff
A.resolve = async (el) => {
  const b = await rpc('booking_detail', { p_id: el.dataset.id });
  const max = Math.min(b.deposit_p, b.talent_fee_p);
  openLayer({ kind: 'dialog', head: '<h2 class="t-24">Split the deposit</h2>',
    body: `<p class="s g">${gbp(b.deposit_p)} is held. Choose how much goes to ${esc(b.talent.name)}; the rest is refunded to ${esc(b.brand.name)}. To pay the talent in full, sign off instead.</p>
    <form id="f-resolve" data-id="${b.id}"><label class="field mt16">To the talent, £<input class="in" type="number" name="talent" min="0" max="${max / 100}" step="0.01" value="${(max / 100).toFixed(2)}" required></label>
    <label class="field mt16">Note for the record<textarea class="in" name="note" required placeholder="What both sides said and why"></textarea></label></form>`,
    foot: `<button class="btn quiet" data-a="close">Back</button><button class="btn ink" type="submit" form="f-resolve">Pay out and refund</button>` });
};
F['f-resolve'] = async (form) => {
  const d = formData(form);
  await action('resolve', { booking_id: form.dataset.id, talent_p: Math.round(parseFloat(d.talent) * 100), note: d.note });
  closeLayer();
  toast('Resolved');
  await reopen(form.dataset.id);
};
