import { makeDeps } from '../_shared/deps.ts';
import { sendEmail } from '../_shared/handlers.ts';

const deps = makeDeps();
Deno.serve((req) => sendEmail(req, deps));
