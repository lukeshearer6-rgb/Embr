-- Booking contract v2: usage in plain English, hours per day, and an in-app signature.
--
-- What changes for people:
--  * Brands (and talent on booking links) pick usage from fixed options: where, how long, which countries.
--    The agreement turns those picks into plain sentences. The old one-line `usage` text is still filled
--    in (as a short summary) so every existing screen keeps working.
--  * Offers can say how many hours a day the shoot runs.
--  * Talent sign by typing their full name. The database refuses an accept without it, and keeps the
--    name, the time, the agreement version and a SHA-256 fingerprint of the exact text they signed.
--  * Talent sign a booking link's terms when they create the link; the brand's booking completes it.
--
-- Payments are untouched: _money, fee_for, deposits and payouts are not changed here.
-- DRAFT wording for the invite-only pilot. It waits for the BPP Enterprise Clinic review (workflow-state D4).

alter table public.bookings add column if not exists usage_terms jsonb not null default '{}';
alter table public.bookings add column if not exists day_hours int check (day_hours between 1 and 16);
alter table public.bookings add column if not exists talent_signed_name text;
alter table public.bookings add column if not exists agreement_sha text;
alter table public.booking_links add column if not exists usage_terms jsonb not null default '{}';
alter table public.booking_links add column if not exists day_hours int check (day_hours between 1 and 16);
alter table public.booking_links add column if not exists talent_signed_name text;
alter table public.booking_links add column if not exists talent_signed_at timestamptz;

update public.settings set agreement_version = 'pilot-2026-11-v2' where id = 1;
alter table public.settings alter column agreement_version set default 'pilot-2026-11-v2';

-- ---------------------------------------------------------------- usage options
-- Keep in step with USAGE_WHERE, USAGE_MONTHS and USAGE_AREA in src/ui.js.
create or replace function public._usage_label(k text, long boolean default false) returns text
language sql immutable set search_path = public as $$
  select case k
    when 'social'     then case when long then 'Posts on the Client''s own social media, such as Instagram and TikTok. Not paid ads.' else 'Own social posts' end
    when 'paid_social' then case when long then 'Paid ads on social media and other websites.' else 'Paid social ads' end
    when 'web'        then case when long then 'The Client''s website and online shop.' else 'Website and shop' end
    when 'email'      then case when long then 'The Client''s emails and newsletters.' else 'Emails' end
    when 'print'      then case when long then 'In the Client''s shops and in print, such as posters, lookbooks and flyers.' else 'In-store and print' end
    when 'outdoor'    then case when long then 'Billboards, bus stops and other outdoor posters and screens.' else 'Billboards and outdoor' end
    when 'tv'         then case when long then 'Ads on TV, streaming services and in cinemas.' else 'TV and cinema' end
    when 'packaging'  then case when long then 'On the Client''s product packaging.' else 'Packaging' end
  end $$;

create or replace function public._usage_area(k text) returns text
language sql immutable set search_path = public as $$
  select case k when 'uk' then 'the UK' when 'europe' then 'the UK and Europe' when 'world' then 'anywhere in the world' end $$;

-- Checks and tidies what the app sends. {} means "not using the structured options" (old clients).
create or replace function public._usage_clean(p jsonb) returns jsonb
language plpgsql immutable set search_path = public as $$
declare w text[]; m int; a text;
begin
  if p is null or jsonb_typeof(p) <> 'object' or not (p ? 'where') then return '{}'; end if;
  if jsonb_typeof(p->'where') <> 'array' then raise exception 'Pick where the photos will be used'; end if;
  select coalesce(array_agg(distinct x order by x), '{}') into w from jsonb_array_elements_text(p->'where') x;
  if cardinality(w) = 0 then raise exception 'Pick where the photos will be used'; end if;
  if exists (select 1 from unnest(w) x where _usage_label(x) is null) then raise exception 'That usage option isn''t available'; end if;
  m := nullif(p->>'months', '')::int;
  if m is null or m not in (3, 6, 12, 24) then raise exception 'Pick how long the photos can be used for'; end if;
  a := coalesce(nullif(p->>'area', ''), 'uk');
  if _usage_area(a) is null then raise exception 'Pick which countries the photos can be used in'; end if;
  return jsonb_build_object('where', to_jsonb(w), 'months', m, 'area', a);
