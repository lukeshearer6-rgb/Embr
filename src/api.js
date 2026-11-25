// Talks to Supabase (database, sign-in, photo storage) and Embr's server functions.
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || location.origin).replace(/\/$/, '');
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'local-anon-key';

export const sb = createClient(SUPABASE_URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'embr-auth' },
});

export class ApiError extends Error {}

const clean = (m) => String(m || 'Something went wrong').replace(/^.*?ERROR:\s*/, '');

// Database functions (see supabase/migrations). All reads and writes go through these.
export async function rpc(fn, args = {}) {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw new ApiError(clean(error.message));
  return data;
}

// Embr server functions: payments, payouts, ID checks.
export async function action(name, args = {}) {
  const { data: { session } } = await sb.auth.getSession();
  const r = await fetch(SUPABASE_URL + '/functions/v1/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: 'Bearer ' + (session?.access_token || KEY) },
    body: JSON.stringify({ action: name, ...args }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(data.error || 'Something went wrong. Try again.');
  return data;
}

export async function sendCode(email) {
  const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw new ApiError(error.message);
}
export async function verifyCode(email, token) {
  const { data, error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw new ApiError(/expired|invalid/i.test(error.message) ? 'That code is wrong or has expired. Check the latest email, or send a new code.' : error.message);
  return data.session;
}
export const signOut = () => sb.auth.signOut();

export const photoUrl = (path) => (path ? `${SUPABASE_URL}/storage/v1/object/public/photos/${path.split('/').map(encodeURIComponent).join('/')}` : '');

// Resize on the phone before upload: longest side 1600px, JPEG. Keeps uploads
// small and well inside Supabase's free 1 GB storage.
async function compress(file, max = 1600, quality = 0.82) {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) throw new ApiError('That file isn\'t an image we can read. Try a JPEG or PNG.');
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((ok) => c.toBlob(ok, 'image/jpeg', quality));
}

export async function uploadPhoto(userId, file, role = null) {
  const blob = await compress(file);
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await sb.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' });
  if (error) throw new ApiError(error.message);
  return rpc('add_photo', { p_path: path, p_role: role });
}
export async function deletePhoto(id, path) {
  const me = await rpc('remove_photo', { p_id: id });
  await sb.storage.from('photos').remove([path]).catch(() => {});
  return me;
}

// what each role needs before a profile goes live (cached: it never changes mid-session)
let rulesP;
export const roleRules = () => (rulesP ||= rpc('role_rules').catch((e) => { rulesP = null; throw e; }));
let optsP;
export const modelOptions = () => (optsP ||= rpc('model_options').catch((e) => { optsP = null; throw e; }));
// the talent agency declaration, as stored by the database (version prefix dropped for display)
let agencyP;
export const agencyText = () => (agencyP ||= rpc('agency_declaration').then((s) => String(s).replace(/^[^:]*:\s*/, '')).catch((e) => { agencyP = null; throw e; }));
