-- Brand snag list (Luke, 2026-11-26), built on the booking contract (20261126000001).
--
-- What changes for people:
--  * Usage can run for any whole number of months from 1 to 120 (presets 3, 6, 12, 24 in the app, plus
--    a custom length such as 5 or 18). Several usages are already picked together, and the agreement
--    names every one (no "all of it").
--  * Briefs carry the same structured usage and a usage fee per person, separate from the day rate.
--    The day rate pays for the talent's time (the basic studio fee); the usage fee pays for using the photos.
--  * A shoot offer can carry its own usage fee (shoot_offer used to force £0) and can book a person for
--    some of the shoot's days: start_day (0 = the first day) plus days, inside the shoot.
--  * One booking can be for several of a creative's skills (for example Model and UGC creator).
--    bookings.roles holds them all; bookings.role stays as the first one so older screens keep working.
--  * Dates read as a range everywhere the agreement states them: "Wednesday 10 December 2026 to
--    Thursday 11 December 2026 (2 days)".
--  * Talent can add a phone number. Brands see it on a booking only once the booking is confirmed
--    (deposit paid), while it's live, and for 14 days after the shoot ends. Never on the board, profiles,
--    offers or cancelled bookings. The talent ticks consent when adding it and can remove it at any time.
--
-- Payments are untouched: _money, fee_for, deposits, payouts and payments.ts are not changed here.
-- DRAFT agreement wording for the invite-only pilot, waiting for the BPP review (workflow-state D4/D16).

-- ---------------------------------------------------------------- columns
alter table public.briefs add column if not exists usage_terms jsonb not null default '{}';
alter table public.briefs add column if not exists usage_fee int not null default 0 check (usage_fee between 0 and 1000000);
alter table public.bookings add column if not exists roles text[] not null default '{}';
update public.bookings set roles = array[role] where role is not null and roles = '{}';
alter table public.talents add column if not exists phone text;
alter table public.talents add column if not exists phone_consent_at timestamptz;

-- ---------------------------------------------------------------- small helpers
create or replace function public._months(n int) returns text
language sql immutable as $$ select n || case when n = 1 then ' month' else ' months' end $$;

-- "Wednesday 10 December 2026" or "Wednesday 10 December 2026 to Thursday 11 December 2026 (2 days)"
create or replace function public._date_range(d date, n int) returns text
language sql immutable as $$
  select to_char(d, 'FMDay FMDD FMMonth YYYY') || case when coalesce(n, 1) > 1
    then ' to ' || to_char(d + (n - 1), 'FMDay FMDD FMMonth YYYY') || ' (' || n || ' days)' else '' end $$;

-- "Model", "Model and UGC creator", "Model, Actor and UGC creator"
create or replace function public._and_list(a text[]) returns text
language sql immutable as $$
  select case when cardinality(a) is null or cardinality(a) = 0 then null
    when cardinality(a) = 1 then a[1]
    else array_to_string(a[1:cardinality(a) - 1], ', ') || ' and ' || a[cardinality(a)] end $$;

-- ---------------------------------------------------------------- usage: any length from 1 to 120 months
create or replace function public._usage_clean(p jsonb) returns jsonb
language plpgsql immutable set search_path = public as $$
declare w text[]; m int; a text;
begin
  if p is null or jsonb_typeof(p) <> 'object' or not (p ? 'where') then return '{}'; end if;
  if jsonb_typeof(p->'where') <> 'array' then raise exception 'Pick where the photos will be used'; end if;
  select coalesce(array_agg(distinct x order by x), '{}') into w from jsonb_array_elements_text(p->'where') x;
  if cardinality(w) = 0 then raise exception 'Pick where the photos will be used'; end if;
  if exists (select 1 from unnest(w) x where _usage_label(x) is null) then raise exception 'That usage option isn''t available'; end if;
  if coalesce(p->>'months', '') !~ '^\d{1,3}$' then raise exception 'Pick how long the photos can be used for'; end if;
  m := (p->>'months')::int;
  if m not between 1 and 120 then raise exception 'Usage can run from 1 to 120 months'; end if;
  a := coalesce(nullif(p->>'area', ''), 'uk');
  if _usage_area(a) is null then raise exception 'Pick which countries the photos can be used in'; end if;
  return jsonb_build_object('where', to_jsonb(w), 'months', m, 'area', a);
end $$;