end $$;

-- "Own social posts, Paid social ads · 12 months · UK": fills the old usage column
create or replace function public._usage_summary(u jsonb) returns text
language sql immutable set search_path = public as $$
  select case when coalesce(u, '{}') = '{}' then null else
    (select string_agg(_usage_label(x), ', ' order by x) from jsonb_array_elements_text(u->'where') x)
    || ' · ' || (u->>'months') || ' months · '
    || case u->>'area' when 'uk' then 'UK' when 'europe' then 'UK and Europe' else 'Worldwide' end end $$;

-- Section 5 of the agreement
create or replace function public._usage_clause(b bookings) returns text
language plpgsql stable set search_path = public as $$
declare u jsonb := coalesce(b.usage_terms, '{}'); m text; a text;
begin
  if u = '{}' then
    return coalesce(nullif(b.usage, ''), 'No usage agreed beyond the Client''s internal use.') || E'\nAny other use needs a new booking through Embr.';
  end if;
  m := u->>'months'; a := _usage_area(u->>'area');
  return 'The Client can use the photos and video from this shoot:' || E'\n'
    || (select string_agg('- ' || _usage_label(x, true), E'\n' order by x) from jsonb_array_elements_text(u->'where') x) || E'\n'
    || 'For how long: ' || m || ' months from the day the first one goes live. If nothing has gone live 6 months after the shoot, the ' || m || ' months start then.' || E'\n'
    || 'Where: ' || a || '. Posts on the Client''s own pages can be seen from anywhere; paid ads and posters are aimed at ' || a || '.' || E'\n'
    || 'Included: shorter edits, crops and stills taken from the video.' || E'\n'
    || 'When the time runs out: posts already up can stay, but nothing new goes out and paid ads stop.' || E'\n'
    || 'The Client can keep the photos for its own archive, awards entries and press about this shoot.' || E'\n'
    || 'No AI changes to the Talent''s face, body or voice, and nothing used to train AI, unless both sides agree in writing in Embr.' || E'\n'
    || 'Anything else, such as other uses, more time or more countries, needs a new booking through Embr.';
end $$;

-- ---------------------------------------------------------------- agreement v2
create or replace function public._agreement(b bookings) returns text
language plpgsql stable security definer set search_path = public as $$
declare t talents; br brands; s settings;
begin
  select * into t from talents where id = b.talent_id;
  select * into br from brands where id = b.brand_id;
  select * into s from settings where id = 1;
  return format(
'EMBR BOOKING AGREEMENT  %s
Pilot version %s. Draft for the invite-only pilot, waiting for review by a solicitor. Not legal advice.

1. Who this is between
Client: %s
Talent: %s
Embr provides the booking software and takes payments through its payment provider, Stripe. Embr is not an agency: it does not find work for the Talent, and the Client chose and booked the Talent.
The Talent confirms they are 18 or over, have passed Embr''s ID check, and are self-employed and responsible for their own tax.

2. The job
%s
%s%s
Location: %s
Call time: %s
Hours: %s

3. The money
Session: %s (%s day%s at %s)
Usage: %s
Talent fee: %s. The Talent receives this in full. Embr takes no commission from the Talent.
Embr booking fee, paid by the Client: %s (%s, %s)
Total for the Client: %s

4. When the money moves
a) Deposit: %s of the total (%s), paid by the Client when the Talent accepts. The booking is confirmed once it is paid. Stripe holds it until sign-off.
b) Balance: %s, charged to the same card at sign-off.
c) After the shoot the Talent marks the job wrapped. The Client signs off, or reports a problem, within %s hours. If the Client does neither, the booking signs off automatically.
d) At sign-off the Talent is paid the full talent fee.

5. What the Client can do with the photos
%s

