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
