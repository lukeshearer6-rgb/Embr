-- Embr pilot: database schema, security and booking logic.
-- All writes go through the functions below (security definer), which check
-- who is calling and what state the booking is in. Tables have row level
-- security switched on with no policies, so nobody can read or write them
-- directly through the API.
--
-- Agency-status rules enforced here:
--   * talent can never read briefs, and there is nothing for talent to apply to
--   * offers are created only by brands; talent can accept or decline
--   * messages exist only inside a booking a brand started
--   * talent pay no commission: the talent fee is paid to talent in full

create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tables
create table public.settings (
  id int primary key default 1 check (id = 1),
  fee_first numeric not null default 0.10,     -- first booking with a person
  fee_repeat numeric not null default 0.07,    -- from the 2nd booking
  fee_loyal numeric not null default 0.05,     -- from the 5th booking
  loyal_after int not null default 4,          -- completed bookings before the 5% tier
  fee_link numeric not null default 0.05,      -- booking-link jobs
  deposit_rate numeric not null default 0.50,
  auto_signoff_hours int not null default 72,
  free_cancel_days int not null default 7,
  late_cancel_share numeric not null default 0.50, -- share of the session fee paid to talent on a late brand cancellation
  agreement_version text not null default 'pilot-2026-11'
);
insert into public.settings default values;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('talent','brand','ops')),
  email text,
  created_at timestamptz not null default now()
);

create table public.invites (
  code text primary key,
  role text not null check (role in ('talent','brand','ops')),
  note text,
  created_by uuid references public.profiles (id),
  used_by uuid references public.profiles (id),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.talents (
  id uuid primary key references public.profiles (id) on delete cascade,
  handle extensions.citext unique check (handle ~ '^[a-zA-Z0-9_.]{2,30}$'),
  name text not null default '',
  category text not null default 'Model',
  city text not null default 'Manchester',
  height text,
  day_rate int check (day_rate between 0 and 100000),
  half_rate int check (half_rate between 0 and 100000),
  travels boolean not null default false,
  instagram text,
  bio text,
  tags text[] not null default '{}',
  comfort text,                      -- content they're comfortable with
  dob date,                          -- self-declared at sign-up
  age_verified boolean not null default false,
  age_verified_at timestamptz,
  identity_session text,
  identity_status text,              -- null | processing | requires_input | verified | under_18
  stripe_account text unique,
  payouts_enabled boolean not null default false,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.talent_photos (
  id uuid primary key default gen_random_uuid(),
  talent_id uuid not null references public.talents (id) on delete cascade,
  path text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.talent_photos (talent_id, position);

create table public.talent_off_days (
  talent_id uuid not null references public.talents (id) on delete cascade,
  day date not null,
  primary key (talent_id, day)
);

create table public.brands (
  id uuid primary key references public.profiles (id) on delete cascade,
  name text not null default '',
  contact_name text,
  city text not null default 'Manchester',
  website text,
  instagram text,
  stripe_customer text,
  created_at timestamptz not null default now()
);

create table public.shortlist (
  brand_id uuid not null references public.brands (id) on delete cascade,
  talent_id uuid not null references public.talents (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (brand_id, talent_id)
);

create table public.briefs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  title text not null,
  category text not null,
  city text not null,
  shoot_date date not null,
  days int not null default 1 check (days between 1 and 14),
  day_rate int not null check (day_rate between 0 and 100000),
  spots int not null default 1 check (spots between 1 and 20),
  travel text not null default 'local' check (travel in ('local','covered')),
  description text,
  usage text,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);

create table public.booking_links (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  talent_id uuid not null references public.talents (id) on delete cascade,
  title text not null,
  shoot_date date not null,
  days int not null default 1 check (days between 1 and 14),
  day_rate int not null check (day_rate between 0 and 100000),
  usage text,
  usage_fee int not null default 0 check (usage_fee between 0 and 1000000),
  note text,
  status text not null default 'open' check (status in ('open','used','withdrawn')),
  booking_id uuid,
  expires_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  brand_id uuid not null references public.brands (id),
  talent_id uuid not null references public.talents (id),
  brief_id uuid references public.briefs (id) on delete set null,
  link_id uuid references public.booking_links (id) on delete set null,
  title text not null,
  shoot_date date not null,
  days int not null default 1 check (days between 1 and 14),
  day_rate int not null check (day_rate between 0 and 100000),
  usage text,
  usage_fee int not null default 0 check (usage_fee between 0 and 1000000),
  location text,
  call_time text,
  notes text,
  content_agreed text,
  -- money, in pence
  fee_rate numeric not null,
  fee_label text not null,
  session_p int not null,
  talent_fee_p int not null,
  embr_fee_p int not null,
  total_p int not null,
  deposit_p int not null,
  balance_p int not null,
  status text not null default 'offer' check (status in
    ('offer','accepted','confirmed','wrapped','completed','declined','withdrawn','cancelled','disputed')),
  agreement_version text not null,
  agreement_text text not null,
  brand_agreed_at timestamptz,
  talent_agreed_at timestamptz,
  deposit_checkout text,
  deposit_intent text,
  deposit_charge text,
  deposit_paid_at timestamptz,
  payment_method text,
  balance_checkout text,
  balance_checkout_url text,
  balance_intent text,
  balance_charge text,
  balance_paid_at timestamptz,
  transfer_ids text[] not null default '{}',
  paid_to_talent_p int not null default 0,
  refund_ids text[] not null default '{}',
  refunded_p int not null default 0,
  wrapped_at timestamptz,
  auto_signoff_at timestamptz,
  completed_at timestamptz,
  signoff_kind text,                 -- brand | auto | ops
  cancelled_at timestamptz,
  cancelled_by text,                 -- brand | talent | ops
  cancel_reason text,
  dispute_reason text,
  money_lock timestamptz,            -- set while a payment step is running
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.bookings (brand_id);
create index on public.bookings (talent_id);
create index on public.bookings (status, auto_signoff_at);

create table public.booking_events (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  at timestamptz not null default now(),
  actor text,
  text text not null
);
create index on public.booking_events (booking_id, at);

create table public.messages (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  sender uuid not null references public.profiles (id),
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index on public.messages (booking_id, created_at);

create table public.message_reads (
  booking_id uuid not null references public.bookings (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (booking_id, user_id)
);

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete cascade,
  text text not null,
  url text,
  email boolean not null default true,
  read_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);

create table public.stripe_events (
  id text primary key,
  type text,
  received_at timestamptz not null default now()
);

-- Row level security on, no policies: the API can only reach data through
-- the functions below.
alter table public.settings enable row level security;
alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.talents enable row level security;
alter table public.talent_photos enable row level security;
alter table public.talent_off_days enable row level security;
alter table public.brands enable row level security;
alter table public.shortlist enable row level security;
alter table public.briefs enable row level security;
alter table public.booking_links enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_events enable row level security;
alter table public.messages enable row level security;
alter table public.message_reads enable row level security;
alter table public.notifications enable row level security;
alter table public.stripe_events enable row level security;

revoke all on all tables in schema public from anon, authenticated;

-- ---------------------------------------------------------------- helpers
create or replace function public._uid() returns uuid
language plpgsql stable as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Please sign in first' using errcode = '28000'; end if;
  return u;
end $$;

create or replace function public._role() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() $$;

create or replace function public._need(r text) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare u uuid := _uid(); have text;
begin
  select role into have from profiles where id = u;
  if have is null then raise exception 'Finish setting up your account first' using errcode = '28000'; end if;
  if have <> r and have <> 'ops' then raise exception 'Not allowed for this account' using errcode = '42501'; end if;
  return u;
end $$;

create or replace function public._gbp(p int) returns text
language sql immutable as $$
  select '£' || case when p % 100 = 0 then to_char(p / 100, 'FM999,999,990')
                     else to_char(p / 100.0, 'FM999,999,990.00') end $$;

create or replace function public._log(b uuid, actor text, t text) returns void
language sql security definer set search_path = public as $$
  insert into booking_events (booking_id, actor, text) values (b, actor, t) $$;

create or replace function public._notify(u uuid, b uuid, t text, link text default null, mail boolean default true) returns void
language sql security definer set search_path = public as $$
  insert into notifications (user_id, booking_id, text, url, email)
  values (u, b, t, coalesce(link, case when b is not null then '/booking/' || b end), mail) $$;

create or replace function public._notify_ops(b uuid, t text) returns void
language sql security definer set search_path = public as $$
  insert into notifications (user_id, booking_id, text, url)
  select id, b, t, case when b is not null then '/booking/' || b end from profiles where role = 'ops' $$;

create or replace function public._first(n text) returns text
language sql immutable as $$ select split_part(coalesce(n,''), ' ', 1) $$;

create or replace function public._code(n int default 6) returns text
language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, n) $$;

-- is the talent free on a date (not marked off, no live booking)?
create or replace function public._is_free(p_talent uuid, p_day date, p_days int default 1, p_skip uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from talent_off_days o where o.talent_id = p_talent and o.day between p_day and p_day + (p_days - 1))
     and not exists (select 1 from bookings b where b.talent_id = p_talent and (p_skip is null or b.id <> p_skip)
                       and b.status in ('accepted','confirmed','wrapped','disputed')
                       and daterange(b.shoot_date, b.shoot_date + b.days, '[)') && daterange(p_day, p_day + p_days, '[)')) $$;

create or replace function public._photo(t uuid) returns text
language sql stable security definer set search_path = public as $$
  select path from talent_photos where talent_id = t order by position, created_at limit 1 $$;

-- ---------------------------------------------------------------- fees
-- 10% on a first booking with a person, 7% from the 2nd, 5% from the 5th,
-- 5% on booking-link jobs. Paid by the brand on top of the talent fee.
create or replace function public.fee_for(p_brand uuid, p_talent uuid, p_link boolean default false)
returns table (rate numeric, label text, done int)
language plpgsql stable security definer set search_path = public as $$
declare s settings; n int;
begin
  select * into s from settings where id = 1;
  select count(*) into n from bookings where brand_id = p_brand and talent_id = p_talent and status = 'completed';
  if p_link then return query select s.fee_link, 'Booking link rate'::text, n; return; end if;
  if n >= s.loyal_after then return query select s.fee_loyal, ('Booking ' || (n + 1) || ' with this person')::text, n;
  elsif n >= 1 then return query select s.fee_repeat, ('Booking ' || (n + 1) || ' with this person')::text, n;
  else return query select s.fee_first, 'First booking with this person'::text, n; end if;
end $$;

create or replace function public._money(p_rate int, p_days int, p_usage int, p_fee numeric)
returns table (session_p int, talent_fee_p int, embr_fee_p int, total_p int, deposit_p int, balance_p int)
language plpgsql stable security definer set search_path = public as $$
declare s settings; sp int; tf int; ef int; tot int; dep int;
begin
  select * into s from settings where id = 1;
  sp := p_rate * p_days * 100;
  tf := sp + coalesce(p_usage, 0) * 100;
  ef := round(tf * p_fee)::int;
  tot := tf + ef;
  dep := round(tot * s.deposit_rate)::int;
  return query select sp, tf, ef, tot, dep, tot - dep;
end $$;

create or replace function public.quote(p_talent uuid, p_day_rate int, p_days int, p_usage_fee int default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare u uuid := _need('brand'); f record; m record;
begin
  select * into f from fee_for(u, p_talent, false);
  select * into m from _money(p_day_rate, p_days, p_usage_fee, f.rate);
  return jsonb_build_object('fee_rate', f.rate, 'fee_label', f.label, 'done', f.done,
    'session_p', m.session_p, 'talent_fee_p', m.talent_fee_p, 'embr_fee_p', m.embr_fee_p,
    'total_p', m.total_p, 'deposit_p', m.deposit_p, 'balance_p', m.balance_p);
end $$;

-- ---------------------------------------------------------------- agreement
create or replace function public._agreement(b bookings) returns text
language plpgsql stable security definer set search_path = public as $$
declare t talents; br brands; s settings;
begin
  select * into t from talents where id = b.talent_id;
  select * into br from brands where id = b.brand_id;
  select * into s from settings where id = 1;
  return format(
'EMBR BOOKING AGREEMENT  %s
Pilot version %s. Draft for the invite-only pilot, to be reviewed by a solicitor. Not legal advice.

1. Parties
Client: %s
Talent: %s
Embr provides the booking software and takes payments through its payment provider, Stripe. Embr is not an agency: it does not find work for the Talent, and the Client chose and booked the Talent.
The Talent confirms they are 18 or over and has passed Embr''s ID check.

2. The job
%s
%s%s
Location: %s
Call time: %s

3. Fees
Session: %s (%s day%s at %s)
Usage: %s
Talent fee: %s. The Talent receives this in full. Embr takes no commission from the Talent.
Embr booking fee, paid by the Client: %s (%s, %s)
Total for the Client: %s

4. Payment
a) Deposit: %s of the total (%s), paid by the Client when the Talent accepts. The booking is confirmed once it is paid. Stripe holds it until sign-off.
b) Balance: %s, charged to the same card at sign-off.
c) After the shoot the Talent marks the job wrapped. The Client signs off, or reports a problem, within %s hours. If the Client does neither, the booking signs off automatically.
d) At sign-off the Talent is paid the full talent fee.

5. Usage
%s
Any other use needs a new booking through Embr.

6. Content agreed
%s
Nothing outside this may be asked of the Talent on the day. The Talent may bring a chaperone.

7. Cancellation
a) Client cancels %s or more days before the shoot: the deposit is refunded in full.
b) Client cancels less than %s days before the shoot: the Talent is paid %s of the session fee (%s) from the deposit and the rest is refunded.
c) Talent cancels: the Client''s deposit is refunded in full.