6. What the Talent will be asked to do
%s
Nothing outside this may be asked of the Talent on the day. The Talent may bring a chaperone.

7. If plans change
a) Client cancels %s or more days before the shoot: the deposit is refunded in full.
b) Client cancels less than %s days before the shoot: the Talent is paid %s of the session fee (%s) from the deposit and the rest is refunded.
c) Talent cancels: the Client''s deposit is refunded in full.

8. If something goes wrong
If the Client reports a problem, nothing is paid out until Embr has heard from both sides. Embr then decides how the money held is split, in line with this agreement.

9. Booking through Embr
For 12 months after this booking, the Client agrees to book this Talent through Embr.

10. The Talent''s own use
Unless agreed otherwise in messages, the Talent may use the images in their portfolio after the Client has published them.

11. Signing
%s
Both are electronic signatures and bind each side as if signed on paper. Embr keeps the signed copy, and either side can save a copy from the booking at any time.
This agreement is governed by the law of England and Wales.',
    b.ref, s.agreement_version,
    br.name, t.name,
    b.title, to_char(b.shoot_date, 'FMDay FMDD FMMonth YYYY'),
    case when b.days > 1 then ' for ' || b.days || ' days' else '' end,
    coalesce(nullif(b.location, ''), 'To be confirmed in Embr messages'),
    coalesce(nullif(b.call_time, ''), 'To be confirmed in Embr messages'),
    case when b.day_hours is null then 'As agreed in Embr messages'
         else 'Up to ' || b.day_hours || ' hours a day, including breaks. Anything longer must be agreed in Embr messages first.' end,
    _gbp(b.session_p), b.days, case when b.days > 1 then 's' else '' end, _gbp(b.day_rate * 100),
    coalesce(_usage_summary(b.usage_terms), nullif(b.usage, ''), 'None agreed') || case when b.usage_fee > 0 then ' (' || _gbp(b.usage_fee * 100) || ')' else ' (included)' end,
    _gbp(b.talent_fee_p),
    _gbp(b.embr_fee_p), (round(b.fee_rate * 100, 1))::text || '%', lower(b.fee_label),
    _gbp(b.total_p),
    (round(s.deposit_rate * 100))::text || '%', _gbp(b.deposit_p),
    _gbp(b.balance_p),
    s.auto_signoff_hours,
    _usage_clause(b),
    coalesce(nullif(b.content_agreed, ''), 'As described in the job above.'),
    s.free_cancel_days, s.free_cancel_days, (round(s.late_cancel_share * 100))::text || '%',
    _gbp(round(b.session_p * s.late_cancel_share)::int),
    case when b.link_id is not null
      then 'The Talent set these terms and signed them by typing their full name when they created the booking link. The Client agreed by booking through the link.'
      else 'The Client agreed by sending the offer. The Talent signs by typing their full name and tapping Sign and accept in Embr.' end);
end $$;

