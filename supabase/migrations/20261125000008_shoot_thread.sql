-- Shoot Thread (docs/dev/shoot-thread.md).
--
-- A brand sends one shoot brief (moodboard, date, location, call time) to everyone in a Shoot Roster.
-- Each creative still gets their own offer and booking, so deposits, holds, payouts, cancellation and
-- the booking agreement work exactly as before. This adds:
--
-- 1. shoots: the shared brief. bookings.shoot_id ties each offer to it.
-- 2. offer_changes: a creative can ask the brand to change an offer they haven't answered yet
--    (a different day rate, or a note such as a later call time). It is a request, never an offer:
--    only the brand can change the offer, and talent still can't create offers or contact brands
--    outside a booking the brand started (docs/decisions.md, agency position 2026-11-20).
-- 3. A brand-only shoot view, a talent view of the brief for their own booking only (no other
--    creatives' names or rates), and "message everyone" that posts into each booking's own messages.
--
-- Nothing here touches payments.ts, Stripe, deposits or payouts. Changing an offer is only allowed
-- while it is unanswered (status 'offer'), when no money has moved, and it re-prices through the same
-- fee_for() and _money() that create_offer uses and regenerates the agreement text.

create table public.shoots (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  brief_id uuid references public.briefs (id) on delete set null,
  title text not null check (length(title) between 1 and 200),
  shoot_date date not null,
  days int not null default 1 check (days between 1 and 14),
  location text,
  call_time text,
  brief text check (length(brief) <= 4000),
  usage text,
  content_agreed text,
  moodboard text[] not null default '{}',   -- storage paths in the photos bucket, inside the brand's own folder
  board_link text,                           -- an outside moodboard (Pinterest, Drive), optional
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.shoots (brand_id, shoot_date);
alter table public.shoots enable row level security;

alter table public.bookings add column if not exists shoot_id uuid references public.shoots (id) on delete set null;
create index if not exists bookings_shoot_id_idx on public.bookings (shoot_id);

create table public.offer_changes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  day_rate int check (day_rate between 1 and 100000),     -- null: no change to the rate
  was_day_rate int not null,
  note text check (length(note) <= 1000),
  status text not null default 'open' check (status in ('open', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  answered_at timestamptz
);
create index on public.offer_changes (booking_id, created_at);
create unique index offer_changes_one_open on public.offer_changes (booking_id) where status = 'open';
alter table public.offer_changes enable row level security;

-- ---------------------------------------------------------------- helpers
create or replace function public._mood_in(u uuid, p jsonb) returns text[]
language plpgsql immutable as $$
declare out text[] := '{}'; x text;
begin
  for x in select jsonb_array_elements_text(coalesce(p, '[]'::jsonb)) loop
    -- only files the brand uploaded to its own folder, so a shoot can't point at someone else's photos
    if x !~ ('^' || u::text || '/[A-Za-z0-9._-]+$') then raise exception 'That moodboard image isn''t yours'; end if;
    out := out || x;
  end loop;
  if cardinality(out) > 12 then raise exception 'A moodboard holds up to 12 images'; end if;
  return out;
end $$;

create or replace function public._shoot_json(s shoots) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', s.id, 'title', s.title, 'shoot_date', s.shoot_date, 'days', s.days,
    'location', s.location, 'call_time', s.call_time, 'brief', s.brief, 'usage', s.usage,
    'content_agreed', s.content_agreed, 'moodboard', to_jsonb(s.moodboard), 'board_link', s.board_link,
    'brand', (select jsonb_build_object('id', br.id, 'name', br.name) from brands br where br.id = s.brand_id)) $$;

create or replace function public._changes_json(b uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'day_rate', c.day_rate, 'was_day_rate', c.was_day_rate,
    'note', c.note, 'status', c.status, 'at', c.created_at, 'answered_at', c.answered_at) order by c.created_at), '[]')
  from offer_changes c where c.booking_id = b $$;