8. Problems
If the Client reports a problem, nothing is paid out until Embr has heard from both sides. Embr then decides how the money held is split, in line with this agreement.

9. Booking through Embr
For 12 months after this booking, the Client agrees to book this Talent through Embr.

10. Portfolio
Unless agreed otherwise in messages, the Talent may use the images in their portfolio after the Client has published them.',
    b.ref, s.agreement_version,
    br.name, t.name,
    b.title, to_char(b.shoot_date, 'FMDay FMDD FMMonth YYYY'),
    case when b.days > 1 then ' for ' || b.days || ' days' else '' end,
    coalesce(nullif(b.location, ''), 'To be confirmed in Embr messages'),
    coalesce(nullif(b.call_time, ''), 'To be confirmed in Embr messages'),
    _gbp(b.session_p), b.days, case when b.days > 1 then 's' else '' end, _gbp(b.day_rate * 100),
    coalesce(nullif(b.usage, ''), 'None agreed') || case when b.usage_fee > 0 then ' (' || _gbp(b.usage_fee * 100) || ')' else ' (included)' end,
    _gbp(b.talent_fee_p),
    _gbp(b.embr_fee_p), (round(b.fee_rate * 100, 1))::text || '%', lower(b.fee_label),
    _gbp(b.total_p),
    (round(s.deposit_rate * 100))::text || '%', _gbp(b.deposit_p),
    _gbp(b.balance_p),
    s.auto_signoff_hours,
    coalesce(nullif(b.usage, ''), 'No usage agreed beyond the Client''s internal use.'),
    coalesce(nullif(b.content_agreed, ''), 'As described in the job above.'),
    s.free_cancel_days, s.free_cancel_days, (round(s.late_cancel_share * 100))::text || '%',
    _gbp(round(b.session_p * s.late_cancel_share)::int));
end $$;

-- ---------------------------------------------------------------- JSON shapes
create or replace function public._talent_card(t talents) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', t.id, 'handle', t.handle, 'name', t.name, 'category', t.category,
    'city', t.city, 'height', t.height, 'day_rate', t.day_rate, 'half_rate', t.half_rate,
    'travels', t.travels, 'verified', t.age_verified, 'photo', _photo(t.id),
    'rebooked_by', (select count(*) from (select brand_id from bookings where talent_id = t.id and status = 'completed'
                    group by brand_id having count(*) >= 2) x)) $$;

create or replace function public._talent_full(t talents) returns jsonb
language sql stable security definer set search_path = public as $$
  select _talent_card(t) || jsonb_build_object('bio', t.bio, 'tags', t.tags, 'instagram', t.instagram,
    'comfort', t.comfort, 'published', t.published,
    'photos', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'path', path) order by position, created_at)
                        from talent_photos where talent_id = t.id), '[]'),
    'off_days', coalesce((select jsonb_agg(day order by day) from talent_off_days
                          where talent_id = t.id and day >= current_date and day < current_date + 120), '[]'),
    'booked_days', coalesce((select jsonb_agg(distinct d::date) from bookings b,
                              generate_series(b.shoot_date, b.shoot_date + b.days - 1, '1 day') d
                            where b.talent_id = t.id and b.status in ('accepted','confirmed','wrapped','disputed')
                              and b.shoot_date >= current_date - 14), '[]'),
    'completed', (select count(*) from bookings where talent_id = t.id and status = 'completed')) $$;

