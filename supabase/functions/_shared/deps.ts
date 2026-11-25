// Real dependencies for Supabase Edge Functions (Deno).
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import type { Deps } from './handlers.ts';

export function makeDeps(): Deps {
  const env = Deno.env.toObject();
  const stripe = new Stripe(env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' as any, httpClient: Stripe.createFetchHttpClient() });
  // Stripe only shares the date of birth from an ID check with a restricted key that has
  // "access recent sensitive verification results" (Identity). Optional: without it, passed
  // checks go to staff review.
  if (env.STRIPE_IDENTITY_KEY) (stripe as any).identityReader = new Stripe(env.STRIPE_IDENTITY_KEY, { apiVersion: '2024-12-18.acacia' as any, httpClient: Stripe.createFetchHttpClient() });
  // Accounts v2 calls (JSON, own API version). Stripe's error for this platform named 2026-11-18.endive.
  (stripe as any).v2 = async (path: string, body: unknown, idempotencyKey?: string) => {
    const r = await fetch('https://api.stripe.com' + path, { method: 'POST', body: JSON.stringify(body), headers: {
      Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY, 'Stripe-Version': env.STRIPE_V2_VERSION || '2026-11-18.endive',
      'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) } });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error?.message || 'Stripe v2 request failed (' + r.status + ')');
    return j;
  };
  const admin = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const crypto = Stripe.createSubtleCryptoProvider();
  return {
    env,
    stripe,
    rpc: async (fn, args = {}) => {
      const { data, error } = await admin.rpc(fn, args);
      if (error) throw new Error(error.message);
      return data;
    },
    userFromToken: async (jwt) => {
      const { data, error } = await admin.auth.getUser(jwt);
      return error ? null : data.user?.id ?? null;
    },
    verifyWebhook: (body, sig, secret) => stripe.webhooks.constructEventAsync(body, sig, secret, undefined, crypto),
  };
}
