// Test profiles for the pilot (TEST DATA ONLY, Stripe test mode).
// Creates 3 creatives for every role Embr accepts and 10 brands, with made-up
// names and details, so the app can be tried end to end.
//
//   node scripts/seed-pilot.mjs            add them to the Supabase project in
//                                          SUPABASE_URL with SUPABASE_SERVICE_ROLE_KEY
//   node scripts/seed-pilot.mjs --remove   delete every account this script made
//   node scripts/seed-pilot.mjs --local    write to the local test Postgres (DB_URL) without photos,
//                                          to check the rows pass every database rule
//
// Every account's email is lukeshearer6+seed-<handle>@hotmail.co.uk, so a sign-in
// code can be made for any of them, and --remove finds them by that prefix.
// Photos: one AI-generated face (thispersondoesnotexist.com, nobody real) for people
// who are photographed, plus stock photos from picsum.photos (Unsplash licence).
// Video and showreel links point at example.com. Payouts are not set up, so a
// creative accepts an offer only after setting up test payouts in Wallet.

const MAIL = (h) => `lukeshearer6+seed-${h}@hotmail.co.uk`;
const PREFIX = 'lukeshearer6+seed-';

// ---------------------------------------------------------------- the people
const P = (name, city, rate, extra = {}) => ({ name, city, rate, ...extra });
const ROLES = {
  Model: [
    P('Amelia Hart', 'Manchester', 300, { sizing: 'womenswear', height_cm: 176, bust_in: 32, waist_in: 25, hips_in: 35, inside_leg_in: 33, dress_uk: 8, bra: '32B', shoe_uk: 6, hair: 'Brown', eyes: 'Green', also: ['UGC creator'] }),
    P('Kofi Mensah', 'Manchester', 280, { sizing: 'menswear', height_cm: 188, chest_in: 38, waist_in: 31, inside_leg_in: 34, suit: '38L', collar_in: 15.5, shoe_uk: 10, hair: 'Black', eyes: 'Brown' }),
    P('Priya Nair', 'Leeds', 250, { sizing: 'womenswear', height_cm: 172, bust_in: 33, waist_in: 26, hips_in: 36, inside_leg_in: 32, dress_uk: 10, bra: '32C', shoe_uk: 5.5, hair: 'Black', eyes: 'Brown', travel_range: 'region' }),
  ],
  'UGC creator': [
    P('Sophie Turnbull', 'Manchester', 180),
    P('Jordan Blake', 'Liverpool', 160, { travel_range: 'region' }),
    P('Hana Okafor', 'Manchester', 200, { also: ['Content creator'], instagram: 'embrtest_hana' }),
  ],
  Actor: [
    P('Tom Whitaker', 'Manchester', 350),
    P('Leila Haddad', 'London', 400, { travel_range: 'uk', travel_costs: 'paid' }),
    P('Callum Reid', 'Glasgow', 300, { travel_range: 'uk' }),
  ],
  'Content creator': [
    P('Maya Chen', 'Manchester', 250, { instagram: 'embrtest_maya' }),
    P('Ellis Grant', 'Birmingham', 220, { instagram: 'embrtest_ellis', travel_range: 'uk' }),
    P('Zara Iqbal', 'Manchester', 280, { instagram: 'embrtest_zara' }),
  ],
  Photographer: [
    P('Dan Lowe', 'Manchester', 450),
    P('Rosa Martins', 'Manchester', 400, { also: ['Videographer'] }),
    P('Femi Adeyemi', 'Leeds', 380, { travel_range: 'region', travel_costs: 'nearby_included' }),
  ],
  Videographer: [
    P('Josh Kerr', 'Manchester', 420),
    P('Aisha Bello', 'Liverpool', 380, { travel_range: 'region' }),
    P('Ollie Price', 'Bristol', 400, { travel_range: 'uk', travel_costs: 'paid' }),
  ],
  'Make-up artist': [
    P('Grace Kimura', 'Manchester', 250),
    P('Nadia Rahman', 'Manchester', 220, { also: ['Hair stylist'] }),
    P('Chloe Barnes', 'Leeds', 200, { travel_range: 'region' }),
  ],
  'Hair stylist': [
    P('Marcus Bell', 'Manchester', 240),
    P('Imogen Shaw', 'Liverpool', 210, { travel_range: 'region' }),
    P('Tia Campbell', 'Manchester', 230),
  ],
  'Nail technician': [
    P('Lucy Pham', 'Manchester', 160),
    P('Erin Doyle', 'Manchester', 150),
    P('Simone Grant', 'Birmingham', 170, { travel_range: 'region' }),
  ],
  Stylist: [
    P('Harriet Cole', 'Manchester', 350),
    P('Sami Yusuf', 'London', 380, { travel_range: 'uk', travel_costs: 'paid' }),
    P('Bella Moretti', 'Manchester', 320),
  ],
};
const BIO = {
  Model: 'Commercial and e-commerce model. Comfortable on set, quick with direction and happy shooting stills or short video.',
  'UGC creator': 'I make honest, scroll-stopping UGC for beauty, food and lifestyle brands. Fast turnaround, raw files on request.',
  Actor: 'Screen and commercial actor with a natural, warm delivery. Strong at improvised lines and talking to camera.',
  'Content creator': 'Lifestyle creator posting fashion, food and city guides. Engaged local audience and polished short-form video.',
  Photographer: 'Fashion and product photographer. Natural light or studio, with retouching included in every package.',
  Videographer: 'Shoots and edits short-form brand films, behind the scenes and social cutdowns in 9:16 and 16:9.',
  'Make-up artist': 'Editorial and commercial make-up artist. Skin-first looks that hold up under studio lights.',
  'Hair stylist': 'Session hair stylist for campaigns and lookbooks. Sleek, textured and everything in between.',
  'Nail technician': 'Nail artist for close-up product and beauty shoots. Gel, BIAB and hand-painted detail.',
  Stylist: 'Fashion stylist pulling, fitting and steaming on set. Builds looks around your brief and your stock.',
};
const TAGS = {
  Model: ['e-commerce', 'lookbook', 'beauty'], 'UGC creator': ['TikTok', 'beauty', 'food'], Actor: ['commercial', 'talking head'],
  'Content creator': ['Instagram', 'TikTok', 'lifestyle'], Photographer: ['fashion', 'product', 'studio'], Videographer: ['social video', 'BTS', 'editing'],
  'Make-up artist': ['editorial', 'bridal', 'skin'], 'Hair stylist': ['session', 'editorial'], 'Nail technician': ['gel', 'nail art'], Stylist: ['fashion', 'on-set'],
};
const FACE = new Set(['Model', 'Actor', 'Content creator', 'UGC creator']);   // photographed people get an AI face first
const PHOTOS = { Model: 4, 'UGC creator': 1, Actor: 2, 'Content creator': 2, Photographer: 4, Videographer: 1, 'Make-up artist': 4, 'Hair stylist': 4, 'Nail technician': 4, Stylist: 4 };
const LINKS = { 'UGC creator': ['Skincare ad', 'Coffee unboxing'], Actor: ['Showreel'], 'Content creator': ['Best posts'], Videographer: ['Showreel'] };