-- ---------------------------------------------------------------- brand: create and send
create or replace function public.create_shoot(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('brand'); v_id uuid;
begin
  if nullif(trim(p->>'title'), '') is null then raise exception 'Name this shoot'; end if;
  if (p->>'shoot_date')::date < current_date then raise exception 'The shoot date has passed'; end if;
  if nullif(p->>'brief_id', '') is not null and not exists (select 1 from briefs where id = (p->>'brief_id')::uuid and brand_id = u) then
    raise exception 'Brief not found';
  end if;
  if nullif(trim(p->>'board_link'), '') is not null and trim(p->>'board_link') !~* '^https://' then
    raise exception 'The moodboard link should start with https://';
  end if;
  insert into shoots (brand_id, brief_id, title, shoot_date, days, location, call_time, brief, usage, content_agreed, moodboard, board_link)
  values (u, nullif(p->>'brief_id', '')::uuid, trim(p->>'title'), (p->>'shoot_date')::date, greatest(1, least(14, coalesce((p->>'days')::int, 1))),
    nullif(trim(p->>'location'), ''), nullif(trim(p->>'call_time'), ''), nullif(trim(p->>'brief'), ''), nullif(trim(p->>'usage'), ''),
    nullif(trim(p->>'content_agreed'), ''), _mood_in(u, p->'moodboard'), nullif(trim(p->>'board_link'), ''))
  returning shoots.id into v_id;
  return v_id;
end $$;

-- One offer in a shoot: the shared details come from the shoot, so everyone gets the same brief.
-- Per person: talent, role, day rate, days (a half-day package books one day) and their own notes.
create or replace function public.shoot_offer(p_shoot uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('brand'); s shoots; v_id uuid;
begin
  select * into s from shoots where shoots.id = p_shoot and brand_id = u;
  if s.id is null then raise exception 'Shoot not found'; end if;
  v_id := create_offer(p || jsonb_build_object('title', s.title, 'shoot_date', s.shoot_date, 'location', s.location,
    'call_time', s.call_time, 'usage', s.usage, 'content_agreed', s.content_agreed, 'brief_id', s.brief_id,
    'days', least(coalesce((p->>'days')::int, s.days), s.days), 'usage_fee', 0));
  update bookings set shoot_id = s.id where bookings.id = v_id;
  return v_id;
end $$;

-- The moodboard, brief text and outside link can change at any time. The date, place and call time are
-- part of each booking agreement, so they change through messages, not here.
create or replace function public.update_shoot(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('brand'); s shoots;
begin
  select * into s from shoots where id = p_id and brand_id = u for update;
  if s.id is null then raise exception 'Shoot not found'; end if;
  if nullif(trim(p->>'board_link'), '') is not null and trim(p->>'board_link') !~* '^https://' then
    raise exception 'The moodboard link should start with https://';
  end if;
  update shoots set brief = case when p ? 'brief' then nullif(trim(p->>'brief'), '') else brief end,
    moodboard = case when p ? 'moodboard' then _mood_in(u, p->'moodboard') else moodboard end,
    board_link = case when p ? 'board_link' then nullif(trim(p->>'board_link'), '') else board_link end,
    updated_at = now()
  where id = s.id;
  return shoot_detail(s.id);
end $$;

-- ---------------------------------------------------------------- brand: the thread
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
        'role', b.role, 'day_rate', b.day_rate, 'days', b.days, 'session_p', b.session_p, 'embr_fee_p', b.embr_fee_p,
        'fee_rate', b.fee_rate, 'fee_label', b.fee_label, 'location', b.location, 'call_time', b.call_time,
        'notes', b.notes, 'deposit_paid_at', b.deposit_paid_at, 'talent_agreed_at', b.talent_agreed_at,
        'brand_agreed_at', b.brand_agreed_at, 'cancel_reason', b.cancel_reason,
        'free_cancel_until', b.shoot_date - st.free_cancel_days, 'late_cancel_p', round(b.session_p * st.late_cancel_share)::int,
        'busy', b.money_lock is not null and b.money_lock > now() - interval '2 minutes',
        'changes', _changes_json(b.id),
        'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'body', m.body, 'at', m.created_at, 'mine', m.sender = u,
            'from', case when m.sender = b.brand_id then 'brand' when m.sender = b.talent_id then 'talent' else 'embr' end) order by m.created_at)
          from messages m where m.booking_id = b.id), '[]'))
      order by b.created_at) from bookings b where b.shoot_id = s.id), '[]'));
end $$;

create or replace function public.my_shoots() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'shoot_date', s.shoot_date, 'days', s.days,
    'location', s.location,
    'people', (select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'photo', _photo(t.id), 'status', b.status) order by b.created_at), '[]')
               from bookings b join talents t on t.id = b.talent_id where b.shoot_id = s.id),
    'to_pay', (select count(*) from bookings b where b.shoot_id = s.id and b.status = 'accepted'),
    'changes', (select count(*) from offer_changes c join bookings b on b.id = c.booking_id where b.shoot_id = s.id and c.status = 'open' and b.status = 'offer'),
    'unread', exists (select 1 from bookings b where b.shoot_id = s.id and _booking_row(b, 'brand')->>'unread' = 'true'))
    order by s.shoot_date desc), '[]')
  from shoots s where s.brand_id = _need('brand') and exists (select 1 from bookings b where b.shoot_id = s.id) $$;

