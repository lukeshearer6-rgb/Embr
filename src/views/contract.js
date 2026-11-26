// Booking contract: usage in plain English, the talent's "Review and sign" sheet, and the signed record.
// The agreement text itself is built in the database (_agreement, migration 20261126000001), so what
// people sign can't drift from what's stored. This file only shows it and collects the signature.
// Pattern (Mobbin, 26 Nov 2026): summary above the terms, one tick, one primary button that stays off
// until the tick and the typed name are there (Target, Forest, Coinbase); full text one tap away (Vivid).
import { A, C, F, S } from '../state.js';
import { rpc } from '../api.js';
import { $, esc, gbp, pounds, dMed, dLong, tShort, openLayer, closeLayer, toast, first, dRangeLong, andList } from '../ui.js';

// keep in step with _usage_label() and _usage_area() in the database
export const USAGE_WHERE = [
  ['social', 'Own social posts', 'Posts on their own Instagram, TikTok and similar. Not paid ads.'],
  ['paid_social', 'Paid social ads', 'Ads they pay to show people on social apps and other websites.'],
  ['web', 'Website and shop', 'Their website and product pages.'],
  ['email', 'Emails', 'Their emails and newsletters.'],
  ['print', 'In-store and print', 'Posters in their shops, lookbooks, flyers.'],
  ['outdoor', 'Billboards and outdoor', 'Billboards, bus stops, street posters and screens.'],
  ['tv', 'TV and cinema', 'Ads on TV, streaming services and in cinemas.'],
  ['packaging', 'Packaging', 'On the product box or bag itself.'],
];
export const USAGE_MONTHS = [3, 6, 12, 24]; // presets; any whole number from 1 to 120 can be typed (custom)
export const monthsTxt = (m) => `${m} month${+m === 1 ? '' : 's'}`;
const okMonths = (m) => Number.isInteger(m) && m >= 1 && m <= 120;
export const USAGE_AREA = [['uk', 'UK only', 'the UK'], ['europe', 'UK and Europe', 'the UK and Europe'], ['world', 'Worldwide', 'anywhere in the world']];
export const DRAFT_NOTE = 'Draft terms for the invite-only pilot, waiting for solicitor review.';

const label = (k) => USAGE_WHERE.find((w) => w[0] === k);
const area = (k) => USAGE_AREA.find((a) => a[0] === k) || USAGE_AREA[0];
const hasTerms = (u) => u && Array.isArray(u.where) && u.where.length > 0;

// Old one-line usage ("Instagram and TikTok, 12 months") becomes the closest structured pick, so a brief
// or draft made before this change still opens with something sensible picked.
export function usageFrom(v) {
  if (hasTerms(v)) return v;
  const s = String(v || '').toLowerCase();
  const where = [];
  if (/instagram|tiktok|social/.test(s) && !/paid/.test(s)) where.push('social');
  if (/paid/.test(s)) where.push('paid_social');
  if (/website|shop/.test(s)) where.push('web');
  if (/email|newsletter/.test(s)) where.push('email');
  if (/poster|print/.test(s)) where.push('print');
  if (/all of it/.test(s)) where.push('social', 'paid_social', 'web', 'email', 'print');
  const m = +(s.match(/(\d+)\s*months?/) || [])[1];
  return { where: where.length ? where : ['social'], months: okMonths(m) ? m : 12, area: 'uk' };
}