create or replace function public._usage_summary(u jsonb) returns text
language sql immutable set search_path = public as $$
  select case when coalesce(u, '{}') = '{}' then null else
    (select string_agg(_usage_label(x), ', ' order by x) from jsonb_array_elements_text(u->'where') x)
    || ' · ' || _months((u->>'months')::int) || ' · '
    || case u->>'area' when 'uk' then 'UK' when 'europe' then 'UK and Europe' else 'Worldwide' end end $$;

create or replace function public._usage_clause(b bookings) returns text
language plpgsql stable set search_path = public as $$
declare u jsonb := coalesce(b.usage_terms, '{}'); m text; a text;
begin
  if u = '{}' then
    return coalesce(nullif(b.usage, ''), 'No usage agreed beyond the Client''s internal use.') || E'\nAny other use needs a new booking through Embr.';
  end if;
  m := _months((u->>'months')::int); a := _usage_area(u->>'area');
  return 'The Client can use the photos and video from this shoot:' || E'\n'
    || (select string_agg('- ' || _usage_label(x, true), E'\n' order by x) from jsonb_array_elements_text(u->'where') x) || E'\n'
    || 'For how long: ' || m || ' from the day the first one goes live. If nothing has gone live 6 months after the shoot, the ' || m || ' start then.' || E'\n'
    || 'Where: ' || a || '. Posts on the Client''s own pages can be seen from anywhere; paid ads and posters are aimed at ' || a || '.' || E'\n'
    || 'Included: shorter edits, crops and stills taken from the video.' || E'\n'
    || 'When the time runs out: posts already up can stay, but nothing new goes out and paid ads stop.' || E'\n'
    || 'The Client can keep the photos for its own archive, awards entries and press about this shoot.' || E'\n'
    || 'No AI changes to the Talent''s face, body or voice, and nothing used to train AI, unless both sides agree in writing in Embr.' || E'\n'
    || 'Anything else, such as other uses, more time or more countries, needs a new booking through Embr.';
end $$;

-- ---------------------------------------------------------------- agreement: date range, every skill, day rate and usage fee apart
create or replace function public._agreement(b bookings) returns text
language plpgsql stable security definer set search_path = public as $$
declare t talents; br brands; s settings; rs text := _and_list(case when cardinality(b.roles) > 0 then b.roles else array_remove(array[b.role], null) end);
begin
  select * into t from talents where id = b.talent_id;
  select * into br from brands where id = b.brand_id;
  select * into s from settings where id = 1;
  return format(
'EMBR BOOKING AGREEMENT  %s
Pilot version %s. Draft for the invite-only pilot, waiting for review by a solicitor. Not legal advice.

1. Who this is between
Client: %s
Talent: %s%s
Embr provides the booking software and takes payments through its payment provider, Stripe. Embr is not an agency: it does not find work for the Talent, and the Client chose and booked the Talent.
The Talent confirms they are 18 or over, have passed Embr''s ID check, and are self-employed and responsible for their own tax.

2. The job
%s
%s
Location: %s
Call time: %s
Hours: %s

3. The money
Day rate for the Talent''s time (basic studio fee): %s (%s day%s at %s)
Usage fee for using the photos and video: %s
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
b) Client cancels less than %s days before the shoot: the Talent is paid %s of the day rate (%s) from the deposit and the rest is refunded.
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
    br.name, t.name, case when rs is not null then ' (booked as: ' || rs || ')' else '' end,
    b.title, _date_range(b.shoot_date, b.days),
    coalesce(nullif(b.location, ''), 'To be confirmed in Embr messages'),
    coalesce(nullif(b.call_time, ''), 'To be confirmed in Embr messages'),
    case when b.day_hours is null then 'As agreed in Embr messages'
         else 'Up to ' || b.day_hours || ' hours a day, including breaks. Anything longer must be agreed in Embr messages first.' end,
    _gbp(b.session_p), b.days, case when b.days > 1 then 's' else '' end, _gbp(b.day_rate * 100),
    case when b.usage_fee > 0 then _gbp(b.usage_fee * 100) else '£0 (no separate usage fee)' end
      || ' for ' || coalesce(_usage_summary(b.usage_terms), nullif(b.usage, ''), 'no usage beyond internal use'),
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

