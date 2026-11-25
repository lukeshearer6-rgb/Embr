// A small in-memory stand-in for the parts of Stripe Embr uses.
// LOCAL TESTING ONLY: lets the whole booking flow run without network access.
// Hosted pages (Checkout, Connect onboarding, Identity) are served by the
// dev server under /__fake_stripe/.
let n = 0;
const id = (p) => `${p}_test${(++n).toString().padStart(5, '0')}`;

export function createFakeStripe(baseUrl) {
  const st = { accounts: {}, customers: {}, sessions: {}, intents: {}, charges: {}, transfers: [], refunds: [], identity: {}, idem: {}, needsAuth: new Set(), ledger: [] };
  const once = (key, fn) => {
    if (key && st.idem[key]) return st.idem[key];
    const r = fn();
    if (key) st.idem[key] = r;
    return r;
  };
  const opt = (o) => o?.idempotencyKey;
  const chargeFor = (pi) => {
    const ch = { id: id('ch'), amount: pi.amount, payment_intent: pi.id, refunded: 0 };
    st.charges[ch.id] = ch;
    pi.latest_charge = ch.id;
    pi.status = 'succeeded';
    st.ledger.push({ type: 'charge', amount: pi.amount, charge: ch.id, kind: pi.metadata?.kind, booking: pi.metadata?.booking_id });
    return ch;
  };
  const stripe = {
    _state: st,
    accounts: {
      create: async (p, o) => { if (st.v1Blocked) throw new Error('Stripe no longer recommends Accounts v1 for new Connect integrations.'); return once(opt(o), () => { const a = { id: id('acct'), ...p, payouts_enabled: false, details_submitted: false, capabilities: { transfers: 'inactive' } }; st.accounts[a.id] = a; return a; }); },
      retrieve: async (aid) => { const a = st.accounts[aid]; if (!a) throw Object.assign(new Error('No such account'), { code: 'resource_missing' }); return a; },
      createLoginLink: async (aid) => ({ url: `${baseUrl}/__fake_stripe/express?account=${aid}` }),
    },
    // Accounts v2 (JSON) stand-in: recipient accounts behave like v1 Express ones afterwards.
    // st.noV2 makes v2 fail (older platform); st.profileUnfinished = platform profile not done; st.v1Blocked makes v1 account creation fail (new platform)
    v2: async (path, body, key) => {
      if (st.noV2) throw new Error('Accounts v2 is not enabled for this platform');
      if (path === '/v2/core/accounts' && st.profileUnfinished) throw new Error('You tried to create a connected account with your platform as the losses collector. / account_creation_losses_collector_unavailable / HTTP 400');
      if (path === '/v2/core/accounts' && body.defaults?.responsibilities?.losses_collector !== 'application') throw new Error('Losses collector can only be "application" for the set of configurations this account has. / invalid_fields / HTTP 400');
      if (path === '/v2/core/accounts') return once(key, () => { st.v2Created = (st.v2Created || 0) + 1; const a = { id: id('acct'), email: body.contact_email, metadata: body.metadata, payouts_enabled: false, details_submitted: false, capabilities: { transfers: 'inactive' } }; st.accounts[a.id] = a; return a; });
      if (path === '/v2/core/account_links') return { url: `${baseUrl}/__fake_stripe/onboard?account=${body.account}&return=${encodeURIComponent(body.use_case.account_onboarding.return_url)}` };
      throw new Error('unknown v2 path ' + path);
    },
    accountLinks: { create: async (p) => (st.v1LinksBlocked ? Promise.reject(new Error('Use v2 account links for this account')) : { url: `${baseUrl}/__fake_stripe/onboard?account=${p.account}&return=${encodeURIComponent(p.return_url)}` }) },
    identity: {
      verificationSessions: {
        create: async (p) => { const s = { id: id('vs'), status: 'requires_input', metadata: p.metadata, return_url: p.return_url, verified_outputs: null }; s.url = `${baseUrl}/__fake_stripe/identity?session=${s.id}`; st.identity[s.id] = s; return s; },
        // like real Stripe: the date of birth is only included when expanded by name
        retrieve: async (sid, o = {}) => {
          const s = st.identity[sid];
          // like a standard secret key: reading the date of birth is refused (set by tests)
          if (st.refuseSensitive && (o.expand || []).includes('verified_outputs.dob')) throw Object.assign(new Error('This API key cannot access sensitive verification results'), { type: 'StripePermissionError' });
          if (!s?.verified_outputs || (o.expand || []).includes('verified_outputs.dob')) return s;
          const { dob, ...rest } = s.verified_outputs;
          return { ...s, verified_outputs: rest };
        },
      },
    },
    customers: { create: async (p, o) => once(opt(o), () => { const c = { id: id('cus'), ...p }; st.customers[c.id] = c; return c; }) },
    checkout: {
      sessions: {
        create: async (p) => {
          const s = { id: id('cs'), ...p, amount_total: p.line_items[0].price_data.unit_amount, payment_status: 'unpaid', status: 'open' };
          s.url = `${baseUrl}/__fake_stripe/checkout?session=${s.id}`;
          st.sessions[s.id] = s;
          return s;
        },
        retrieve: async (sid) => st.sessions[sid],
        expire: async (sid) => { const s = st.sessions[sid]; if (s.status !== 'open') throw new Error('Session is not open'); s.status = 'expired'; return s; },
      },
    },
    paymentIntents: {
      create: async (p, o) => once(opt(o), () => {
        if (p.off_session && st.needsAuth.has(p.customer)) throw Object.assign(new Error('This payment requires authentication'), { code: 'authentication_required', type: 'StripeCardError' });
        const pi = { id: id('pi'), ...p, status: 'requires_confirmation' };
        st.intents[pi.id] = pi;
        if (p.confirm) chargeFor(pi);
        return pi;
      }),
      cancel: async (pid) => { const pi = st.intents[pid]; if (pi) pi.status = 'canceled'; return pi; },
      retrieve: async (pid, o) => { const pi = st.intents[pid]; return o?.expand?.includes('latest_charge') ? { ...pi, latest_charge: st.charges[pi.latest_charge] } : pi; },
    },
    transfers: {
      create: async (p, o) => once(opt(o), () => {
        if (!st.accounts[p.destination]?.payouts_enabled) throw Object.assign(new Error('Destination account cannot receive transfers'), { code: 'account_invalid' });
        if (p.source_transaction) {
          const ch = st.charges[p.source_transaction];
          if (!ch) throw new Error('No such charge: ' + p.source_transaction);
          const used = st.transfers.filter((t) => t.source_transaction === ch.id).reduce((s, t) => s + t.amount, 0);
          if (used + p.amount + ch.refunded > ch.amount) throw new Error('Transfer exceeds the charge amount');
        }
        const t = { id: id('tr'), ...p };
        st.transfers.push(t);
        st.ledger.push({ type: 'transfer', amount: p.amount, to: p.destination, booking: p.transfer_group });
        return t;
      }),
    },
    refunds: {
      create: async (p, o) => once(opt(o), () => {
        const pi = st.intents[p.payment_intent];
        const ch = st.charges[pi.latest_charge];
        const amount = p.amount ?? ch.amount - ch.refunded;
        if (amount + ch.refunded > ch.amount) throw new Error('Refund exceeds the charge');
        ch.refunded += amount;
        const r = { id: id('re'), amount, payment_intent: pi.id };
        st.refunds.push(r);
        st.ledger.push({ type: 'refund', amount, booking: pi.metadata?.booking_id });
        return r;
      }),
    },
  };

  // simulate what Stripe's hosted pages do
  stripe._completeCheckout = (sid) => {
    const s = st.sessions[sid];
    if (s.status === 'complete') return s;
    const pi = { id: id('pi'), amount: s.amount_total, currency: 'gbp', customer: s.customer, payment_method: id('pm'), ...(s.payment_intent_data || {}) };
    st.intents[pi.id] = pi;
    chargeFor(pi);
    Object.assign(s, { status: 'complete', payment_status: 'paid', payment_intent: pi.id });
    return s;
  };
  stripe._finishOnboarding = (aid) => Object.assign(st.accounts[aid], { payouts_enabled: true, details_submitted: true, capabilities: { transfers: 'active' } });
  stripe._finishIdentity = (sid, dob) => {
    const [y, m, d] = dob.split('-').map(Number);
    return Object.assign(st.identity[sid], { status: 'verified', verified_outputs: { dob: { year: y, month: m, day: d } } });
  };
  return stripe;
}