-- ---------------------------------------------------------------- creating bookings
create or replace function public._new_booking(p_brand uuid, p_talent uuid, p jsonb, p_link uuid default null) returns bookings
language plpgsql security definer set search_path = public as $$
declare f record; m record; b bookings; s settings; r text; v_role text; u jsonb := _usage_clean(p->'usage_terms');
begin
  select * into s from settings where id = 1;
  select * into f from fee_for(p_brand, p_talent, p_link is not null);
  select * into m from _money((p->>'day_rate')::int, coalesce((p->>'days')::int, 1), coalesce((p->>'usage_fee')::int, 0), f.rate);
  select case when nullif(p->>'role', '') = any (roles) then p->>'role' else roles[1] end into v_role from talents where id = p_talent;
  if nullif(p->>'day_hours', '') is not null and (p->>'day_hours')::int not between 1 and 16 then
    raise exception 'Hours a day should be between 1 and 16';
  end if;
  loop
    r := 'EMB-' || _code(6);
    exit when not exists (select 1 from bookings where ref = r);
  end loop;
  insert into bookings (ref, brand_id, talent_id, brief_id, link_id, title, shoot_date, days, day_rate, usage, usage_fee,
    location, call_time, notes, content_agreed, fee_rate, fee_label, session_p, talent_fee_p, embr_fee_p, total_p,
    deposit_p, balance_p, agreement_version, agreement_text, brand_agreed_at, role, usage_terms, day_hours)
  values (r, p_brand, p_talent, nullif(p->>'brief_id', '')::uuid, p_link, trim(p->>'title'), (p->>'shoot_date')::date,
    coalesce((p->>'days')::int, 1), (p->>'day_rate')::int, coalesce(_usage_summary(u), nullif(trim(p->>'usage'), '')), coalesce((p->>'usage_fee')::int, 0),
    nullif(trim(p->>'location'), ''), nullif(trim(p->>'call_time'), ''), nullif(trim(p->>'notes'), ''),
    nullif(trim(p->>'content_agreed'), ''), f.rate, f.label, m.session_p, m.talent_fee_p, m.embr_fee_p, m.total_p,
    m.deposit_p, m.balance_p, s.agreement_version, '', now(), v_role, u, nullif(p->>'day_hours', '')::int)
  returning * into b;
  update bookings set agreement_text = replace(_agreement(b), E'\nTalent: ' || (select name from talents where id = p_talent),
      E'\nTalent: ' || (select name from talents where id = p_talent) || ' (booked as: ' || v_role || ')')
  where id = b.id returning * into b;
  return b;
end $$;

-- A signature is a typed full name: at least two letters, no more than 120 characters.
create or replace function public._sign_name(p text) returns text
language plpgsql immutable set search_path = public as $$
declare n text := regexp_replace(trim(coalesce(p, '')), '\s+', ' ', 'g');
begin
  if length(regexp_replace(n, '[^[:alpha:]]', '', 'g')) < 2 then raise exception 'Type your full name to sign'; end if;
  if length(n) > 120 then raise exception 'That name is too long'; end if;
  return n;
end $$;

