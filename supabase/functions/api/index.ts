import { makeDeps } from '../_shared/deps.ts';
import { api } from '../_shared/handlers.ts';

const deps = makeDeps();
Deno.serve((req) => api(req, deps));
