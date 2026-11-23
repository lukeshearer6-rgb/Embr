// Embr money logic. Runtime-agnostic: works in Supabase Edge Functions (Deno)
// and in the local test server (Node). Everything that moves money is here.
//
// Model: "separate charges and transfers" on Stripe Connect.
//  * The brand pays a 50% deposit by card (Stripe Checkout). The card is saved
//    so the balance can be charged at sign-off without the brand coming back.
//  * The money sits in Embr's Stripe balance until sign-off.
//  * At sign-off Embr charges the balance and transfers the full talent fee to
//    the talent's connected Stripe account. Embr keeps only the brand fee.
//  * Every Stripe call uses an idempotency key, so a retry never pays twice.

export type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<any>;
export type Env = Record<string, string | undefined>;

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

const gbp = (p: number) => '£' + (p % 100 === 0 ? (p / 100).toLocaleString('en-GB') : (p / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const day = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const appUrl = (env: Env) => (env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
const chargeId = (c: any) => (typeof c === 'string' ? c : c?.id) || null;

async function booking(rpc: Rpc, id: string) {
  const b = await rpc('svc_booking', { p_id: id });
  if (!b) throw new HttpError(404, 'Booking not found');
  return b;
}

async function withLock<T>(rpc: Rpc, id: string, states: string[], fn: () => Promise<T>): Promise<T> {
  const got = await rpc('svc_lock', { p_id: id, p_states: states });
  if (!got) throw new HttpError(409, 'This booking is being updated or has already moved on. Refresh and try again.');
  try { return await fn(); } catch (e) { await rpc('svc_unlock', { p_id: id }); throw e; }
}

// ---------------------------------------------------------------- talent: payouts (Stripe Connect)
export async function connectOnboard(stripe: any, rpc: Rpc, env: Env, userId: string) {
  const t = await rpc('svc_talent', { p_user: userId });
  if (!t) throw new HttpError(403, 'Only talent accounts set up payouts');
  let account = t.stripe_account;
  if (!account) {
    const a = await stripe.accounts.create({
      type: 'express',
      country: 'GB',
      email: t.email,
      business_type: 'individual',
      capabilities: { transfers: { requested: true } },
      business_profile: { product_description: 'Freelance modelling and creative work booked through Embr', mcc: '7929' },
      metadata: { user_id: userId },
    }, { idempotencyKey: 'acct-' + userId });
    account = a.id;
    await rpc('svc_set_stripe_account', { p_user: userId, p_account: account });
  }
  const link = await stripe.accountLinks.create({
    account,
    type: 'account_onboarding',
    refresh_url: appUrl(env) + '/wallet?stripe=refresh',
    return_url: appUrl(env) + '/wallet?stripe=done',
  });
  return { url: link.url };
}

export async function connectRefresh(stripe: any, rpc: Rpc, userId: string) {
  const t = await rpc('svc_talent', { p_user: userId });
  if (!t?.stripe_account) return { payouts_enabled: false };
  const a = await stripe.accounts.retrieve(t.stripe_account);
  const enabled = !!(a.payouts_enabled && a.capabilities?.transfers === 'active');
  await rpc('svc_account_updated', { p_account: a.id, p_payouts: enabled });
  return { payouts_enabled: enabled, details_submitted: !!a.details_submitted };
}

export async function connectDashboard(stripe: any, rpc: Rpc, userId: string) {
  const t = await rpc('svc_talent', { p_user: userId });
  if (!t?.stripe_account) throw new HttpError(400, 'Set up payouts first');
  const l = await stripe.accounts.createLoginLink(t.stripe_account);
  return { url: l.url };
}

// ---------------------------------------------------------------- talent: 18+ ID check (Stripe Identity)
export async function identityStart(stripe: any, rpc: Rpc, env: Env, userId: string) {
  const t = await rpc('svc_talent', { p_user: userId });
  if (!t) throw new HttpError(403, 'Only talent accounts need an ID check');
  if (t.age_verified) return { verified: true };
  const s = await stripe.identity.verificationSessions.create({
    type: 'document',
    options: { document: { require_matching_selfie: true, allowed_types: ['driving_license', 'passport', 'id_card'] } },
    metadata: { user_id: userId },
    return_url: appUrl(env) + '/profile?id=done',
  });
  await rpc('svc_set_identity_session', { p_user: userId, p_session: s.id });
  return { url: s.url };
}

export async function identitySync(stripe: any, rpc: Rpc, sessionId: string, userId?: string) {
  const s = await stripe.identity.verificationSessions.retrieve(sessionId, { expand: ['verified_outputs'] });
  const user = userId || s.metadata?.user_id;
  if (!user) return;
  const dob = s.verified_outputs?.dob;
  const dobStr = dob?.year ? `${dob.year}-${String(dob.month).padStart(2, '0')}-${String(dob.day).padStart(2, '0')}` : null;
  await rpc('svc_identity_result', { p_user: user, p_session: s.id, p_status: s.status, p_dob: dobStr });
  return s.status;
}

export async function identityRefresh(stripe: any, rpc: Rpc, userId: string) {
  const t = await rpc('svc_talent', { p_user: userId });
  if (!t?.identity_session) return { status: null };
  return { status: await identitySync(stripe, rpc, t.identity_session, userId) };
}

// ---------------------------------------------------------------- brand: pay the deposit
export async function payDeposit(stripe: any, rpc: Rpc, env: Env, userId: string, bookingId: string) {
  const b = await booking(rpc, bookingId);
  if (b.brand_id !== userId) throw new HttpError(403, 'Only the brand on this booking can pay');
  if (b.status !== 'accepted') throw new HttpError(409, b.status === 'confirmed' ? 'The deposit is already paid' : 'This booking isn\'t waiting for a deposit');
  if (!b.talent_stripe_account || !b.talent_payouts) throw new HttpError(409, 'The talent needs to finish their payout setup first. Embr has been told.');
  let customer = b.brand_customer;
  if (!customer) {
    const c = await stripe.customers.create({ email: b.brand_email, name: b.brand_name, metadata: { brand_id: b.brand_id } },
      { idempotencyKey: 'cus-' + b.brand_id });
    customer = c.id;
    await rpc('svc_set_customer', { p_brand: b.brand_id, p_customer: customer });
  }
  const desc = `${b.title} with ${b.talent_name}, ${day(b.shoot_date)} (${b.ref})`;
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer,
    payment_method_types: ['card'],
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'gbp',
        unit_amount: b.deposit_p,
        product_data: { name: 'Deposit: ' + b.title, description: `${b.talent_name}, ${day(b.shoot_date)}. 50% of ${gbp(b.total_p)}. The ${gbp(b.balance_p)} balance is charged to this card at sign-off.` },
      },
    }],
    payment_intent_data: {
      setup_future_usage: 'off_session',
      transfer_group: b.id,
      description: 'Deposit: ' + desc,
      metadata: { booking_id: b.id, kind: 'deposit' },
    },
    metadata: { booking_id: b.id, kind: 'deposit' },
    success_url: appUrl(env) + '/booking/' + b.id + '?paid=deposit',
    cancel_url: appUrl(env) + '/booking/' + b.id,
  });
  await rpc('svc_set_deposit_checkout', { p_id: b.id, p_session: session.id });
  return { url: session.url };
}

