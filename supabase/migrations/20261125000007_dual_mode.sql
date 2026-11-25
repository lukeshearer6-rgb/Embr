-- One person, two modes: brand and creative (talent) on one sign-in.
--
-- profiles.role stays the single source of truth for what a person can do right
-- now: every function already checks it through _need() and _role(). It now
-- means the ACTIVE mode. A person holds a mode when they have the matching row
-- in brands or talents. switch_mode() flips profiles.role between modes they
-- hold, and nothing else, so no rule is loosened:
--   * talent mode still cannot read briefs, search the board or make offers
--     (_need('brand') refuses), and brand mode cannot accept offers.
--   * each mode only sees its own side of a booking (_can_see now checks the
--     active mode as well as the id).
--   * Embr staff accounts can never hold or switch to another mode.
--   * a person can never book, save or count a view on themselves.
--   * adding the second mode needs an unused invite for that mode, same as
--     joining (Embr stays invite-only), and a new creative profile needs the
--     same 18+ date of birth, roles and agency-status declaration.
-- Payments are untouched: the payment functions already work out each side
-- from bookings.brand_id / talent_id, and self-bookings are blocked below.

-- ---------------------------------------------------------------- switch
create or replace function public.switch_mode(p_role text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _uid(); have text;
begin
  select role into have from profiles where id = u for update;
  if have is null then raise exception 'Finish setting up your account first'; end if;
  if have = 'ops' or p_role not in ('talent', 'brand') then raise exception 'Not allowed for this account' using errcode = '42501'; end if;
  if p_role = 'brand' and not exists (select 1 from brands where id = u) then raise exception 'Add a brand profile first'; end if;
  if p_role = 'talent' and not exists (select 1 from talents where id = u) then raise exception 'Add a creative profile first'; end if;
  if have <> p_role then update profiles set role = p_role where id = u; end if;
  return me();
end $$;

-- ---------------------------------------------------------------- add the other mode
create or replace function public.add_mode(p_role text, p_invite text, p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _uid(); have text; inv invites; dob date; rs text[]; nm text;
begin
  select role into have from profiles where id = u for update;
  if have is null then raise exception 'Finish setting up your account first'; end if;
  if have = 'ops' or p_role not in ('talent', 'brand') then raise exception 'Not allowed for this account' using errcode = '42501'; end if;
  if p_role = 'brand' and exists (select 1 from brands where id = u) then raise exception 'You already have a brand profile'; end if;
  if p_role = 'talent' and exists (select 1 from talents where id = u) then raise exception 'You already have a creative profile'; end if;

  select * into inv from invites where upper(code) = upper(trim(coalesce(p_invite, ''))) for update;
  if inv.code is null or inv.used_by is not null then raise exception 'That invite code isn''t valid or has been used'; end if;
  if inv.role <> p_role then raise exception 'That invite is for a % account', inv.role; end if;

  if p_role = 'talent' then
    dob := nullif(p_data->>'dob', '')::date;
    if dob is null or dob > (current_date - interval '18 years')::date then raise exception 'Embr is for talent aged 18 and over'; end if;
    rs := _roles_in(p_data->'roles');
    if coalesce(array_length(rs, 1), 0) = 0 then raise exception 'Pick at least one thing you do'; end if;
    if coalesce(p_data->>'agency', '') not in ('yes', 'true') then raise exception 'Confirm your agency status to continue'; end if;
    insert into talents (id, name, category, roles, city, dob, agency_declared_at, agency_declaration)
    values (u, coalesce(nullif(trim(p_data->>'name'), ''), ''), rs[1], rs, coalesce(nullif(p_data->>'city', ''), 'Manchester'), dob,
            now(), agency_declaration());
  else
    nm := nullif(trim(p_data->>'name'), '');
    if nm is null then raise exception 'Add your brand or company name'; end if;
    insert into brands (id, name, contact_name, city)
    values (u, nm, nullif(trim(p_data->>'contact_name'), ''), coalesce(nullif(p_data->>'city', ''), 'Manchester'));
  end if;
  update invites set used_by = u, used_at = now() where code = inv.code;
  update profiles set role = p_role where id = u;
  perform _notify_ops(null, (select email from profiles where id = u) || ' added a ' || case when p_role = 'brand' then 'brand' else 'creative' end
    || ' profile to their account');
  return me();
end $$;

-- ---------------------------------------------------------------- each mode sees its own side
create or replace function public._can_see(b bookings) returns text
language plpgsql stable security definer set search_path = public as $$
declare u uuid := _uid(); r text := _role();
begin
  if r = 'ops' then return 'ops'; end if;
  if r = 'brand' and b.brand_id = u then return 'brand'; end if;
  if r = 'talent' and b.talent_id = u then return 'talent'; end if;
  raise exception 'Booking not found';
end $$;

-- ---------------------------------------------------------------- never yourself
create or replace function public._not_self() returns trigger
language plpgsql as $$
begin
  if new.brand_id = new.talent_id then
    if tg_table_name = 'profile_views' then return null; end if;   -- just don't count it
    raise exception 'You can''t book or save your own creative profile';
  end if;
  return new;
end $$;
drop trigger if exists bookings_not_self on public.bookings;
create trigger bookings_not_self before insert or update of brand_id, talent_id on public.bookings for each row execute function public._not_self();
drop trigger if exists shortlist_not_self on public.shortlist;
create trigger shortlist_not_self before insert on public.shortlist for each row execute function public._not_self();
drop trigger if exists profile_views_not_self on public.profile_views;
create trigger profile_views_not_self before insert on public.profile_views for each row execute function public._not_self();

revoke execute on function public.switch_mode(text), public.add_mode(text, text, jsonb), public._can_see(bookings), public._not_self() from public, anon;
grant execute on function public.switch_mode(text), public.add_mode(text, text, jsonb) to authenticated;
