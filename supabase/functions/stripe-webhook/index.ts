import { makeDeps } from '../_shared/deps.ts';
import { stripeWebhook } from '../_shared/handlers.ts';

const deps = makeDeps();
Deno.serve((req) => stripeWebhook(req, deps));