create or replace function public._booking_json(b bookings, viewer text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t talents; br brands; s settings; me uuid := auth.uid();
begin
  select * into t from talents where id = b.talent_id;
  select * into br from brands where id = b.brand_id;
  select * into s from settings where id = 1;
  return jsonb_build_object(
    'id', b.id, 'ref', b.ref, 'status', b.status, 'title', b.title, 'shoot_date', b.shoot_date, 'days', b.days,
    'day_rate', b.day_rate, 'usage', b.usage, 'usage_fee', b.usage_fee, 'location', b.location,
    'call_time', b.call_time, 'notes', b.notes, 'content_agreed', b.content_agreed,
    'fee_rate', b.fee_rate, 'fee_label', b.fee_label, 'session_p', b.session_p, 'talent_fee_p', b.talent_fee_p,
    'embr_fee_p', b.embr_fee_p, 'total_p', b.total_p, 'deposit_p', b.deposit_p, 'balance_p', b.balance_p,
    'paid_to_talent_p', b.paid_to_talent_p, 'refunded_p', b.refunded_p,
    'deposit_paid_at', b.deposit_paid_at, 'balance_paid_at', b.balance_paid_at,
    'balance_checkout_url', case when viewer in ('brand','ops') then b.balance_checkout_url end,
    'wrapped_at', b.wrapped_at, 'auto_signoff_at', b.auto_signoff_at, 'completed_at', b.completed_at,
    'signoff_kind', b.signoff_kind, 'cancelled_at', b.cancelled_at, 'cancelled_by', b.cancelled_by,
    'cancel_reason', b.cancel_reason, 'dispute_reason', b.dispute_reason,
    'brand_agreed_at', b.brand_agreed_at, 'talent_agreed_at', b.talent_agreed_at,
    'agreement_text', b.agreement_text, 'via_link', b.link_id is not null, 'brief_id', b.brief_id,
    'created_at', b.created_at, 'busy', b.money_lock is not null and b.money_lock > now() - interval '2 minutes',
    'free_cancel_until', b.shoot_date - s.free_cancel_days,
    'late_cancel_p', round(b.session_p * s.late_cancel_share)::int,
    'talent', _talent_card(t) || jsonb_build_object('verified', t.age_verified, 'payouts_enabled', t.payouts_enabled),
    'brand', jsonb_build_object('id', br.id, 'name', br.name, 'city', br.city, 'contact_name', br.contact_name,
                                'instagram', br.instagram, 'website', br.website),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'body', m.body, 'at', m.created_at,
                            'mine', m.sender = me,
                            'from', case when m.sender = b.brand_id then 'brand' when m.sender = b.talent_id then 'talent' else 'embr' end)
                          order by m.created_at) from messages m where m.booking_id = b.id), '[]'),
    'events', coalesce((select jsonb_agg(jsonb_build_object('at', e.at, 'text', e.text) order by e.at)
                        from booking_events e where e.booking_id = b.id), '[]'));
end $$;

create or replace function public._booking_row(b bookings, viewer text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t talents; br brands; last_msg timestamptz; last_from uuid; seen timestamptz;
begin
  select * into t from talents where id = b.talent_id;
  select * into br from brands where id = b.brand_id;
  select created_at, sender into last_msg, last_from from messages where booking_id = b.id order by created_at desc limit 1;
  select read_at into seen from message_reads where booking_id = b.id and user_id = auth.uid();
  return jsonb_build_object('id', b.id, 'ref', b.ref, 'status', b.status, 'title', b.title,
    'shoot_date', b.shoot_date, 'days', b.days, 'total_p', b.total_p, 'talent_fee_p', b.talent_fee_p,
    'deposit_p', b.deposit_p, 'balance_p', b.balance_p, 'auto_signoff_at', b.auto_signoff_at,
    'wrapped_at', b.wrapped_at, 'created_at', b.created_at, 'updated_at', b.updated_at,
    'balance_checkout_url', case when viewer in ('brand','ops') then b.balance_checkout_url end,
    'talent', jsonb_build_object('id', t.id, 'name', t.name, 'photo', _photo(t.id), 'city', t.city, 'category', t.category),
    'brand', jsonb_build_object('id', br.id, 'name', br.name, 'city', br.city),
    'last_message_at', last_msg,
    'unread', last_msg is not null and last_from <> auth.uid() and (seen is null or seen < last_msg));
end $$;

-- ---------------------------------------------------------------- account
create or replace function public.check_invite(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('ok', used_by is null, 'role', role) from invites where upper(code) = upper(trim(p_code))),
                  jsonb_build_object('ok', false)) $$;