// Called from the webhook when Checkout completes (deposit or balance).
export async function checkoutCompleted(stripe: any, rpc: Rpc, session: any) {
  const id = session.metadata?.booking_id;
  const kind = session.metadata?.kind;
  if (!id || !kind || session.payment_status !== 'paid') return 'ignored';
  const pi = await stripe.paymentIntents.retrieve(session.payment_intent, { expand: ['latest_charge'] });
  if (kind === 'deposit') {
    const ok = await rpc('svc_deposit_paid', { p_id: id, p_intent: pi.id, p_charge: chargeId(pi.latest_charge), p_pm: typeof pi.payment_method === 'string' ? pi.payment_method : pi.payment_method?.id });
    if (!ok) {
      // Paid twice, or the booking was cancelled while the brand was paying: give it back.
      await stripe.refunds.create({ payment_intent: pi.id }, { idempotencyKey: 'dup-' + pi.id });
      return 'refunded';
    }
    return 'deposit';
  }
  if (kind === 'balance') {
    const b = await booking(rpc, id);
    if (b.status === 'completed') return 'already';
    const t = await payTalent(stripe, b, chargeId(pi.latest_charge));
    await rpc('svc_completed', { p_id: id, p_intent: pi.id, p_charge: chargeId(pi.latest_charge), p_transfers: t.ids, p_paid_p: t.paid, p_kind: session.metadata?.signoff || 'brand' });
    return 'balance';
  }
  return 'ignored';
}

