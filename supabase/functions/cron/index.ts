import { makeDeps } from '../_shared/deps.ts';
import { cron } from '../_shared/handlers.ts';

const deps = makeDeps();
Deno.serve((req) => cron(req, deps));