-- ---------------------------------------------------------------- creating bookings: several skills
-- p->'roles' is a list; only skills on the creative's profile are kept, in the order given.
-- p->>'role' (one skill) still works for older clients and booking links.
create or replace function public._roles_for(p_talent uuid, p jsonb) returns text[]
language plpgsql stable security definer set search_path = public as $$
declare have text[]; out text[] := '{}'; x text;
begin
  select roles into have from talents where id = p_talent;
  if jsonb_typeof(p->'roles') = 'array' then
    for x in select jsonb_array_elements_text(p->'roles') loop
      if x = any (have) and not x = any (out) then out := out || x; end if;
    end loop;
  end if;
  if cardinality(out) = 0 and nullif(p->>'role', '') = any (have) then out := array[p->>'role']; end if;
  if cardinality(out) = 0 then out := array_remove(array[have[1]], null); end if;
  return out;
end $$;

create or replace function public._new_booking(p_brand uuid, p_talent uuid, p jsonb, p_link uuid default null) returns bookings
language plpgsql security definer set search_path = public as $$
declare f record; m record; b bookings; s settings; r text; v_roles text[] := _roles_for(p_talent, p); u jsonb := _usage_clean(p->'usage_terms');
begin
  select * into s from settings where id = 1;
  if coalesce((p->>'usage_fee')::int, 0) < 0 then raise exception 'The usage fee can''t be below £0'; end if;
  select * into f from fee_for(p_brand, p_talent, p_link is not null);
  select * into m from _money((p->>'day_rate')::int, coalesce((p->>'days')::int, 1), coalesce((p->>'usage_fee')::int, 0), f.rate);
  if nullif(p->>'day_hours', '') is not null and (p->>'day_hours')::int not between 1 and 16 then
    raise exception 'Hours a day should be between 1 and 16';
  end if;
  loop
    r := 'EMB-' || _code(6);
    exit when not exists (select 1 from bookings where ref = r);
  end loop;
  insert into bookings (ref, brand_id, talent_id, brief_id, link_id, title, shoot_date, days, day_rate, usage, usage_fee,
    location, call_time, notes, content_agreed, fee_rate, fee_label, session_p, talent_fee_p, embr_fee_p, total_p,
    deposit_p, balance_p, agreement_version, agreement_text, brand_agreed_at, role, roles, usage_terms, day_hours)
  values (r, p_brand, p_talent, nullif(p->>'brief_id', '')::uuid, p_link, trim(p->>'title'), (p->>'shoot_date')::date,
    coalesce((p->>'days')::int, 1), (p->>'day_rate')::int, coalesce(_usage_summary(u), nullif(trim(p->>'usage'), '')), coalesce((p->>'usage_fee')::int, 0),
    nullif(trim(p->>'location'), ''), nullif(trim(p->>'call_time'), ''), nullif(trim(p->>'notes'), ''),
    nullif(trim(p->>'content_agreed'), ''), f.rate, f.label, m.session_p, m.talent_fee_p, m.embr_fee_p, m.total_p,
    m.deposit_p, m.balance_p, s.agreement_version, '', now(), v_roles[1], v_roles, u, nullif(p->>'day_hours', '')::int)
  returning * into b;
  update bookings set agreement_text = _agreement(b) where id = b.id returning * into b;
  return b;
end $$;