// The picker: where (several), how long (one), which countries (one), with a live sentence underneath.
// Used on the brand offer form, the shoot roster and the talent's booking link form.
export function usagePicker(v, { who = 'brand', hours = '', noHours = false } = {}) {
  const u = usageFrom(v);
  const custom = !USAGE_MONTHS.includes(u.months);
  const chip = (grp, k, txt, on) => `<button type="button" class="chip" data-a="usage-pick" data-grp="${grp}" data-k="${k}" aria-pressed="${on}">${esc(txt)}</button>`;
  return `<div class="usagepick">
    <fieldset class="fsec"><legend class="s">Where ${who === 'brand' ? 'you\'ll' : 'they can'} use the photos <span class="hint">Pick everything that applies</span></legend>
      <div class="chips mt8">${USAGE_WHERE.map(([k, l]) => chip('where', k, l, u.where.includes(k))).join('')}</div></fieldset>
    <fieldset class="fsec mt16"><legend class="s">For how long <span class="hint">From the day it first goes live</span></legend>
      <div class="chips mt8">${USAGE_MONTHS.map((m) => chip('months', m, monthsTxt(m), u.months === m)).join('')}${chip('months', 'custom', 'Custom', custom)}</div>
      <label class="field mt8 usage-custom" ${custom ? '' : 'hidden'}>Number of months <span class="hint">1 to 120, for example 5 or 18</span><input class="in" type="number" inputmode="numeric" name="usage_months" min="1" max="120" step="1" value="${custom ? u.months : ''}" placeholder="18" data-input="usage-say"></label></fieldset>
    <fieldset class="fsec mt16"><legend class="s">Which countries</legend>
      <div class="chips mt8">${USAGE_AREA.map(([k, l]) => chip('area', k, l, u.area === k)).join('')}</div></fieldset>
    ${noHours ? '' : `<label class="field mt16">Hours a day <span class="hint">Including breaks. Longer days are agreed in messages first.</span><input class="in" type="number" name="day_hours" min="1" max="16" placeholder="10" value="${esc(hours)}" data-input="usage-say"></label>`}
    <div class="usage-say panel mt16" aria-live="polite">${usageSay(u, who)}</div>
  </div>`;
}

export const usageOk = (u) => hasTerms(u) && okMonths(u.months);
export function readUsage(root) {
  const on = (g) => [...root.querySelectorAll(`[data-a=usage-pick][data-grp=${g}][aria-pressed=true]`)].map((b) => b.dataset.k);
  const pick = on('months')[0] || '12';
  const months = pick === 'custom' ? Math.round(+root.querySelector('[name=usage_months]')?.value || 0) : +pick;
  return { where: on('where'), months, area: on('area')[0] || 'uk' };
}

// What the talent reads. "you" is the talent; the brand reads the same with "the talent's".
export function usageLines(u) {
  if (!hasTerms(u)) return [];
  const a = area(u.area)[2];
  return [
    ...u.where.map((k) => label(k)?.[2]).filter(Boolean),
    `For ${monthsTxt(u.months)} from the day it first goes live. If nothing has gone live 6 months after the shoot, the ${monthsTxt(u.months)} start then.`,
    `In ${a}. Their own posts can be seen from anywhere.`,
    'Shorter edits, crops and stills from the video are included.',
    'When the time runs out, old posts can stay up, but nothing new goes out and paid ads stop.',
    'No AI changes and never used to train AI, unless you both agree in writing in Embr.',
  ];
}

function usageSay(u, who) {
  if (!hasTerms(u)) return '<p class="s g">Pick at least one place to use the photos.</p>';
  if (!okMonths(u.months)) return '<p class="s g">Type how many months, from 1 to 120.</p>';
  const names = u.where.map((k) => label(k)?.[1].toLowerCase()).filter(Boolean);
  const list = names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names.at(-1);
  return `<p class="s"><b>${who === 'brand' ? 'The talent will read' : 'The brand will read'}:</b> ${esc(list.charAt(0).toUpperCase() + list.slice(1))}, for ${monthsTxt(u.months)} from the day it first goes live, in ${esc(area(u.area)[2])}. Old posts can stay up after that, but nothing new goes out.</p>
    <p class="xs g mt4">Anything else needs a new booking. ${DRAFT_NOTE}</p>`;
}

A['usage-pick'] = (el) => {
  const root = el.closest('.usagepick');
  if (el.dataset.grp === 'where') el.setAttribute('aria-pressed', el.getAttribute('aria-pressed') !== 'true');
  else root.querySelectorAll(`[data-a=usage-pick][data-grp=${el.dataset.grp}]`).forEach((b) => b.setAttribute('aria-pressed', b === el));
  if (el.dataset.grp === 'months') {
    const box = root.querySelector('.usage-custom');
    box.hidden = el.dataset.k !== 'custom';
    if (!box.hidden) box.querySelector('input').focus();
  }
  sayAgain(root);
};
C['usage-say'] = (el) => sayAgain(el.closest('.usagepick'));
// screens that keep drafts (the shoot roster) listen for 'usagechange' to save the picks
function sayAgain(root) {
  if (!root) return;
  const who = root.closest('form')?.dataset.who || 'brand';
  root.querySelector('.usage-say').innerHTML = usageSay(readUsage(root), who);
  root.dispatchEvent(new CustomEvent('usagechange', { bubbles: true }));
}