// ---------------------------------------------------------------- sign-off: charge the balance, pay talent
async function payTalent(stripe: any, b: any, balanceCharge: string | null) {
  if (!b.talent_stripe_account) throw new HttpError(409, 'The talent has no payout account');
  const ids: string[] = [];
  const fromDeposit = Math.min(b.talent_fee_p, b.deposit_p);
  const fromBalance = b.talent_fee_p - fromDeposit;
  const meta = { booking_id: b.id, ref: b.ref };
  if (fromDeposit > 0) {
    const t = await stripe.transfers.create({ amount: fromDeposit, currency: 'gbp', destination: b.talent_stripe_account, transfer_group: b.id,
      source_transaction: b.deposit_charge, description: `${b.ref} ${b.title}`, metadata: meta }, { idempotencyKey: 'tr-dep-' + b.id });
    ids.push(t.id);
  }
  if (fromBalance > 0) {
    const t = await stripe.transfers.create({ amount: fromBalance, currency: 'gbp', destination: b.talent_stripe_account, transfer_group: b.id,
      ...(balanceCharge ? { source_transaction: balanceCharge } : {}), description: `${b.ref} ${b.title}`, metadata: meta }, { idempotencyKey: 'tr-bal-' + b.id });
    ids.push(t.id);
  }
  return { ids, paid: fromDeposit + fromBalance };
}

export async function signoff(stripe: any, rpc: Rpc, env: Env, bookingId: string, kind: 'brand' | 'auto' | 'ops', userId?: string) {
  const b = await booking(rpc, bookingId);
  if (kind === 'brand' && b.brand_id !== userId) throw new HttpError(403, 'Only the brand on this booking can sign off');
  const states = kind === 'ops' ? ['wrapped', 'disputed'] : ['wrapped'];
  if (!states.includes(b.status)) throw new HttpError(409, b.status === 'completed' ? 'Already signed off' : 'This booking can\'t be signed off yet');
  if (b.balance_checkout_url && kind !== 'ops') return { needs_action: true, url: b.balance_checkout_url };
  return withLock(rpc, b.id, states, async () => {
    let pi: any = null;
    if (b.balance_p > 0) {
      try {
        pi = await stripe.paymentIntents.create({
          amount: b.balance_p, currency: 'gbp', customer: b.brand_customer, payment_method: b.payment_method,
          off_session: true, confirm: true, transfer_group: b.id,
          description: `Balance: ${b.title} with ${b.talent_name} (${b.ref})`,
          metadata: { booking_id: b.id, kind: 'balance' },
        }, { idempotencyKey: 'bal-' + b.id });
      } catch (e: any) {
        // The bank wants the brand to confirm (or the card failed): send them to Checkout.
        const session = await stripe.checkout.sessions.create({
          mode: 'payment', customer: b.brand_customer, payment_method_types: ['card'],
          line_items: [{ quantity: 1, price_data: { currency: 'gbp', unit_amount: b.balance_p, product_data: { name: 'Balance: ' + b.title, description: `${b.talent_name}, ${day(b.shoot_date)} (${b.ref})` } } }],
          payment_intent_data: { transfer_group: b.id, metadata: { booking_id: b.id, kind: 'balance' } },
          metadata: { booking_id: b.id, kind: 'balance', signoff: kind },
          success_url: appUrl(env) + '/booking/' + b.id + '?paid=balance',
          cancel_url: appUrl(env) + '/booking/' + b.id,
        });
        await rpc('svc_balance_checkout', { p_id: b.id, p_session: session.id, p_url: session.url });
        return { needs_action: true, url: session.url, reason: e?.code || e?.message };
      }
      if (pi.status !== 'succeeded') throw new HttpError(402, 'The balance payment didn\'t go through');
    }
    const t = await payTalent(stripe, b, pi ? chargeId(pi.latest_charge) : null);
    await rpc('svc_completed', { p_id: b.id, p_intent: pi?.id || null, p_charge: pi ? chargeId(pi.latest_charge) : null, p_transfers: t.ids, p_paid_p: t.paid, p_kind: kind });
    return { ok: true, paid_to_talent_p: t.paid };
  });
}

// ---------------------------------------------------------------- cancel a confirmed booking
export function cancelSplit(b: any, by: 'brand' | 'talent' | 'ops') {
  if (by !== 'brand' || b.days_to_shoot >= b.free_cancel_days) return { refund: b.deposit_p, talent: 0 };
  const talent = Math.min(b.deposit_p, Math.round(b.session_p * Number(b.late_cancel_share)));
  return { refund: b.deposit_p - talent, talent };
}