-- One message from the brand into every live booking of the shoot (each creative sees it in their own
-- booking, as a normal message from the brand; nobody sees anyone else's conversation).
create or replace function public.shoot_message_all(p_id uuid, p_body text) returns int
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('brand'); s shoots; b bookings; n int := 0;
begin
  select * into s from shoots where id = p_id and brand_id = u;
  if s.id is null then raise exception 'Shoot not found'; end if;
  if nullif(trim(p_body), '') is null then raise exception 'Write a message first'; end if;
  for b in select * from bookings where shoot_id = s.id and status not in ('declined', 'withdrawn', 'cancelled') loop
    perform send_message(b.id, p_body);
    n := n + 1;
  end loop;
  if n = 0 then raise exception 'No one is booked on this shoot right now'; end if;
  return n;
end $$;

-- ---------------------------------------------------------------- both sides: the brief on one booking
-- The talent on a booking sees the shoot brief for that booking only: no other creatives, no other rates.
create or replace function public.booking_shoot(p_booking uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare b bookings; s shoots;
begin
  select * into b from bookings where id = p_booking;
  if b.id is null then raise exception 'Booking not found'; end if;
  perform _can_see(b);
  select * into s from shoots where id = b.shoot_id;
  return jsonb_build_object('shoot', case when s.id is null then null else _shoot_json(s) end, 'changes', _changes_json(b.id));
end $$;

-- ---------------------------------------------------------------- talent: ask for a change
create or replace function public.ask_change(p_booking uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('talent'); b bookings; r int := nullif(p->>'day_rate', '')::int; n text := nullif(trim(p->>'note'), '');
begin
  select * into b from bookings where id = p_booking for update;
  if b.id is null or b.talent_id <> u then raise exception 'Booking not found'; end if;
  if b.status <> 'offer' then raise exception 'You can only ask for a change before you answer the offer'; end if;
  if b.shoot_id is null then raise exception 'Changes can only be asked for on a shoot offer'; end if;
  if r = b.day_rate then r := null; end if;
  if r is null and n is null then raise exception 'Say what you''d like to change'; end if;
  if r is not null and r < 1 then raise exception 'Set a day rate'; end if;
  if exists (select 1 from offer_changes where booking_id = b.id and status = 'open') then
    raise exception 'You''ve already asked for a change. Wait for the brand to answer.';
  end if;
  insert into offer_changes (booking_id, day_rate, was_day_rate, note) values (b.id, r, b.day_rate, n);
  perform _log(b.id, 'talent', 'Talent asked for a change' || coalesce(': £' || r || ' a day', '') || coalesce(' (' || n || ')', '') || '.');
  perform _notify(b.brand_id, b.id, (select _first(name) from talents where id = u) || ' asked for a change to “' || b.title || '”' ||
    coalesce(': £' || r || ' a day', '') || '.');
  return booking_shoot(b.id);
end $$;

-- ---------------------------------------------------------------- brand: answer a change
-- Accepting re-prices the unanswered offer with the same fee rules as a new offer, regenerates its
-- booking agreement (the brand agrees to the new version by accepting), and tells the talent.
create or replace function public.answer_change(p_change uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('brand'); c offer_changes; b bookings; f record; m record; v_name text;
begin
  select * into c from offer_changes where id = p_change for update;
  if c.id is null then raise exception 'Change not found'; end if;
  select * into b from bookings where id = c.booking_id for update;
  if b.brand_id <> u then raise exception 'Change not found'; end if;
  if c.status <> 'open' then raise exception 'This change has already been answered'; end if;
  if b.status <> 'offer' then raise exception 'The offer has already been answered, so it can''t change now'; end if;
  select name into v_name from talents where id = b.talent_id;
  if p_accept then
    if c.day_rate is not null then
      select * into f from fee_for(b.brand_id, b.talent_id, b.link_id is not null);
      select * into m from _money(c.day_rate, b.days, b.usage_fee, f.rate);
      update bookings set day_rate = c.day_rate, fee_rate = f.rate, fee_label = f.label, session_p = m.session_p,
        talent_fee_p = m.talent_fee_p, embr_fee_p = m.embr_fee_p, total_p = m.total_p, deposit_p = m.deposit_p,
        balance_p = m.balance_p, brand_agreed_at = now(), updated_at = now()
      where id = b.id returning * into b;
      update bookings set agreement_text = replace(_agreement(b), E'\nTalent: ' || v_name, E'\nTalent: ' || v_name || ' (booked as: ' || b.role || ')')
      where id = b.id returning * into b;
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


revoke all on function public._mood_in(uuid, jsonb), public._shoot_json(shoots), public._changes_json(uuid) from public, anon, authenticated;
revoke all on function public.create_shoot(jsonb), public.shoot_offer(uuid, jsonb), public.update_shoot(uuid, jsonb),
  public.shoot_detail(uuid), public.my_shoots(), public.shoot_message_all(uuid, text), public.booking_shoot(uuid),
  public.ask_change(uuid, jsonb), public.answer_change(uuid, boolean) from public, anon;
grant execute on function public.create_shoot(jsonb), public.shoot_offer(uuid, jsonb), public.update_shoot(uuid, jsonb),
  public.shoot_detail(uuid), public.my_shoots(), public.shoot_message_all(uuid, text), public.booking_shoot(uuid),
  public.ask_change(uuid, jsonb), public.answer_change(uuid, boolean) to authenticated;
grant execute on all functions in schema public to service_role;