// ---------------------------------------------------------------- talent: review and sign
const kv = (rows) => `<dl class="kv">${rows.filter(Boolean).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;

export function reviewSheet(b) {
  const lines = usageLines(b.usage_terms);
  const st = S.me.settings;
  return {
    kind: 'sheet', label: 'Review and sign',
    head: `<div class="grow s g">${esc(b.ref)} · ${esc(b.brand.name)}</div>`,
    body: `<h2 class="display t-48">Review and sign</h2>
    <p class="s g mt8 measure">This is your booking agreement with ${esc(b.brand.name)}. Check the summary, open the full terms if you want them, then sign with your name.</p>
    <div class="sign-sum mt24">
      <section class="cs-sec"><h4>What you're paid</h4><p class="t-24 money">${gbp(b.talent_fee_p)}</p>
        <p class="s g">${b.days} day${b.days > 1 ? 's' : ''} at ${pounds(b.day_rate)}${b.usage_fee ? ' for your time, plus a ' + pounds(b.usage_fee) + ' usage fee for the photos' : ''}. Paid in full at sign-off, or automatically ${st.auto_signoff_hours} hours after you mark it wrapped.</p></section>
      <section class="cs-sec"><h4>Your day</h4>${kv([
        ['When', esc(dRangeLong(b.shoot_date, b.days))],
        b.roles?.length ? ['Booked as', esc(andList(b.roles))] : null,
        ['Hours', b.day_hours ? `Up to ${b.day_hours} a day, including breaks` : 'To agree in messages'],
        ['Where', esc(b.location) || 'To confirm in messages'],
        ['Call time', esc(b.call_time) || 'To confirm in messages'],
        ['You\'ll be asked to', esc(b.content_agreed) || 'What\'s described in the job. Nothing else can be asked on the day.'],
      ])}</section>
      <section class="cs-sec"><h4>What ${esc(b.brand.name)} can do with your photos</h4>
        ${lines.length ? `<ul class="plain-list">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : `<p class="s">${esc(b.usage || 'Nothing beyond their own internal use.')}</p><p class="xs g mt4">Anything else needs a new booking through Embr.</p>`}</section>
      <section class="cs-sec"><h4>If plans change</h4><p class="s">If ${esc(b.brand.name)} cancels ${st.free_cancel_days} or more days before, nothing is owed. Closer to the day, you're paid ${gbp(b.late_cancel_p)} of the session fee. You can pull out before the deposit is paid.</p></section>
    </div>
    <details class="fullterms mt16"><summary class="btn sm">Read the full agreement</summary><div class="agreement mt12">${esc(b.agreement_text)}</div></details>
    <form id="f-sign" data-id="${b.id}" class="mt24" style="max-width:520px">
      <label class="field">Type your full name to sign<input class="in sign-in" name="sign_name" required autocomplete="name" maxlength="120" placeholder="${esc(S.me.talent?.name || 'Your full name')}" data-input="sign-ready"></label>
      <label class="check mt16"><input type="checkbox" name="agree" required data-change="sign-ready"> <span>I've read the agreement and I'm 18 or over. Typing my name here is my signature, the same as signing on paper.</span></label>
      <p class="xs g mt8">${DRAFT_NOTE} You and ${esc(b.brand.name)} can both save a copy from the booking.</p>
    </form>`,
    foot: `<button class="btn quiet" data-a="close">Back</button><span class="grow"></span><button class="btn primary" type="submit" form="f-sign" id="sign-btn" disabled>Sign and accept</button>`,
  };
}

C['sign-ready'] = () => {
  const f = $('#f-sign'); const btn = $('#sign-btn');
  if (!f || !btn) return;
  btn.disabled = !(f.agree.checked && f.sign_name.value.replace(/[^\p{L}]/gu, '').length >= 2);
};

F['f-sign'] = async (form) => {
  await rpc('respond_offer', { p_id: form.dataset.id, p_accept: true, p_agree: !!form.agree.checked, p_sign_name: form.sign_name.value });
  closeLayer();
  toast('Signed and accepted. You\'ll be told when the deposit is paid.');
  document.dispatchEvent(new CustomEvent('embr:signed', { detail: form.dataset.id }));
};