const BRANDS = [
  ['Copperfield Knitwear', 'Ellie Ward', 'Manchester'], ['Saltmarsh Skincare', 'Ruth Okoye', 'Manchester'],
  ['Brickhouse Denim', 'Sam Fletcher', 'Manchester'], ['Mill & Mortar Candles', 'Hannah Price', 'Leeds'],
  ['Velvet Arch Bridal', 'Nina Patel', 'Manchester'], ['Northline Sportswear', 'Ade Johnson', 'Liverpool'],
  ['Kettle & Crumb Bakery', 'Megan Hughes', 'Manchester'], ['Halcyon Eyewear', 'Theo Marsh', 'London'],
  ['Redbank Records', 'Kai Morgan', 'Manchester'], ['Orla Moss Jewellery', 'Orla Byrne', 'Manchester'],
];

const slug = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
const ft = (cm) => { const i = Math.round(cm / 2.54); return `${Math.floor(i / 12)}'${i % 12}"`; };

// stable fake date of birth, 21 to 34 years old
function dob(i) { const d = new Date(); d.setFullYear(d.getFullYear() - 21 - (i * 7) % 14); d.setMonth((i * 5) % 12, 1 + (i * 3) % 27); return d.toISOString().slice(0, 10); }

export function plan() {
  const talents = []; let i = 0;
  for (const [role, people] of Object.entries(ROLES)) {
    for (const p of people) {
      i++;
      const handle = slug(p.name);
      const roles = [role, ...(p.also || [])];
      const t = {
        handle, name: p.name, category: role, roles, city: p.city, day_rate: p.rate, half_rate: Math.round(p.rate * 0.6 / 5) * 5,
        bio: BIO[role], tags: TAGS[role], dob: dob(i), age_verified: true, identity_status: 'verified', published: true,
        travels: (p.travel_range || 'local') !== 'local', travel_range: p.travel_range || 'local', travel_costs: p.travel_costs || 'discuss',
        instagram: p.instagram || null,
        packages: { full: { hours: 8, includes: role === 'Photographer' ? '20 retouched images' : '' }, half: { hours: 4, includes: '' } },
      };
      for (const k of ['sizing', 'height_cm', 'bust_in', 'chest_in', 'waist_in', 'hips_in', 'inside_leg_in', 'dress_uk', 'suit', 'collar_in', 'bra', 'shoe_uk', 'hair', 'eyes']) if (p[k] != null) t[k] = p[k];
      if (t.height_cm) t.height = ft(t.height_cm);
      const photos = [];
      for (const r of roles) {
        const n = PHOTOS[r] || 0;
        for (let k = 0; k < n; k++) photos.push({ role: r, src: FACE.has(r) && k === 0 && !photos.some((x) => x.src === 'face') ? 'face' : `stock:${handle}-${slug(r)}-${k}` });
      }
      const links = roles.flatMap((r) => (LINKS[r] || []).map((title, k) => ({ role: r, title, url: `https://example.com/${handle}/${slug(r)}-${k + 1}` })));
      talents.push({ email: MAIL(handle), t, photos, links });
    }
  }
  const brands = BRANDS.map(([name, contact_name, city]) => ({ email: MAIL('brand-' + slug(name).replace(/\./g, '-')), b: { name, contact_name, city, website: `https://example.com/${slug(name)}` } }));
  return { talents, brands };
}