-- the agreement now names the skills itself, so a re-priced offer no longer patches the text
create or replace function public.answer_change(p_change uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('brand'); c offer_changes; b bookings; f record; m record;
begin
  select * into c from offer_changes where id = p_change for update;
  if c.id is null then raise exception 'Change not found'; end if;
  select * into b from bookings where id = c.booking_id for update;
  if b.brand_id <> u then raise exception 'Change not found'; end if;
  if c.status <> 'open' then raise exception 'This change has already been answered'; end if;
  if b.status <> 'offer' then raise exception 'The offer has already been answered, so it can''t change now'; end if;
  if p_accept then
    if c.day_rate is not null then
      select * into f from fee_for(b.brand_id, b.talent_id, b.link_id is not null);
      select * into m from _money(c.day_rate, b.days, b.usage_fee, f.rate);
      update bookings set day_rate = c.day_rate, fee_rate = f.rate, fee_label = f.label, session_p = m.session_p,
        talent_fee_p = m.talent_fee_p, embr_fee_p = m.embr_fee_p, total_p = m.total_p, deposit_p = m.deposit_p,
        balance_p = m.balance_p, brand_agreed_at = now(), updated_at = now()
      where id = b.id returning * into b;
      update bookings set agreement_text = _agreement(b) where id = b.id returning * into b;
    end if;
    update offer_changes set status = 'accepted', answered_at = now() where id = c.id;
    perform _log(b.id, 'brand', 'Brand accepted the change' || coalesce(': offer updated to £' || c.day_rate || ' a day, ' || _gbp(b.talent_fee_p) || ' to the talent', '') ||
      '. ' || (select name from brands where id = u) || ' accepted the updated booking agreement.');
    perform _notify(b.talent_id, b.id, (select name from brands where id = u) || case when c.day_rate is not null
      then ' updated the offer for “' || b.title || '”: ' || _gbp(b.talent_fee_p) || ' to you. Review it and accept or decline.'
      else ' agreed to your change on “' || b.title || '”.' end);
  else
    update offer_changes set status = 'declined', answered_at = now() where id = c.id;
    perform _log(b.id, 'brand', 'Brand kept the original offer.');
    perform _notify(b.talent_id, b.id, (select name from brands where id = u) || ' kept the original offer for “' || b.title || '”. You can still accept or decline it.');
  end if;
  return shoot_detail(b.shoot_id);
end $$;

-- ---------------------------------------------------------------- shoot offers: some of the days, own usage fee
-- start_day: 0 is the shoot's first day. days: how many days in a row from there, inside the shoot.
create or replace function public.shoot_offer(p_shoot uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('brand'); s shoots; v_id uuid; st int := coalesce(nullif(p->>'start_day', '')::int, 0); n int;
begin
  select * into s from shoots where shoots.id = p_shoot and brand_id = u;
  if s.id is null then raise exception 'Shoot not found'; end if;
  n := coalesce(nullif(p->>'days', '')::int, s.days - st);
  if st < 0 or n < 1 or st + n > s.days then raise exception 'Pick days inside the shoot'; end if;
  if coalesce((p->>'usage_fee')::int, 0) < 0 then raise exception 'The usage fee can''t be below £0'; end if;
  v_id := create_offer(p || jsonb_build_object('title', s.title, 'shoot_date', s.shoot_date + st, 'location', s.location,
    'call_time', s.call_time, 'usage', s.usage, 'usage_terms', s.usage_terms, 'day_hours', s.day_hours,
    'content_agreed', s.content_agreed, 'brief_id', s.brief_id,
    'days', n, 'usage_fee', coalesce((p->>'usage_fee')::int, 0)));
  update bookings set shoot_id = s.id where bookings.id = v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------- briefs: structured usage and a usage fee
create or replace function public.create_brief(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('brand'); id uuid; s jsonb := _specs_in(p->'specs'); v jsonb := _usage_clean(p->'usage_terms');
begin
  if nullif(trim(p->>'title'), '') is null then raise exception 'Give the brief a title'; end if;
  if (p->>'shoot_date')::date < current_date then raise exception 'The shoot date has passed'; end if;
  if (s->>'height_min')::int > (s->>'height_max')::int then raise exception 'The lowest height is above the highest'; end if;
  if coalesce((p->>'usage_fee')::int, 0) < 0 then raise exception 'The usage fee can''t be below £0'; end if;
  insert into briefs (brand_id, title, category, city, shoot_date, days, day_rate, spots, travel, description, usage, specs, usage_terms, usage_fee)
  values (u, trim(p->>'title'), p->>'category', p->>'city', (p->>'shoot_date')::date, coalesce((p->>'days')::int, 1),
          (p->>'day_rate')::int, coalesce((p->>'spots')::int, 1), coalesce(p->>'travel', 'local'),
          nullif(trim(p->>'description'), ''), coalesce(_usage_summary(v), nullif(trim(p->>'usage'), '')),
          case when p->>'category' = 'Model' then s else '{}' end, v, coalesce((p->>'usage_fee')::int, 0))
  returning briefs.id into id;
  return id;
end $$;

-- ---------------------------------------------------------------- phone numbers
-- UK numbers are stored as +44…; other countries need the + and country code. Blank removes the number.
create or replace function public.save_phone(p_phone text, p_consent boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('talent'); n text := regexp_replace(coalesce(p_phone, ''), '[\s().-]', '', 'g');
begin
  if n = '' then
    update talents set phone = null, phone_consent_at = null where id = u;
    return my_phone();
  end if;
  if not coalesce(p_consent, false) then raise exception 'Tick the box to let brands with a confirmed booking see your number'; end if;
  if n ~ '^0\d{9,10}$' then n := '+44' || substr(n, 2);
  elsif n ~ '^0044\d{9,10}$' then n := '+' || substr(n, 3); end if;
  if n !~ '^\+[1-9]\d{7,14}$' then raise exception 'That doesn''t look like a phone number. Start UK numbers with 07, others with + and the country code.'; end if;
  update talents set phone = n, phone_consent_at = now() where id = u;
  return my_phone();
end $$;

create or replace function public.my_phone() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('phone', phone, 'consent_at', phone_consent_at) from talents where id = _need('talent') $$;

-- shown to the brand (and Embr staff) from the deposit until 14 days after the last shoot day
create or replace function public._phone_open(b bookings) returns boolean
language sql stable as $$
  select b.status in ('confirmed', 'wrapped', 'disputed')
      or (b.status = 'completed' and b.shoot_date + b.days + 14 > current_date) $$;

create or replace function public._talent_phone(b bookings, viewer text) returns text
language sql stable security definer set search_path = public as $$
  select case when viewer in ('brand', 'ops') and _phone_open(b) then (select phone from talents where id = b.talent_id) end $$;

-- ---------------------------------------------------------------- screens
create or replace function public.booking_detail(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b bookings; v text;
begin
  select * into b from bookings where id = p_id;
  if b.id is null then raise exception 'Booking not found'; end if;
  v := _can_see(b);
  insert into message_reads (booking_id, user_id) values (b.id, auth.uid())
    on conflict (booking_id, user_id) do update set read_at = now();
  return _booking_json(b, v) || jsonb_build_object('role', b.role, 'roles', to_jsonb(b.roles), 'usage_terms', b.usage_terms, 'day_hours', b.day_hours,
    'agreement_version', b.agreement_version, 'talent_signed_name', b.talent_signed_name, 'agreement_sha', b.agreement_sha,
    'talent_phone', _talent_phone(b, v), 'phone_open', _phone_open(b));
end $$;

create or replace function public.shoot_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare u uuid := _need('brand'); s shoots; st settings;
begin
  select * into s from shoots where id = p_id and brand_id = u;
  if s.id is null then raise exception 'Shoot not found'; end if;
  select * into st from settings where id = 1;
  return _shoot_json(s) || jsonb_build_object(
    'free_cancel_days', st.free_cancel_days, 'late_cancel_share', st.late_cancel_share,
    'auto_signoff_hours', st.auto_signoff_hours, 'deposit_rate', st.deposit_rate,
    'people', coalesce((select jsonb_agg(_booking_row(b, 'brand') || jsonb_build_object(
        'role', b.role, 'roles', to_jsonb(b.roles), 'day_rate', b.day_rate, 'days', b.days, 'session_p', b.session_p,
        'usage_fee', b.usage_fee, 'embr_fee_p', b.embr_fee_p,
        'fee_rate', b.fee_rate, 'fee_label', b.fee_label, 'location', b.location, 'call_time', b.call_time,
        'notes', b.notes, 'deposit_paid_at', b.deposit_paid_at, 'talent_agreed_at', b.talent_agreed_at,
        'brand_agreed_at', b.brand_agreed_at, 'cancel_reason', b.cancel_reason,
        'free_cancel_until', b.shoot_date - st.free_cancel_days, 'late_cancel_p', round(b.session_p * st.late_cancel_share)::int,
        'busy', b.money_lock is not null and b.money_lock > now() - interval '2 minutes',
        'phone', _talent_phone(b, 'brand'),
        'changes', _changes_json(b.id),
        'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'body', m.body, 'at', m.created_at, 'mine', m.sender = u,
            'from', case when m.sender = b.brand_id then 'brand' when m.sender = b.talent_id then 'talent' else 'embr' end) order by m.created_at)
          from messages m where m.booking_id = b.id), '[]'))
      order by b.created_at) from bookings b where b.shoot_id = s.id), '[]'));
end $$;

-- ---------------------------------------------------------------- grants
revoke execute on function public._months(int), public._date_range(date, int), public._and_list(text[]),
  public._roles_for(uuid, jsonb), public._phone_open(bookings), public._talent_phone(bookings, text)
  from public, anon, authenticated;
revoke execute on function public.save_phone(text, boolean), public.my_phone() from public, anon;
grant execute on function public.save_phone(text, boolean), public.my_phone() to authenticated;
grant execute on all functions in schema public to service_role;