// ---------------------------------------------------------------- the signed record and a copy to keep
export function signedRecord(b) {
  const rows = [];
  if (b.brand_agreed_at) rows.push(`${esc(b.brand.name)} agreed when sending the offer, ${dMed(b.brand_agreed_at)} at ${tShort(b.brand_agreed_at)}.`);
  if (b.talent_agreed_at) rows.push(b.talent_signed_name
    ? `${esc(first(b.talent.name))} signed as “${esc(b.talent_signed_name)}”, ${dMed(b.talent_agreed_at)} at ${tShort(b.talent_agreed_at)}.`
    : `${esc(first(b.talent.name))} agreed ${dMed(b.talent_agreed_at)}.`);
  else rows.push(`${esc(first(b.talent.name))} signs when they accept.`);
  return rows.map((r) => `<p class="s g">${r}</p>`).join('');
}

function copyText(b) {
  const lines = [b.agreement_text, '', '----', 'SIGNED IN EMBR'];
  if (b.brand_agreed_at) lines.push(`Client: ${b.brand.name} agreed by sending the offer on ${new Date(b.brand_agreed_at).toLocaleString('en-GB')}.`);
  if (b.talent_agreed_at) lines.push(`Talent: ${b.talent_signed_name ? `signed as "${b.talent_signed_name}"` : 'agreed'} on ${new Date(b.talent_agreed_at).toLocaleString('en-GB')}.`);
  else lines.push('Talent: not signed yet.');
  if (b.agreement_version) lines.push(`Version: ${b.agreement_version}`);
  if (b.agreement_sha) lines.push(`Fingerprint of the signed text (SHA-256): ${b.agreement_sha}`);
  lines.push(`Saved ${new Date().toLocaleString('en-GB')}.`);
  return lines.join('\n');
}

export function agreementDialog(b) {
  openLayer({ kind: 'dialog', lg: true, head: `<h2 class="t-24">Booking agreement</h2>`,
    body: `<div class="stack mb16">${signedRecord(b)}</div><div class="agreement">${esc(b.agreement_text)}</div>
      ${b.agreement_sha ? `<p class="xs g mt12" style="word-break:break-all">Fingerprint of the signed text: ${esc(b.agreement_sha)}</p>` : ''}`,
    foot: `<span class="grow xs g">${DRAFT_NOTE}</span><button class="btn" data-a="agreement-copy" data-id="${b.id}">Save a copy</button>` });
}

A['agreement-copy'] = async (el) => {
  const b = await rpc('booking_detail', { p_id: el.dataset.id });
  const blob = new Blob([copyText(b)], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Embr-${b.ref}-agreement.txt`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Copy saved to your downloads');
};

// ---------------------------------------------------------------- skills on one booking
// A creative who models and makes UGC can be booked for both in one offer (Luke's snag list, 2026-11-26).
// Multi-select chips, the same control as "Where you'll use the photos"; at least one stays picked.
export function skillPicker(roles, picked, { label = 'Booking them as', crew = '' } = {}) {
  const on = picked?.length ? picked : roles.slice(0, 1);
  return `<fieldset class="fsec skillpick"${crew ? ` data-crew="${esc(crew)}"` : ''}><legend class="s">${esc(label)} <span class="hint">Pick every skill you need from them on the day</span></legend>
    <div class="chips mt8">${roles.map((r) => `<button type="button" class="chip" data-a="skill-pick" data-k="${esc(r)}" aria-pressed="${on.includes(r)}">${esc(r)}</button>`).join('')}</div></fieldset>`;
}
export const readSkills = (root) => [...root.querySelectorAll('[data-a=skill-pick][aria-pressed=true]')].map((b) => b.dataset.k);
A['skill-pick'] = (el) => {
  const box = el.closest('.skillpick');
  const was = el.getAttribute('aria-pressed') === 'true';
  if (was && readSkills(box).length === 1) return toast('Keep at least one skill picked');
  el.setAttribute('aria-pressed', String(!was));
  box.dispatchEvent(new CustomEvent('skillchange', { bubbles: true }));
};