// ---------------------------------------------------------------- remote (Supabase REST, service key)
function remote() {
  const URL_ = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
  if (!URL_ || !KEY) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
  async function call(method, path, body, headers = {}) {
    const r = await fetch(URL_ + path, { method, headers: { ...H, ...(body && !(body instanceof Uint8Array) ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body instanceof Uint8Array ? body : body ? JSON.stringify(body) : undefined });
    const txt = await r.text();
    if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${txt.slice(0, 300)}`);
    return txt ? JSON.parse(txt) : null;
  }
  async function users() {
    const out = [];
    for (let page = 1; ; page++) { const r = await call('GET', `/auth/v1/admin/users?page=${page}&per_page=1000`); const u = r.users || r; out.push(...u); if (u.length < 1000) break; }
    return out;
  }
  return {
    users,
    async user(email, existing) {
      const u = existing.find((x) => x.email?.toLowerCase() === email.toLowerCase());
      if (u) return u.id;
      return (await call('POST', '/auth/v1/admin/users', { email, email_confirm: true })).id;
    },
    upsert: (table, row) => call('POST', `/rest/v1/${table}`, row, { Prefer: 'resolution=merge-duplicates,return=minimal' }),
    del: (table, q) => call('DELETE', `/rest/v1/${table}?${q}`),
    insert: (table, rows) => call('POST', `/rest/v1/${table}`, rows, { Prefer: 'return=minimal' }),
    rpc: (fn, args = {}) => call('POST', `/rest/v1/rpc/${fn}`, args),
    upload: (path, bytes) => call('POST', `/storage/v1/object/photos/${path}`, bytes, { 'Content-Type': 'image/jpeg', 'x-upsert': 'true', 'cache-control': '31536000' }),
    listPhotos: (prefix) => call('POST', '/storage/v1/object/list/photos', { prefix, limit: 100 }),
    removePhotos: (paths) => call('DELETE', '/storage/v1/object/photos', { prefixes: paths }),
    deleteUser: (id) => call('DELETE', `/auth/v1/admin/users/${id}`),
  };
}

async function image(src) {
  const url = src === 'face' ? 'https://thispersondoesnotexist.com/' : `https://picsum.photos/seed/${encodeURIComponent(src.slice(6))}/800/1000.jpg`;
  for (let a = 0; a < 3; a++) {
    const r = await fetch(url, { headers: { 'User-Agent': 'embr-test-seed' }, redirect: 'follow' });
    if (r.ok) return new Uint8Array(await r.arrayBuffer());
    await new Promise((ok) => setTimeout(ok, 1000));
  }
  throw new Error('Could not download ' + url);
}

async function seedRemote() {
  const api = remote();
  const { talents, brands } = plan();
  const existing = await api.users();
  const decl = await api.rpc('agency_declaration');
  const now = new Date().toISOString();
  for (const { email, t, photos, links } of talents) {
    const id = await api.user(email, existing);
    await api.upsert('profiles', { id, role: 'talent', email });
    await api.upsert('talents', { id, ...t, age_verified_at: now, agency_declared_at: now, agency_declaration: decl, dates_confirmed_at: now });
    await api.del('talent_photos', `talent_id=eq.${id}`);
    await api.del('talent_links', `talent_id=eq.${id}`);
    const rows = [];
    for (const [k, p] of photos.entries()) {
      const path = `${id}/seed-${k}.jpg`;
      await api.upload(path, await image(p.src));
      rows.push({ talent_id: id, path, position: k, role: p.role });
    }
    if (rows.length) await api.insert('talent_photos', rows);
    if (links.length) await api.insert('talent_links', links.map((l, k) => ({ talent_id: id, role: l.role, url: l.url, title: l.title, position: k })));
    console.log(`talent  ${t.name.padEnd(18)} ${t.roles.join(' + ').padEnd(30)} ${email}`);
  }
  for (const { email, b } of brands) {
    const id = await api.user(email, existing);
    await api.upsert('profiles', { id, role: 'brand', email });
    await api.upsert('brands', { id, ...b });
    console.log(`brand   ${b.name.padEnd(24)} ${email}`);
  }
  console.log(`\nDone: ${talents.length} creatives, ${brands.length} brands.`);
}

async function removeRemote() {
  const api = remote();
  const mine = (await api.users()).filter((u) => u.email?.toLowerCase().startsWith(PREFIX));
  for (const u of mine) {
    const files = (await api.listPhotos(u.id).catch(() => [])) || [];
    if (files.length) await api.removePhotos(files.map((f) => `${u.id}/${f.name}`));
    try { await api.deleteUser(u.id); console.log('removed ' + u.email); }
    catch (e) { console.log(`could not remove ${u.email} (it may have bookings): ${e.message}`); }
  }
  console.log(`\n${mine.length} seeded accounts processed.`);
}

// ---------------------------------------------------------------- local check (no photos downloaded)
async function seedLocal() {
  const { default: pg } = await import('pg');
  const db = new pg.Client({ connectionString: process.env.DB_URL || 'postgresql://postgres@localhost:54329/embr?host=/tmp' });
  await db.connect();
  const ins = (table, row) => {
    const k = Object.keys(row);
    const v = k.map((c) => (row[c] && typeof row[c] === 'object' && !Array.isArray(row[c]) ? JSON.stringify(row[c]) : row[c]));
    return db.query(`insert into ${table} (${k.join(',')}) values (${k.map((_, i) => '$' + (i + 1)).join(',')})`, v);
  };
  const { talents, brands } = plan();
  const decl = (await db.query('select public.agency_declaration() d')).rows[0].d;
  const now = new Date().toISOString();
  for (const { email, t, photos, links } of talents) {
    const id = (await db.query('insert into auth.users (email) values ($1) returning id', [email])).rows[0].id;
    await ins('public.profiles', { id, role: 'talent', email });
    await ins('public.talents', { id, ...t, age_verified_at: now, agency_declared_at: now, agency_declaration: decl, dates_confirmed_at: now });
    for (const [k, p] of photos.entries()) await ins('public.talent_photos', { talent_id: id, path: `${id}/seed-${k}.jpg`, position: k, role: p.role });
    for (const [k, l] of links.entries()) await ins('public.talent_links', { talent_id: id, role: l.role, url: l.url, title: l.title, position: k });
  }
  for (const { email, b } of brands) {
    const id = (await db.query('insert into auth.users (email) values ($1) returning id', [email])).rows[0].id;
    await ins('public.profiles', { id, role: 'brand', email });
    await ins('public.brands', { id, ...b });
  }
  console.log(`local: ${talents.length} creatives, ${brands.length} brands`);
  await db.end();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = process.argv.slice(2);
  (a.includes('--local') ? seedLocal() : a.includes('--remove') ? removeRemote() : seedRemote())
    .catch((e) => { console.error(e.message); process.exit(1); });
}