-- ---------------------------------------------------------------- talent signs and accepts
drop function if exists public.respond_offer(uuid, boolean, boolean, text);
create or replace function public.respond_offer(p_id uuid, p_accept boolean, p_agree boolean default false, p_reason text default null,
  p_sign_name text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := _need('talent'); b bookings; t talents; n text;
begin
  select * into b from bookings where id = p_id for update;
  if b.id is null or b.talent_id <> u then raise exception 'Booking not found'; end if;
  if b.status <> 'offer' then raise exception 'This offer has already been answered'; end if;
  select * into t from talents where id = u;
  if p_accept then
    if not t.age_verified then raise exception 'Verify your ID (18+) before accepting bookings'; end if;
    if not t.payouts_enabled then raise exception 'Set up payouts so Embr can pay you before accepting'; end if;
    if not p_agree then raise exception 'Tick the box to accept the booking agreement'; end if;
    n := _sign_name(p_sign_name);
    if b.shoot_date < current_date then raise exception 'The shoot date has passed'; end if;
    if not _is_free(u, b.shoot_date, b.days, b.id) then raise exception 'You already have a booking on that date'; end if;
    update bookings set status = 'accepted', talent_agreed_at = now(), talent_signed_name = n,
      agreement_sha = encode(sha256(convert_to(agreement_text, 'UTF8')), 'hex'), updated_at = now() where id = b.id;
    perform _log(b.id, 'talent', t.name || ' accepted and signed the booking agreement as “' || n || '”.');
    perform _notify(b.brand_id, b.id, _first(t.name) || ' accepted “' || b.title || '”. Pay the ' || _gbp(b.deposit_p) || ' deposit to confirm.');
  else
    update bookings set status = 'declined', cancel_reason = nullif(trim(p_reason), ''), updated_at = now() where id = b.id;
    perform _log(b.id, 'talent', t.name || ' declined' || coalesce(': ' || nullif(trim(p_reason), ''), '.'));
    perform _notify(b.brand_id, b.id, _first(t.name) || ' can''t do “' || b.title || '”.');
  end if;
  return booking_detail(b.id);
end $$;

-- ---------------------------------------------------------------- booking links
create or replace function public.create_link(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('talent'); t talents; c text; l booking_links; v jsonb := _usage_clean(p->'usage_terms'); n text;
begin
  select * into t from talents where id = u;
  if not t.age_verified then raise exception 'Verify your ID (18+) before creating booking links'; end if;
  if not t.payouts_enabled then raise exception 'Set up payouts before creating booking links'; end if;
  if nullif(trim(p->>'title'), '') is null then raise exception 'Say what the job is'; end if;
  if (p->>'shoot_date')::date < current_date then raise exception 'The shoot date has passed'; end if;
  if coalesce((p->>'day_rate')::int, 0) < 1 then raise exception 'Set a day rate'; end if;
  if nullif(p->>'day_hours', '') is not null and (p->>'day_hours')::int not between 1 and 16 then
    raise exception 'Hours a day should be between 1 and 16';
  end if;
  n := _sign_name(p->>'sign_name');
  loop c := _code(7); exit when not exists (select 1 from booking_links where code = c); end loop;
  insert into booking_links (code, talent_id, title, shoot_date, days, day_rate, usage, usage_fee, note, role,
    usage_terms, day_hours, talent_signed_name, talent_signed_at)
  values (c, u, trim(p->>'title'), (p->>'shoot_date')::date, coalesce((p->>'days')::int, 1), (p->>'day_rate')::int,
          coalesce(_usage_summary(v), nullif(trim(p->>'usage'), '')), coalesce((p->>'usage_fee')::int, 0), nullif(trim(p->>'note'), ''),
          case when nullif(p->>'role', '') = any (t.roles) then p->>'role' else t.roles[1] end,
          v, nullif(p->>'day_hours', '')::int, n, now())
  returning * into l;
  return to_jsonb(l);
end $$;

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
         'day_rate', l.day_rate, 'usage', l.usage, 'usage_fee', l.usage_fee, 'role', l.role,
         'usage_terms', l.usage_terms, 'day_hours', l.day_hours,
         'location', p_extra->>'location', 'call_time', p_extra->>'call_time', 'notes', p_extra->>'notes'), l.id);
  -- links made before signatures existed carry no name: the record then shows only the link's date
  update bookings set status = 'accepted', talent_agreed_at = coalesce(l.talent_signed_at, l.created_at),
    talent_signed_name = l.talent_signed_name,
    agreement_sha = encode(sha256(convert_to(agreement_text, 'UTF8')), 'hex') where id = b.id;
  update booking_links set status = 'used', booking_id = b.id where id = l.id;
  perform _log(b.id, 'brand', br.name || ' booked through ' || t.name || '''s booking link and accepted the booking agreement.');
  perform _notify(l.talent_id, b.id, br.name || ' accepted your booking link for “' || l.title || '”. You''ll hear when the deposit is paid.');
  return b.id;
end $$;

create or replace function public.public_link(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare l booking_links; t talents; s settings; m record;
begin
  select * into l from booking_links where code = upper(trim(p_code));
  if l.id is null or l.status = 'withdrawn' then return null; end if;
  select * into t from talents where id = l.talent_id;
  select * into s from settings where id = 1;
  select * into m from _money(l.day_rate, l.days, l.usage_fee, s.fee_link);
  return jsonb_build_object('code', l.code, 'title', l.title, 'shoot_date', l.shoot_date, 'days', l.days, 'role', l.role,
    'day_rate', l.day_rate, 'usage', l.usage, 'usage_fee', l.usage_fee, 'note', l.note,
    'usage_terms', l.usage_terms, 'day_hours', l.day_hours, 'signed', l.talent_signed_name is not null,
    'open', l.status = 'open' and l.expires_at > now() and l.shoot_date >= current_date,
    'status', l.status, 'fee_rate', s.fee_link, 'talent_fee_p', m.talent_fee_p, 'embr_fee_p', m.embr_fee_p,
    'total_p', m.total_p, 'deposit_p', m.deposit_p, 'balance_p', m.balance_p,
    'talent', _talent_card(t) || jsonb_build_object('bio', t.bio));
end $$;

-- ---------------------------------------------------------------- shoots (several creatives, one brief)
alter table public.shoots add column if not exists usage_terms jsonb not null default '{}';
alter table public.shoots add column if not exists day_hours int check (day_hours between 1 and 16);

create or replace function public.create_shoot(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('brand'); v_id uuid; v jsonb := _usage_clean(p->'usage_terms');
begin
  if nullif(trim(p->>'title'), '') is null then raise exception 'Name this shoot'; end if;
  if (p->>'shoot_date')::date < current_date then raise exception 'The shoot date has passed'; end if;
  if nullif(p->>'brief_id', '') is not null and not exists (select 1 from briefs where id = (p->>'brief_id')::uuid and brand_id = u) then
    raise exception 'Brief not found';
  end if;
  if nullif(trim(p->>'board_link'), '') is not null and trim(p->>'board_link') !~* '^https://' then
    raise exception 'The moodboard link should start with https://';
  end if;
  if nullif(p->>'day_hours', '') is not null and (p->>'day_hours')::int not between 1 and 16 then
    raise exception 'Hours a day should be between 1 and 16';
  end if;
  insert into shoots (brand_id, brief_id, title, shoot_date, days, location, call_time, brief, usage, content_agreed, moodboard, board_link,
    usage_terms, day_hours)
  values (u, nullif(p->>'brief_id', '')::uuid, trim(p->>'title'), (p->>'shoot_date')::date, greatest(1, least(14, coalesce((p->>'days')::int, 1))),
    nullif(trim(p->>'location'), ''), nullif(trim(p->>'call_time'), ''), nullif(trim(p->>'brief'), ''),
    coalesce(_usage_summary(v), nullif(trim(p->>'usage'), '')),
    nullif(trim(p->>'content_agreed'), ''), _mood_in(u, p->'moodboard'), nullif(trim(p->>'board_link'), ''),
    v, nullif(p->>'day_hours', '')::int)
  returning shoots.id into v_id;
  return v_id;
end $$;

create or replace function public.shoot_offer(p_shoot uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('brand'); s shoots; v_id uuid;
begin
  select * into s from shoots where shoots.id = p_shoot and brand_id = u;
  if s.id is null then raise exception 'Shoot not found'; end if;
  v_id := create_offer(p || jsonb_build_object('title', s.title, 'shoot_date', s.shoot_date, 'location', s.location,
    'call_time', s.call_time, 'usage', s.usage, 'usage_terms', s.usage_terms, 'day_hours', s.day_hours,
    'content_agreed', s.content_agreed, 'brief_id', s.brief_id,
    'days', least(coalesce((p->>'days')::int, s.days), s.days), 'usage_fee', 0));
  update bookings set shoot_id = s.id where bookings.id = v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------- booking screen
create or replace function public.booking_detail(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b bookings; v text;
begin
  select * into b from bookings where id = p_id;
  if b.id is null then raise exception 'Booking not found'; end if;
  v := _can_see(b);
  insert into message_reads (booking_id, user_id) values (b.id, auth.uid())
    on conflict (booking_id, user_id) do update set read_at = now();
  return _booking_json(b, v) || jsonb_build_object('role', b.role, 'usage_terms', b.usage_terms, 'day_hours', b.day_hours,
    'agreement_version', b.agreement_version, 'talent_signed_name', b.talent_signed_name, 'agreement_sha', b.agreement_sha);
end $$;

-- ---------------------------------------------------------------- grants
-- new helpers are internal only; the re-created respond_offer is opened to signed-in users again
revoke execute on function public._usage_label(text, boolean), public._usage_area(text), public._usage_clean(jsonb),
  public._usage_summary(jsonb), public._usage_clause(bookings), public._sign_name(text) from public, anon, authenticated;
revoke execute on function public.respond_offer(uuid, boolean, boolean, text, text) from public, anon;
grant execute on function public.respond_offer(uuid, boolean, boolean, text, text) to authenticated;
grant execute on all functions in schema public to service_role;