export async function cancel(stripe: any, rpc: Rpc, userId: string, bookingId: string, reason: string) {
  const b = await booking(rpc, bookingId);
  const role = await rpc('svc_role_of', { p_user: userId });
  const by: any = role === 'ops' ? 'ops' : b.brand_id === userId ? 'brand' : b.talent_id === userId ? 'talent' : null;
  if (!by) throw new HttpError(404, 'Booking not found');
  if (b.status !== 'confirmed') throw new HttpError(409, 'Only a confirmed booking can be cancelled here');
  return withLock(rpc, b.id, ['confirmed'], async () => {
    const split = cancelSplit(b, by);
    const refundIds: string[] = [], transferIds: string[] = [];
    if (split.refund > 0) {
      const r = await stripe.refunds.create({ payment_intent: b.deposit_intent, amount: split.refund, metadata: { booking_id: b.id } }, { idempotencyKey: 'refund-' + b.id });
      refundIds.push(r.id);
    }
    if (split.talent > 0) {
      const t = await stripe.transfers.create({ amount: split.talent, currency: 'gbp', destination: b.talent_stripe_account, transfer_group: b.id,
        source_transaction: b.deposit_charge, description: `${b.ref} late cancellation`, metadata: { booking_id: b.id } }, { idempotencyKey: 'tr-cancel-' + b.id });
      transferIds.push(t.id);
    }
    await rpc('svc_cancelled', { p_id: b.id, p_by: by, p_reason: reason || null, p_refund_ids: refundIds, p_refunded_p: split.refund, p_transfers: transferIds, p_paid_p: split.talent });
    return { ok: true, refunded_p: split.refund, paid_to_talent_p: split.talent };
  });
}

// ---------------------------------------------------------------- Embr resolves a reported problem
// Splits the deposit that's held. To pay the talent in full, Embr signs off instead.
export async function resolve(stripe: any, rpc: Rpc, userId: string, bookingId: string, talentP: number, note: string) {
  if ((await rpc('svc_role_of', { p_user: userId })) !== 'ops') throw new HttpError(403, 'Embr staff only');
  const b = await booking(rpc, bookingId);
  if (b.status !== 'disputed') throw new HttpError(409, 'Only a booking with a reported problem can be resolved');
  talentP = Math.round(Number(talentP) || 0);
  if (talentP < 0 || talentP > Math.min(b.deposit_p, b.talent_fee_p)) throw new HttpError(400, 'The talent amount must be between £0 and ' + gbp(Math.min(b.deposit_p, b.talent_fee_p)));
  return withLock(rpc, b.id, ['disputed'], async () => {
    const refundIds: string[] = [], transferIds: string[] = [];
    const refund = b.deposit_p - talentP;
    if (refund > 0) {
      const r = await stripe.refunds.create({ payment_intent: b.deposit_intent, amount: refund, metadata: { booking_id: b.id } }, { idempotencyKey: 'refund-resolve-' + b.id });
      refundIds.push(r.id);
    }
    if (talentP > 0) {
      const t = await stripe.transfers.create({ amount: talentP, currency: 'gbp', destination: b.talent_stripe_account, transfer_group: b.id,
        source_transaction: b.deposit_charge, description: `${b.ref} resolved`, metadata: { booking_id: b.id } }, { idempotencyKey: 'tr-resolve-' + b.id });
      transferIds.push(t.id);
    }
    await rpc('svc_resolved', { p_id: b.id, p_refund_ids: refundIds, p_refunded_p: refund, p_transfers: transferIds, p_paid_p: talentP, p_note: note || null });
    return { ok: true, refunded_p: refund, paid_to_talent_p: talentP };
  });
}

// ---------------------------------------------------------------- webhook events
export async function handleEvent(stripe: any, rpc: Rpc, event: any) {
  if (await rpc('svc_event_seen', { p_id: event.id, p_type: event.type })) return 'duplicate';
  const o = event.data.object;
  switch (event.type) {
    case 'checkout.session.completed':
      return checkoutCompleted(stripe, rpc, o);
    case 'account.updated':
      await rpc('svc_account_updated', { p_account: o.id, p_payouts: !!(o.payouts_enabled && o.capabilities?.transfers === 'active') });
      return 'account';
    case 'identity.verification_session.verified':
    case 'identity.verification_session.requires_input':
    case 'identity.verification_session.canceled':
      await identitySync(stripe, rpc, o.id);
      return 'identity';
    default:
      return 'ignored';
  }
}

// ---------------------------------------------------------------- auto sign-off (cron)
export async function autoSignoff(stripe: any, rpc: Rpc, env: Env) {
  const ids: string[] = (await rpc('svc_due_autosignoff')) || [];
  const out: any[] = [];
  for (const row of ids) {
    const id = typeof row === 'string' ? row : (row as any).svc_due_autosignoff || (row as any).id;
    try { out.push({ id, ...(await signoff(stripe, rpc, env, id, 'auto')) }); }
    catch (e: any) { out.push({ id, error: e.message }); }
  }
  return out;
}