-- Create the profile after the first sign-in.
-- Talent and Embr staff need an invite. Brands need an invite, or arrive from
-- a talent's booking link or Book-me page (that's how new brands join).
create or replace function public.create_profile(p_role text, p_invite text default null, p_link text default null,
  p_handle text default null, p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _uid(); inv invites; mail text; ok boolean := false; dob date;
begin
  if exists (select 1 from profiles where id = u) then raise exception 'Your account is already set up'; end if;
  if p_role not in ('talent','brand') and coalesce(p_role,'') <> 'ops' then raise exception 'Choose talent or brand'; end if;
  if nullif(trim(p_invite), '') is not null then
    select * into inv from invites where upper(code) = upper(trim(p_invite)) for update;
    if inv.code is null or inv.used_by is not null then raise exception 'That invite code isn''t valid or has been used'; end if;
    if inv.role <> p_role then raise exception 'That invite is for a % account', inv.role; end if;
    ok := true;
  elsif p_role = 'brand' and (exists (select 1 from booking_links where code = upper(trim(p_link)) and status = 'open')
                           or exists (select 1 from talents where lower(handle) = lower(trim(leading '@' from trim(p_handle))) and published)) then
    ok := true;
  end if;
  if not ok then raise exception 'Embr is invite-only during the pilot. You need an invite code.'; end if;

  mail := coalesce(auth.jwt()->>'email', (select email from auth.users where id = u));
  insert into profiles (id, role, email) values (u, p_role, mail);
  if inv.code is not null then update invites set used_by = u, used_at = now() where code = inv.code; end if;

  if p_role = 'talent' then
    dob := nullif(p_data->>'dob', '')::date;
    if dob is null or dob > (current_date - interval '18 years')::date then
      raise exception 'Embr is for talent aged 18 and over';
    end if;
    insert into talents (id, name, category, city, dob)
    values (u, coalesce(nullif(trim(p_data->>'name'), ''), ''), coalesce(nullif(p_data->>'category', ''), 'Model'),
            coalesce(nullif(p_data->>'city', ''), 'Manchester'), dob);
  elsif p_role = 'brand' then
    insert into brands (id, name, contact_name, city)
    values (u, coalesce(nullif(trim(p_data->>'name'), ''), ''), nullif(trim(p_data->>'contact_name'), ''),
            coalesce(nullif(p_data->>'city', ''), 'Manchester'));
    perform _notify_ops(null, 'New brand joined: ' || coalesce(nullif(trim(p_data->>'name'), ''), mail));
  end if;
  return me();
end $$;

create or replace function public.me() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare u uuid := auth.uid(); p profiles; t talents; br brands; s settings;
begin
  if u is null then return null; end if;
  select * into p from profiles where id = u;
  select * into s from settings where id = 1;
  if p.id is null then
    return jsonb_build_object('id', u, 'email', coalesce(auth.jwt()->>'email', (select email from auth.users where id = u)), 'role', null);
  end if;
  select * into t from talents where id = u;
  select * into br from brands where id = u;
  return jsonb_build_object('id', u, 'email', p.email, 'role', p.role,
    'talent', case when t.id is not null then _talent_full(t) || jsonb_build_object(
        'dob', t.dob, 'identity_status', t.identity_status, 'stripe_account', t.stripe_account is not null,
        'payouts_enabled', t.payouts_enabled) end,
    'brand', case when br.id is not null then jsonb_build_object('id', br.id, 'name', br.name, 'contact_name', br.contact_name,
        'city', br.city, 'website', br.website, 'instagram', br.instagram, 'has_card', br.stripe_customer is not null) end,
    'unread', (select count(*) from notifications where user_id = u and read_at is null),
    'settings', jsonb_build_object('fee_first', s.fee_first, 'fee_repeat', s.fee_repeat, 'fee_loyal', s.fee_loyal,
        'loyal_after', s.loyal_after, 'fee_link', s.fee_link, 'deposit_rate', s.deposit_rate,
        'auto_signoff_hours', s.auto_signoff_hours, 'free_cancel_days', s.free_cancel_days,
        'late_cancel_share', s.late_cancel_share));
end $$;

-- ---------------------------------------------------------------- talent profile
create or replace function public.save_talent(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('talent'); t talents; h text;
begin
  h := nullif(trim(leading '@' from trim(p->>'handle')), '');
  if h is not null and exists (select 1 from talents where lower(handle) = lower(h) and id <> u) then
    raise exception 'That Book-me name is taken. Try another.';
  end if;
  update talents set
    name = coalesce(nullif(trim(p->>'name'), ''), name),
    handle = coalesce(h, handle),
    category = coalesce(nullif(p->>'category', ''), category),
    city = coalesce(nullif(p->>'city', ''), city),
    height = case when p ? 'height' then nullif(trim(p->>'height'), '') else height end,
    day_rate = case when p ? 'day_rate' then nullif(p->>'day_rate', '')::int else day_rate end,
    half_rate = case when p ? 'half_rate' then nullif(p->>'half_rate', '')::int else half_rate end,
    travels = coalesce((p->>'travels')::boolean, travels),
    instagram = case when p ? 'instagram' then nullif(trim(p->>'instagram'), '') else instagram end,
    bio = case when p ? 'bio' then left(nullif(trim(p->>'bio'), ''), 1200) else bio end,
    comfort = case when p ? 'comfort' then left(nullif(trim(p->>'comfort'), ''), 600) else comfort end,
    tags = case when p ? 'tags' then (select coalesce(array_agg(left(trim(x), 30)), '{}') from jsonb_array_elements_text(p->'tags') x where trim(x) <> '') else tags end,
    updated_at = now()
  where id = u returning * into t;
  -- a profile goes live once it has the basics and a photo
  update talents set published = (name <> '' and handle is not null and day_rate is not null
                                  and exists (select 1 from talent_photos where talent_id = u))
  where id = u;
  return me();
end $$;

create or replace function public._republish(u uuid) returns void
language sql security definer set search_path = public as $$
  update talents set published = (name <> '' and handle is not null and day_rate is not null
                                  and exists (select 1 from talent_photos where talent_id = u)) where id = u $$;

create or replace function public.add_photo(p_path text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('talent');
begin
  if split_part(p_path, '/', 1) <> u::text then raise exception 'Photo must be in your own folder'; end if;
  if (select count(*) from talent_photos where talent_id = u) >= 12 then raise exception 'You can have up to 12 photos'; end if;
  insert into talent_photos (talent_id, path, position)
  values (u, p_path, coalesce((select max(position) + 1 from talent_photos where talent_id = u), 0));
  perform _republish(u);
  return me();
end $$;

create or replace function public.remove_photo(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('talent');
begin
  delete from talent_photos where id = p_id and talent_id = u;
  perform _republish(u);
  return me();
end $$;

create or replace function public.cover_photo(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('talent');
begin
  update talent_photos set position = position + 1 where talent_id = u;
  update talent_photos set position = 0 where id = p_id and talent_id = u;
  return me();
end $$;

create or replace function public.toggle_off_day(p_day date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('talent');
begin
  if p_day < current_date then raise exception 'That date has passed'; end if;
  if exists (select 1 from talent_off_days where talent_id = u and day = p_day) then
    delete from talent_off_days where talent_id = u and day = p_day;
  else
    insert into talent_off_days (talent_id, day) values (u, p_day);
  end if;
  return me();
end $$;

-- ---------------------------------------------------------------- brand
create or replace function public.save_brand(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('brand');
begin
  update brands set
    name = coalesce(nullif(trim(p->>'name'), ''), name),
    contact_name = case when p ? 'contact_name' then nullif(trim(p->>'contact_name'), '') else contact_name end,
    city = coalesce(nullif(p->>'city', ''), city),
    website = case when p ? 'website' then nullif(trim(p->>'website'), '') else website end,
    instagram = case when p ? 'instagram' then nullif(trim(p->>'instagram'), '') else instagram end
  where id = u;
  return me();
end $$;

create or replace function public.search_talent(f jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare u uuid := _need('brand'); v_q text := lower(trim(coalesce(f->>'q', ''))); v_d date := nullif(f->>'date', '')::date;
  v_city text := nullif(f->>'city', ''); v_cat text := nullif(f->>'category', ''); v_max int := nullif(f->>'max_rate', '')::int;
begin
  return coalesce((
    select jsonb_agg(card || jsonb_build_object('saved', exists (select 1 from shortlist s where s.brand_id = u and s.talent_id = (card->>'id')::uuid),
                                                'away', away) order by away, score desc, (card->>'day_rate')::int)
    from (
      select _talent_card(t) card, (v_city is not null and t.city <> v_city) away,
             (case when t.age_verified then 1 else 0 end) + (select count(*) from talent_photos p where p.talent_id = t.id) * 0.1 score
      from talents t
      where t.published
        and (v_cat is null or t.category = v_cat)
        and (v_max is null or t.day_rate <= v_max)
        and (v_d is null or _is_free(t.id, v_d))
        and (v_city is null or t.city = v_city or t.travels)
        and (v_q = '' or lower(t.name || ' ' || t.category || ' ' || t.city || ' ' || coalesce(t.bio, '') || ' ' || array_to_string(t.tags, ' ')) like '%' || v_q || '%')
      limit 200) x), '[]');
end $$;

create or replace function public.talent_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare u uuid := _uid(); r text := _role(); t talents;
begin
  if r not in ('brand','ops') and u <> p_id then raise exception 'Not allowed'; end if;
  select * into t from talents where id = p_id;
  if t.id is null or (not t.published and r <> 'ops' and u <> p_id) then raise exception 'Profile not found'; end if;
  return _talent_full(t) || jsonb_build_object('saved', exists (select 1 from shortlist where brand_id = u and talent_id = p_id),
    'booked_before', (select count(*) from bookings where brand_id = u and talent_id = p_id and status = 'completed'));
end $$;

create or replace function public.toggle_shortlist(p_talent uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('brand');
begin
  if exists (select 1 from shortlist where brand_id = u and talent_id = p_talent) then
    delete from shortlist where brand_id = u and talent_id = p_talent; return false;
  end if;
  insert into shortlist (brand_id, talent_id) values (u, p_talent); return true;
end $$;

create or replace function public.my_shortlist() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(_talent_card(t) || jsonb_build_object('saved', true) order by s.created_at desc), '[]')
  from shortlist s join talents t on t.id = s.talent_id where s.brand_id = _need('brand') and t.published $$;

-- ---------------------------------------------------------------- briefs (brand-side only)
create or replace function public.create_brief(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('brand'); id uuid;
begin
  if nullif(trim(p->>'title'), '') is null then raise exception 'Give the brief a title'; end if;
  if (p->>'shoot_date')::date < current_date then raise exception 'The shoot date has passed'; end if;
  insert into briefs (brand_id, title, category, city, shoot_date, days, day_rate, spots, travel, description, usage)
  values (u, trim(p->>'title'), p->>'category', p->>'city', (p->>'shoot_date')::date, coalesce((p->>'days')::int, 1),
          (p->>'day_rate')::int, coalesce((p->>'spots')::int, 1), coalesce(p->>'travel', 'local'),
          nullif(trim(p->>'description'), ''), nullif(trim(p->>'usage'), ''))
  returning briefs.id into id;
  return id;
end $$;

create or replace function public.my_briefs() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(b) || jsonb_build_object(
      'offers', (select count(*) from bookings k where k.brief_id = b.id),
      'booked', (select count(*) from bookings k where k.brief_id = b.id and k.status in ('confirmed','wrapped','completed','disputed')))
    order by b.created_at desc), '[]')
  from briefs b where b.brand_id = _need('brand') $$;

-- Embr ranks up to 6 talent against the brief: free on the date, local-only
-- respected, same city first, then closest to the day rate, then verified and
-- with the most photos. The brand chooses who gets an offer.
create or replace function public._rank(b briefs) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(card order by rk), '[]') from (
    select _talent_card(t) || jsonb_build_object('away', t.city <> b.city,
             'offered', exists (select 1 from bookings k where k.brief_id = b.id and k.talent_id = t.id)) card,
           row_number() over (order by (t.city <> b.city), abs(coalesce(t.day_rate, 0) - b.day_rate), t.age_verified desc,
             (select count(*) from talent_photos p where p.talent_id = t.id) desc, t.created_at) rk
    from talents t
    where t.published and t.category = b.category and _is_free(t.id, b.shoot_date, b.days)
      and (t.city = b.city or (b.travel = 'covered' and t.travels))
    order by rk limit 6) x $$;

create or replace function public.brief_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare u uuid := _need('brand'); b briefs;
begin
  select * into b from briefs where id = p_id;
  if b.id is null or (b.brand_id <> u and _role() <> 'ops') then raise exception 'Brief not found'; end if;
  return to_jsonb(b) || jsonb_build_object('ranked', _rank(b),
    'bookings', coalesce((select jsonb_agg(_booking_row(k, 'brand') order by k.created_at desc) from bookings k where k.brief_id = b.id), '[]'));
end $$;

create or replace function public.close_brief(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update briefs set status = 'closed' where id = p_id and brand_id = _need('brand') $$;

-- ---------------------------------------------------------------- offers and bookings
create or replace function public._new_booking(p_brand uuid, p_talent uuid, p jsonb, p_link uuid default null) returns bookings
language plpgsql security definer set search_path = public as $$
declare f record; m record; b bookings; s settings; r text;
begin
  select * into s from settings where id = 1;
  select * into f from fee_for(p_brand, p_talent, p_link is not null);
  select * into m from _money((p->>'day_rate')::int, coalesce((p->>'days')::int, 1), coalesce((p->>'usage_fee')::int, 0), f.rate);
  loop
    r := 'EMB-' || _code(6);
    exit when not exists (select 1 from bookings where ref = r);
  end loop;
  insert into bookings (ref, brand_id, talent_id, brief_id, link_id, title, shoot_date, days, day_rate, usage, usage_fee,
    location, call_time, notes, content_agreed, fee_rate, fee_label, session_p, talent_fee_p, embr_fee_p, total_p,
    deposit_p, balance_p, agreement_version, agreement_text, brand_agreed_at)
  values (r, p_brand, p_talent, nullif(p->>'brief_id', '')::uuid, p_link, trim(p->>'title'), (p->>'shoot_date')::date,
    coalesce((p->>'days')::int, 1), (p->>'day_rate')::int, nullif(trim(p->>'usage'), ''), coalesce((p->>'usage_fee')::int, 0),
    nullif(trim(p->>'location'), ''), nullif(trim(p->>'call_time'), ''), nullif(trim(p->>'notes'), ''),
    nullif(trim(p->>'content_agreed'), ''), f.rate, f.label, m.session_p, m.talent_fee_p, m.embr_fee_p, m.total_p,
    m.deposit_p, m.balance_p, s.agreement_version, '', now())
  returning * into b;
  update bookings set agreement_text = _agreement(b) where id = b.id returning * into b;
  return b;
end $$;

create or replace function public.create_offer(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('brand'); t talents; br brands; b bookings;
begin
  select * into br from brands where id = u;
  if coalesce(br.name, '') = '' then raise exception 'Add your brand name in Account first'; end if;
  select * into t from talents where id = (p->>'talent_id')::uuid;
  if t.id is null or not t.published then raise exception 'That profile isn''t available'; end if;
  if nullif(trim(p->>'title'), '') is null then raise exception 'Say what the job is'; end if;
  if (p->>'shoot_date')::date < current_date then raise exception 'The shoot date has passed'; end if;
  if coalesce((p->>'day_rate')::int, 0) < 1 then raise exception 'Set a day rate'; end if;
  if not coalesce((p->>'agree')::boolean, false) then raise exception 'Tick the box to accept the booking agreement'; end if;
  if nullif(p->>'brief_id', '') is not null and not exists (select 1 from briefs where id = (p->>'brief_id')::uuid and brand_id = u) then
    raise exception 'Brief not found';
  end if;
  if not _is_free(t.id, (p->>'shoot_date')::date, coalesce((p->>'days')::int, 1)) then
    raise exception '% isn''t free on that date', _first(t.name);
  end if;
  b := _new_booking(u, t.id, p);
  perform _log(b.id, 'brand', 'Offer sent by ' || br.name || '. ' || br.name || ' accepted the booking agreement.');
  perform _notify(t.id, b.id, 'New offer from ' || br.name || ': “' || b.title || '” on ' || to_char(b.shoot_date, 'FMDD FMMon') ||
    ', ' || _gbp(b.talent_fee_p) || ' to you.');
  return b.id;
end $$;

create or replace function public.my_bookings() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare u uuid := _uid(); r text := _role();
begin
  return coalesce((select jsonb_agg(_booking_row(b, r) order by b.shoot_date desc, b.created_at desc) from bookings b
                   where (r = 'brand' and b.brand_id = u) or (r = 'talent' and b.talent_id = u)), '[]');
end $$;

create or replace function public._can_see(b bookings) returns text
language plpgsql stable security definer set search_path = public as $$
declare u uuid := _uid(); r text := _role();
begin
  if r = 'ops' then return 'ops'; end if;
  if b.brand_id = u then return 'brand'; end if;
  if b.talent_id = u then return 'talent'; end if;
  raise exception 'Booking not found';
end $$;

create or replace function public.booking_detail(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b bookings; v text;
begin
  select * into b from bookings where id = p_id;
  if b.id is null then raise exception 'Booking not found'; end if;
  v := _can_see(b);
  insert into message_reads (booking_id, user_id) values (b.id, auth.uid())
    on conflict (booking_id, user_id) do update set read_at = now();
  return _booking_json(b, v);
end $$;

create or replace function public.respond_offer(p_id uuid, p_accept boolean, p_agree boolean default false, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := _need('talent'); b bookings; t talents;
begin
  select * into b from bookings where id = p_id for update;
  if b.id is null or b.talent_id <> u then raise exception 'Booking not found'; end if;
  if b.status <> 'offer' then raise exception 'This offer has already been answered'; end if;
  select * into t from talents where id = u;
  if p_accept then
    if not t.age_verified then raise exception 'Verify your ID (18+) before accepting bookings'; end if;
    if not t.payouts_enabled then raise exception 'Set up payouts so Embr can pay you before accepting'; end if;
    if not p_agree then raise exception 'Tick the box to accept the booking agreement'; end if;
    if b.shoot_date < current_date then raise exception 'The shoot date has passed'; end if;
    if not _is_free(u, b.shoot_date, b.days, b.id) then raise exception 'You already have a booking on that date'; end if;
    update bookings set status = 'accepted', talent_agreed_at = now(), updated_at = now() where id = b.id;
    perform _log(b.id, 'talent', t.name || ' accepted and agreed to the booking agreement.');
    perform _notify(b.brand_id, b.id, _first(t.name) || ' accepted “' || b.title || '”. Pay the ' || _gbp(b.deposit_p) || ' deposit to confirm.');
  else
    update bookings set status = 'declined', cancel_reason = nullif(trim(p_reason), ''), updated_at = now() where id = b.id;
    perform _log(b.id, 'talent', t.name || ' declined' || coalesce(': ' || nullif(trim(p_reason), ''), '.'));
    perform _notify(b.brand_id, b.id, _first(t.name) || ' can''t do “' || b.title || '”.');
  end if;
  return booking_detail(b.id);
end $$;

create or replace function public.withdraw_offer(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('brand'); b bookings;
begin
  select * into b from bookings where id = p_id for update;
  if b.id is null or (b.brand_id <> u and _role() <> 'ops') then raise exception 'Booking not found'; end if;
  if b.status not in ('offer','accepted') then raise exception 'Only an offer that isn''t paid yet can be withdrawn. Cancel the booking instead.'; end if;
  update bookings set status = 'withdrawn', cancelled_at = now(), cancelled_by = 'brand', updated_at = now() where id = b.id;
  if b.link_id is not null then update booking_links set status = 'open', booking_id = null where id = b.link_id and expires_at > now(); end if;
  perform _log(b.id, 'brand', 'Offer withdrawn by the brand.');
  perform _notify(b.talent_id, b.id, (select name from brands where id = b.brand_id) || ' withdrew the offer for “' || b.title || '”.');
  return booking_detail(b.id);
end $$;

-- talent cancels an accepted booking before the deposit is paid
create or replace function public.talent_withdraw(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('talent'); b bookings;
begin
  select * into b from bookings where id = p_id for update;
  if b.id is null or b.talent_id <> u then raise exception 'Booking not found'; end if;
  if b.status <> 'accepted' then raise exception 'Use Cancel booking for a confirmed booking'; end if;
  update bookings set status = 'cancelled', cancelled_at = now(), cancelled_by = 'talent', cancel_reason = nullif(trim(p_reason), ''), updated_at = now() where id = b.id;
  perform _log(b.id, 'talent', 'Talent pulled out before the deposit was paid' || coalesce(': ' || nullif(trim(p_reason), ''), '.'));
  perform _notify(b.brand_id, b.id, (select _first(name) from talents where id = u) || ' can no longer do “' || b.title || '”. Nothing was charged.');
  return booking_detail(b.id);
end $$;

create or replace function public.mark_wrapped(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('talent'); b bookings; s settings;
begin
  select * into s from settings where id = 1;
  select * into b from bookings where id = p_id for update;
  if b.id is null or b.talent_id <> u then raise exception 'Booking not found'; end if;
  if b.status <> 'confirmed' then raise exception 'Only a confirmed booking can be marked wrapped'; end if;
  if b.shoot_date > current_date then raise exception 'You can mark it wrapped on or after the shoot day'; end if;
  update bookings set status = 'wrapped', wrapped_at = now(), auto_signoff_at = now() + make_interval(hours => s.auto_signoff_hours),
    updated_at = now() where id = b.id;
  perform _log(b.id, 'talent', 'Talent marked the job wrapped. Signs off automatically in ' || s.auto_signoff_hours || ' hours unless a problem is reported.');
  perform _notify(b.brand_id, b.id, (select _first(name) from talents where id = u) || ' has wrapped “' || b.title ||
    '”. Sign off to pay the ' || _gbp(b.balance_p) || ' balance, or report a problem. It signs off automatically in ' || s.auto_signoff_hours || ' hours.');
  return booking_detail(b.id);
end $$;

create or replace function public.report_problem(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _uid(); b bookings; v text;
begin
  select * into b from bookings where id = p_id for update;
  if b.id is null then raise exception 'Booking not found'; end if;
  v := _can_see(b);
  if b.status not in ('confirmed','wrapped') then raise exception 'You can report a problem on a confirmed or wrapped booking'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'Say what went wrong'; end if;
  update bookings set status = 'disputed', dispute_reason = trim(p_reason), auto_signoff_at = null, updated_at = now() where id = b.id;
  perform _log(b.id, v, 'Problem reported by the ' || v || ': ' || trim(p_reason) || ' Payments are paused until Embr has spoken to both sides.');
  perform _notify(case when v = 'brand' then b.talent_id else b.brand_id end, b.id,
    'A problem was reported on “' || b.title || '”. Embr will be in touch. Payments are paused.');
  perform _notify_ops(b.id, 'Problem reported on ' || b.ref || ' (' || b.title || '): ' || trim(p_reason));
  return booking_detail(b.id);
end $$;

create or replace function public.send_message(p_id uuid, p_body text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _uid(); b bookings; v text; who text;
begin
  select * into b from bookings where id = p_id;
  if b.id is null then raise exception 'Booking not found'; end if;
  v := _can_see(b);
  if nullif(trim(p_body), '') is null then raise exception 'Write a message first'; end if;
  insert into messages (booking_id, sender, body) values (b.id, u, trim(p_body));
  insert into message_reads (booking_id, user_id) values (b.id, u) on conflict (booking_id, user_id) do update set read_at = now();
  who := case v when 'brand' then (select name from brands where id = b.brand_id)
                when 'talent' then (select _first(name) from talents where id = b.talent_id) else 'Embr' end;
  if v <> 'talent' then perform _notify(b.talent_id, b.id, who || ' sent a message about “' || b.title || '”', null, true); end if;
  if v <> 'brand' then perform _notify(b.brand_id, b.id, who || ' sent a message about “' || b.title || '”', null, true); end if;
  return booking_detail(b.id);
end $$;

create or replace function public.notifications() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'text', text, 'url', url, 'read', read_at is not null, 'at', created_at)
    order by created_at desc), '[]')
  from (select * from notifications where user_id = _uid() order by created_at desc limit 40) n $$;

create or replace function public.read_notifications() returns void
language sql security definer set search_path = public as $$
  update notifications set read_at = now() where user_id = _uid() and read_at is null $$;

-- ---------------------------------------------------------------- booking links
create or replace function public.create_link(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('talent'); t talents; c text; l booking_links;
begin
  select * into t from talents where id = u;
  if not t.age_verified then raise exception 'Verify your ID (18+) before creating booking links'; end if;
  if not t.payouts_enabled then raise exception 'Set up payouts before creating booking links'; end if;
  if nullif(trim(p->>'title'), '') is null then raise exception 'Say what the job is'; end if;
  if (p->>'shoot_date')::date < current_date then raise exception 'The shoot date has passed'; end if;
  if coalesce((p->>'day_rate')::int, 0) < 1 then raise exception 'Set a day rate'; end if;
  loop c := _code(7); exit when not exists (select 1 from booking_links where code = c); end loop;
  insert into booking_links (code, talent_id, title, shoot_date, days, day_rate, usage, usage_fee, note)
  values (c, u, trim(p->>'title'), (p->>'shoot_date')::date, coalesce((p->>'days')::int, 1), (p->>'day_rate')::int,
          nullif(trim(p->>'usage'), ''), coalesce((p->>'usage_fee')::int, 0), nullif(trim(p->>'note'), ''))
  returning * into l;
  return to_jsonb(l);
end $$;

create or replace function public.my_links() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(l) || jsonb_build_object('expired', l.expires_at < now(),
    'booking', (select _booking_row(b, 'talent') from bookings b where b.id = l.booking_id)) order by l.created_at desc), '[]')
  from booking_links l where l.talent_id = _need('talent') $$;

create or replace function public.withdraw_link(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update booking_links set status = 'withdrawn' where id = p_id and talent_id = _need('talent') and status = 'open' $$;

-- Public: what a brand sees when it opens a booking link (no sign-in needed)
create or replace function public.public_link(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare l booking_links; t talents; s settings; m record;
begin
  select * into l from booking_links where code = upper(trim(p_code));
  if l.id is null or l.status = 'withdrawn' then return null; end if;
  select * into t from talents where id = l.talent_id;
  select * into s from settings where id = 1;
  select * into m from _money(l.day_rate, l.days, l.usage_fee, s.fee_link);
  return jsonb_build_object('code', l.code, 'title', l.title, 'shoot_date', l.shoot_date, 'days', l.days,
    'day_rate', l.day_rate, 'usage', l.usage, 'usage_fee', l.usage_fee, 'note', l.note,
    'open', l.status = 'open' and l.expires_at > now() and l.shoot_date >= current_date,
    'status', l.status, 'fee_rate', s.fee_link, 'talent_fee_p', m.talent_fee_p, 'embr_fee_p', m.embr_fee_p,
    'total_p', m.total_p, 'deposit_p', m.deposit_p, 'balance_p', m.balance_p,
    'talent', _talent_card(t) || jsonb_build_object('bio', t.bio));
end $$;

-- Brand accepts a booking link: the talent already set the terms, so the
-- booking goes straight to "accepted" and the brand pays the deposit.
create or replace function public.accept_link(p_code text, p_agree boolean, p_extra jsonb default '{}') returns uuid
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('brand'); l booking_links; br brands; b bookings; t talents;
begin
  select * into l from booking_links where code = upper(trim(p_code)) for update;
  if l.id is null or l.status <> 'open' or l.expires_at < now() then raise exception 'This booking link has been used or has expired'; end if;
  if l.shoot_date < current_date then raise exception 'The date on this link has passed'; end if;
  if not p_agree then raise exception 'Tick the box to accept the booking agreement'; end if;
  select * into br from brands where id = u;
  if coalesce(br.name, '') = '' then raise exception 'Add your brand name first'; end if;
  select * into t from talents where id = l.talent_id;
  if not (t.age_verified and t.payouts_enabled) then raise exception 'This link can''t be booked right now'; end if;
  if not _is_free(l.talent_id, l.shoot_date, l.days) then raise exception '% is no longer free on that date', _first(t.name); end if;
  b := _new_booking(u, l.talent_id, jsonb_build_object('title', l.title, 'shoot_date', l.shoot_date, 'days', l.days,
         'day_rate', l.day_rate, 'usage', l.usage, 'usage_fee', l.usage_fee,
         'location', p_extra->>'location', 'call_time', p_extra->>'call_time', 'notes', p_extra->>'notes'), l.id);
  update bookings set status = 'accepted', talent_agreed_at = l.created_at where id = b.id;
  update booking_links set status = 'used', booking_id = b.id where id = l.id;
  perform _log(b.id, 'brand', br.name || ' booked through ' || t.name || '''s booking link and accepted the booking agreement.');
  perform _notify(l.talent_id, b.id, br.name || ' accepted your booking link for “' || l.title || '”. You''ll hear when the deposit is paid.');
  return b.id;
end $$;

-- Public Book-me page
create or replace function public.public_talent(p_handle text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t talents;
begin
  select * into t from talents where lower(handle) = lower(trim(leading '@' from trim(p_handle))) and published;
  if t.id is null then return null; end if;
  return _talent_full(t) - 'off_days' - 'comfort';
end $$;

-- ---------------------------------------------------------------- Embr ops (admin)
create or replace function public.ops_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform _need('ops');
  if _role() <> 'ops' then raise exception 'Not allowed'; end if;
  return jsonb_build_object(
    'talent', (select count(*) from talents), 'talent_live', (select count(*) from talents where published),
    'talent_verified', (select count(*) from talents where age_verified),
    'talent_payouts', (select count(*) from talents where payouts_enabled),
    'brands', (select count(*) from brands),
    'briefs', (select count(*) from briefs),
    'by_status', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from bookings group by status) x),
    'gmv_p', (select coalesce(sum(total_p), 0) from bookings where status = 'completed'),
    'fees_p', (select coalesce(sum(embr_fee_p), 0) from bookings where status = 'completed'),
    'paid_to_talent_p', (select coalesce(sum(paid_to_talent_p), 0) from bookings),
    'held_p', (select coalesce(sum(deposit_p), 0) from bookings where status in ('confirmed','wrapped','disputed')),
    'repeat_pairs', (select count(*) from (select 1 from bookings where status = 'completed' group by brand_id, talent_id having count(*) >= 2) x),
    'disputes', (select coalesce(jsonb_agg(_booking_row(b, 'ops')), '[]') from bookings b where status = 'disputed'),
    'stuck', (select coalesce(jsonb_agg(_booking_row(b, 'ops')), '[]') from bookings b
              where (status = 'wrapped' and auto_signoff_at < now() - interval '1 hour')
                 or (status = 'accepted' and updated_at < now() - interval '3 days')));
end $$;

create or replace function public.ops_bookings(p_status text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if _role() is distinct from 'ops' then raise exception 'Not allowed'; end if;
  return coalesce((select jsonb_agg(_booking_row(b, 'ops') order by b.created_at desc) from bookings b
                   where p_status is null or b.status = p_status), '[]');
end $$;

create or replace function public.ops_people() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if _role() is distinct from 'ops' then raise exception 'Not allowed'; end if;
  return jsonb_build_object(
    'talent', coalesce((select jsonb_agg(_talent_card(t) || jsonb_build_object('email', p.email, 'published', t.published,
        'identity_status', t.identity_status, 'payouts_enabled', t.payouts_enabled, 'dob', t.dob, 'joined', p.created_at,
        'bookings', (select count(*) from bookings where talent_id = t.id)) order by p.created_at desc)
      from talents t join profiles p on p.id = t.id), '[]'),
    'brands', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'contact_name', b.contact_name,
        'city', b.city, 'email', p.email, 'joined', p.created_at, 'has_card', b.stripe_customer is not null,
        'briefs', (select count(*) from briefs where brand_id = b.id),
        'bookings', (select count(*) from bookings where brand_id = b.id)) order by p.created_at desc)
      from brands b join profiles p on p.id = b.id), '[]'));
end $$;

create or replace function public.ops_briefs() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if _role() is distinct from 'ops' then raise exception 'Not allowed'; end if;
  return coalesce((select jsonb_agg(to_jsonb(b) || jsonb_build_object('brand', (select name from brands where id = b.brand_id),
    'ranked', _rank(b)) order by b.created_at desc) from briefs b where b.status = 'open'), '[]');
end $$;

create or replace function public.ops_create_invite(p_role text, p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if _role() is distinct from 'ops' then raise exception 'Not allowed'; end if;
  loop c := upper(left(p_role, 1)) || '-' || _code(6); exit when not exists (select 1 from invites where code = c); end loop;
  insert into invites (code, role, note, created_by) values (c, p_role, nullif(trim(p_note), ''), auth.uid());
  return c;
end $$;

create or replace function public.ops_invites() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if _role() is distinct from 'ops' then raise exception 'Not allowed'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('code', i.code, 'role', i.role, 'note', i.note, 'created_at', i.created_at,
    'used_at', i.used_at, 'used_by', (select email from profiles where id = i.used_by)) order by i.created_at desc) from invites i), '[]');
end $$;

create or replace function public.ops_message(p_id uuid, p_body text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if _role() is distinct from 'ops' then raise exception 'Not allowed'; end if;
  return send_message(p_id, p_body);
end $$;

-- First Embr staff invite. Works only while there is no ops account, and only
-- from the SQL editor (service role / postgres).
create or replace function public.first_ops_invite() returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if exists (select 1 from profiles where role = 'ops') then raise exception 'An Embr staff account already exists'; end if;
  c := 'OPS-' || _code(8);
  insert into invites (code, role, note) values (c, 'ops', 'First staff account');
  return c;
end $$;

-- ---------------------------------------------------------------- service functions (payments)
-- Only the server-side functions (service role) can call these.
create or replace function public.svc_booking(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(b) || jsonb_build_object(
    'talent_stripe_account', t.stripe_account, 'talent_payouts', t.payouts_enabled, 'talent_name', t.name,
    'talent_email', (select email from profiles where id = t.id),
    'brand_name', br.name, 'brand_customer', br.stripe_customer, 'brand_email', (select email from profiles where id = br.id),
    'days_to_shoot', b.shoot_date - (now() at time zone 'Europe/London')::date,
    'free_cancel_days', s.free_cancel_days, 'late_cancel_share', s.late_cancel_share)
  from bookings b join talents t on t.id = b.talent_id join brands br on br.id = b.brand_id
  cross join settings s where b.id = p_id $$;

create or replace function public.svc_talent(p_user uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', t.id, 'name', t.name, 'email', p.email, 'stripe_account', t.stripe_account,
    'identity_session', t.identity_session, 'age_verified', t.age_verified)
  from talents t join profiles p on p.id = t.id where t.id = p_user $$;

create or replace function public.svc_role_of(p_user uuid) returns text
language sql stable security definer set search_path = public as $$ select role from profiles where id = p_user $$;

-- take the money lock so two payment steps can't run at once
create or replace function public.svc_lock(p_id uuid, p_states text[]) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update bookings set money_lock = now()
  where id = p_id and status = any (p_states) and (money_lock is null or money_lock < now() - interval '2 minutes');
  get diagnostics n = row_count;
  return n = 1;
end $$;

create or replace function public.svc_unlock(p_id uuid) returns void
language sql security definer set search_path = public as $$ update bookings set money_lock = null where id = p_id $$;

create or replace function public.svc_set_customer(p_brand uuid, p_customer text) returns void
language sql security definer set search_path = public as $$ update brands set stripe_customer = p_customer where id = p_brand $$;

create or replace function public.svc_set_deposit_checkout(p_id uuid, p_session text) returns void
language sql security definer set search_path = public as $$ update bookings set deposit_checkout = p_session where id = p_id $$;

create or replace function public.svc_deposit_paid(p_id uuid, p_intent text, p_charge text, p_pm text) returns boolean
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  select * into b from bookings where id = p_id for update;
  if b.id is null then return false; end if;
  if b.status <> 'accepted' then
    -- already handled (webhook retry) or the booking was cancelled meanwhile
    return b.deposit_intent = p_intent;
  end if;
  update bookings set status = 'confirmed', deposit_intent = p_intent, deposit_charge = p_charge, payment_method = p_pm,
    deposit_paid_at = now(), updated_at = now(), money_lock = null where id = b.id;
  perform _log(b.id, 'brand', 'Deposit of ' || _gbp(b.deposit_p) || ' paid. Booking confirmed.');
  perform _notify(b.talent_id, b.id, 'Confirmed: “' || b.title || '” on ' || to_char(b.shoot_date, 'FMDD FMMon') || '. The deposit is paid.');
  perform _notify(b.brand_id, b.id, 'Deposit paid. “' || b.title || '” is confirmed.', null, true);
  return true;
end $$;

create or replace function public.svc_balance_checkout(p_id uuid, p_session text, p_url text) returns void
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  update bookings set balance_checkout = p_session, balance_checkout_url = p_url, money_lock = null where id = p_id returning * into b;
  perform _log(b.id, 'embr', 'The saved card needs the brand to confirm the balance payment.');
  perform _notify(b.brand_id, b.id, 'Your bank needs you to confirm the ' || _gbp(b.balance_p) || ' balance for “' || b.title || '”.');
end $$;

create or replace function public.svc_completed(p_id uuid, p_intent text, p_charge text, p_transfers text[], p_paid_p int, p_kind text)
returns void language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  select * into b from bookings where id = p_id for update;
  if b.status = 'completed' then return; end if;
  update bookings set status = 'completed', balance_intent = p_intent, balance_charge = p_charge, balance_paid_at = now(),
    transfer_ids = transfer_ids || p_transfers, paid_to_talent_p = paid_to_talent_p + p_paid_p, completed_at = now(),
    signoff_kind = p_kind, balance_checkout_url = null, money_lock = null, updated_at = now() where id = b.id;
  perform _log(b.id, p_kind, case p_kind when 'auto' then 'Signed off automatically, with no problem reported. '
                                         when 'ops' then 'Signed off by Embr. ' else 'Brand signed off. ' end ||
    'Balance of ' || _gbp(b.balance_p) || ' paid. ' || _gbp(p_paid_p) || ' sent to the talent.');
  perform _notify(b.talent_id, b.id, 'Paid: ' || _gbp(p_paid_p) || ' for “' || b.title || '” is on its way to your bank.');
  perform _notify(b.brand_id, b.id, '“' || b.title || '” is signed off and paid. Thanks for booking through Embr.');
end $$;

create or replace function public.svc_cancelled(p_id uuid, p_by text, p_reason text, p_refund_ids text[], p_refunded_p int,
  p_transfers text[], p_paid_p int) returns void
language plpgsql security definer set search_path = public as $$
declare b bookings; msg text;
begin
  select * into b from bookings where id = p_id for update;
  update bookings set status = 'cancelled', cancelled_at = now(), cancelled_by = p_by, cancel_reason = nullif(trim(p_reason), ''),
    refund_ids = refund_ids || p_refund_ids, refunded_p = refunded_p + p_refunded_p,
    transfer_ids = transfer_ids || p_transfers, paid_to_talent_p = paid_to_talent_p + p_paid_p,
    auto_signoff_at = null, money_lock = null, updated_at = now() where id = b.id;
  msg := 'Cancelled by the ' || case p_by when 'ops' then 'Embr team' else p_by end || '. ' ||
         _gbp(p_refunded_p) || ' refunded to the brand' ||
         case when p_paid_p > 0 then ', ' || _gbp(p_paid_p) || ' paid to the talent.' else '.' end;
  perform _log(b.id, p_by, msg || coalesce(' Reason: ' || nullif(trim(p_reason), ''), ''));
  perform _notify(b.talent_id, b.id, '“' || b.title || '” was cancelled. ' ||
    case when p_paid_p > 0 then _gbp(p_paid_p) || ' is on its way to you.' else '' end);
  perform _notify(b.brand_id, b.id, '“' || b.title || '” was cancelled. ' || _gbp(p_refunded_p) || ' is being refunded to your card.');
end $$;

create or replace function public.svc_resolved(p_id uuid, p_refund_ids text[], p_refunded_p int, p_transfers text[], p_paid_p int, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  select * into b from bookings where id = p_id for update;
  update bookings set status = 'completed', completed_at = now(), signoff_kind = 'ops',
    refund_ids = refund_ids || p_refund_ids, refunded_p = refunded_p + p_refunded_p,
    transfer_ids = transfer_ids || p_transfers, paid_to_talent_p = paid_to_talent_p + p_paid_p,
    money_lock = null, updated_at = now() where id = b.id;
  perform _log(b.id, 'ops', 'Problem resolved by Embr. ' || _gbp(p_paid_p) || ' paid to the talent, ' || _gbp(p_refunded_p) ||
    ' refunded to the brand.' || coalesce(' ' || nullif(trim(p_note), ''), ''));
  perform _notify(b.talent_id, b.id, 'Embr has resolved the problem on “' || b.title || '”. ' || _gbp(p_paid_p) || ' paid to you.');
  perform _notify(b.brand_id, b.id, 'Embr has resolved the problem on “' || b.title || '”. ' || _gbp(p_refunded_p) || ' refunded.');
end $$;

create or replace function public.svc_due_autosignoff() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from bookings where status = 'wrapped' and auto_signoff_at <= now() and balance_checkout_url is null order by auto_signoff_at limit 25 $$;

create or replace function public.svc_set_stripe_account(p_user uuid, p_account text) returns void
language sql security definer set search_path = public as $$ update talents set stripe_account = p_account where id = p_user $$;

create or replace function public.svc_account_updated(p_account text, p_payouts boolean) returns void
language plpgsql security definer set search_path = public as $$
declare t talents;
begin
  select * into t from talents where stripe_account = p_account;
  if t.id is null or t.payouts_enabled = p_payouts then return; end if;
  update talents set payouts_enabled = p_payouts where id = t.id;
  perform _notify(t.id, null, case when p_payouts then 'Payouts are set up. Embr can now pay you for bookings.'
                                   else 'Stripe needs more details before it can pay you. Open Wallet to finish.' end, '/wallet');
end $$;

create or replace function public.svc_set_identity_session(p_user uuid, p_session text) returns void
language sql security definer set search_path = public as $$
  update talents set identity_session = p_session, identity_status = 'processing' where id = p_user $$;

create or replace function public.svc_identity_result(p_user uuid, p_session text, p_status text, p_dob date) returns void
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  if p_status = 'verified' then
    ok := p_dob is not null and p_dob <= (current_date - interval '18 years')::date;
    update talents set age_verified = ok, age_verified_at = case when ok then now() end,
      identity_status = case when ok then 'verified' else 'under_18' end, identity_session = p_session where id = p_user;
    perform _notify(p_user, null, case when ok then 'ID checked. You''re verified 18+ and can accept bookings.'
      else 'Your ID shows you''re under 18. Embr is for talent aged 18 and over.' end, '/profile');
    if not ok then perform _notify_ops(null, 'ID check returned under 18 for a talent account. Review it in People.'); end if;
  else
    update talents set identity_status = p_status where id = p_user and identity_session = p_session;
    if p_status = 'requires_input' then
      perform _notify(p_user, null, 'Your ID check couldn''t be completed. Open Profile to try again.', '/profile');
    end if;
  end if;
end $$;

create or replace function public.svc_event_seen(p_id text, p_type text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  insert into stripe_events (id, type) values (p_id, p_type);
  return false;
exception when unique_violation then return true;
end $$;

create or replace function public.svc_email_for(p_notification bigint) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', n.id, 'email', p.email, 'text', n.text, 'url', n.url, 'emailed', n.emailed_at is not null,
    'name', coalesce((select _first(name) from talents where id = p.id), (select contact_name from brands where id = p.id)))
  from notifications n join profiles p on p.id = n.user_id where n.id = p_notification and n.email $$;

create or replace function public.svc_emailed(p_notification bigint) returns void
language sql security definer set search_path = public as $$ update notifications set emailed_at = now() where id = p_notification $$;

-- ---------------------------------------------------------------- email hook
-- When a notification is created, call the send-email function. Needs the
-- pg_net extension and two settings stored in Supabase Vault (see SETUP.md).
-- If either is missing the notification still shows in the app.
create or replace function public._email_hook() returns trigger
language plpgsql security definer set search_path = public as $$
declare url text; key text;
begin
  if not new.email then return new; end if;
  begin
    select decrypted_secret into url from vault.decrypted_secrets where name = 'functions_url';
    select decrypted_secret into key from vault.decrypted_secrets where name = 'email_hook_secret';
    if url is not null and key is not null then
      perform net.http_post(url := url || '/send-email',
        body := jsonb_build_object('notification_id', new.id),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-embr-hook', key));
    end if;
  exception when others then
    raise warning 'email hook skipped: %', sqlerrm;
  end;
  return new;
end $$;
create trigger notifications_email after insert on public.notifications for each row execute function public._email_hook();

-- ---------------------------------------------------------------- permissions
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.check_invite(text), public.public_link(text), public.public_talent(text) to anon, authenticated;
grant execute on function
  public.me(), public.create_profile(text, text, text, text, jsonb),
  public.save_talent(jsonb), public.add_photo(text), public.remove_photo(uuid), public.cover_photo(uuid), public.toggle_off_day(date),
  public.save_brand(jsonb), public.search_talent(jsonb), public.talent_detail(uuid), public.toggle_shortlist(uuid), public.my_shortlist(),
  public.create_brief(jsonb), public.my_briefs(), public.brief_detail(uuid), public.close_brief(uuid),
  public.quote(uuid, int, int, int), public.create_offer(jsonb), public.my_bookings(), public.booking_detail(uuid),
  public.respond_offer(uuid, boolean, boolean, text), public.withdraw_offer(uuid), public.talent_withdraw(uuid, text),
  public.mark_wrapped(uuid), public.report_problem(uuid, text), public.send_message(uuid, text),
  public.notifications(), public.read_notifications(),
  public.create_link(jsonb), public.my_links(), public.withdraw_link(uuid), public.accept_link(text, boolean, jsonb),
  public.ops_overview(), public.ops_bookings(text), public.ops_people(), public.ops_briefs(),
  public.ops_create_invite(text, text), public.ops_invites(), public.ops_message(uuid, text)
to authenticated;

grant execute on all functions in schema public to service_role;
grant usage on schema public to anon, authenticated, service_role;

-- ---------------------------------------------------------------- photo storage
-- Public bucket for portfolio photos. Each talent can only write inside a
-- folder named after their own user id. 5 MB per file, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "talent upload own photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "talent update own photos" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "talent delete own photos" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
