-- Talent Today screen: something to see once setup is done (design: docs/dev/talent-engagement.md)
--  * profile_views: one row per brand per talent per day when a brand opens a profile
--  * talent_pulse(): the talent's own counts (brands who viewed or saved them, offers), never which brand
--  * embr_pulse(): whole-pilot weekly totals, no titles, names, dates or rates, nothing to act on
--  * confirm_dates(): one-tap "my free dates are up to date"
--  * a quiet in-app note when a brand saves a profile (at most one a day, no brand name)

create table if not exists public.profile_views (
  id bigint generated always as identity primary key,
  talent_id uuid not null references public.talents (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  day date not null default current_date,
  created_at timestamptz not null default now(),
  unique (talent_id, brand_id, day)
);
create index if not exists profile_views_talent_day on public.profile_views (talent_id, day desc);
alter table public.profile_views enable row level security;
-- no policies: only the functions below read or write it
revoke all on public.profile_views from anon, authenticated;

alter table public.talents add column if not exists dates_confirmed_at timestamptz;

-- a brand opening a live profile is counted once a day (staff and the talent themselves are not)
create or replace function public.talent_detail(p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare u uuid := _uid(); r text := _role(); t talents;
begin
  if r not in ('brand','ops') and u <> p_id then raise exception 'Not allowed'; end if;
  select * into t from talents where id = p_id;
  if t.id is null or (not t.published and r <> 'ops' and u <> p_id) then raise exception 'Profile not found'; end if;
  if r = 'brand' and t.published then
    insert into profile_views (talent_id, brand_id) values (p_id, u) on conflict (talent_id, brand_id, day) do nothing;
  end if;
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
  insert into shortlist (brand_id, talent_id) values (u, p_talent);
  if exists (select 1 from talents where id = p_talent and published)
     and not exists (select 1 from notifications where user_id = p_talent and text = 'A brand saved your profile'
                     and created_at > now() - interval '24 hours') then
    perform _notify(p_talent, null, 'A brand saved your profile', '/', false);
  end if;
  return true;
end $$;

create or replace function public.talent_pulse() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare u uuid := _need('talent'); t talents;
begin
  select * into t from talents where id = u;
  return jsonb_build_object(
    'views_7d', (select count(distinct brand_id) from profile_views where talent_id = u and day >= current_date - 6),
    'views_prev_7d', (select count(distinct brand_id) from profile_views where talent_id = u and day between current_date - 13 and current_date - 7),
    'views_total', (select count(distinct brand_id) from profile_views where talent_id = u),
    'saves_total', (select count(*) from shortlist where talent_id = u),
    'saves_7d', (select count(*) from shortlist where talent_id = u and created_at >= now() - interval '7 days'),
    'offers_total', (select count(*) from bookings where talent_id = u),
    'bookings_completed', (select count(*) from bookings where talent_id = u and status = 'completed'),
    'published', t.published,
    'dates_confirmed_at', t.dates_confirmed_at);
end $$;

-- whole-pilot totals only. Talent still can't read briefs: this returns counts, never rows.
create or replace function public.embr_pulse() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare u uuid := _need('talent'); t talents; city_briefs int; uk_briefs int; wk_bookings int; wk_brands int;
begin
  select * into t from talents where id = u;
  select count(*) filter (where city = t.city), count(*) into city_briefs, uk_briefs
    from briefs where created_at >= now() - interval '7 days';
  select count(*) into wk_bookings from bookings where deposit_paid_at >= now() - interval '7 days';
  select count(*) into wk_brands from brands where name <> '' and created_at >= now() - interval '7 days';
  return jsonb_build_object(
    'scope', case when city_briefs >= 3 then 'city' else 'uk' end,
    'city', t.city,
    'week', jsonb_build_object('briefs', case when city_briefs >= 3 then city_briefs else uk_briefs end,
      'bookings', wk_bookings, 'brands', wk_brands, 'total', uk_briefs + wk_bookings + wk_brands),
    'lifetime', jsonb_build_object('briefs', (select count(*) from briefs),
      'bookings', (select count(*) from bookings where deposit_paid_at is not null),
      'brands', (select count(*) from brands where name <> '')),
    'my_roles', coalesce((select jsonb_agg(jsonb_build_object('role', category, 'briefs', n) order by n desc, category)
       from (select category, count(*) n from briefs where created_at >= now() - interval '7 days' and category = any (t.roles)
             group by category having count(*) >= 2) x), '[]'));
end $$;

create or replace function public.confirm_dates() returns timestamptz
language sql volatile security definer set search_path = public as $$
  update talents set dates_confirmed_at = now() where id = _need('talent') returning dates_confirmed_at $$;

revoke execute on function public.talent_pulse(), public.embr_pulse(), public.confirm_dates() from public, anon;
grant execute on function public.talent_pulse(), public.embr_pulse(), public.confirm_dates() to authenticated;
grant execute on function public.talent_detail(uuid), public.toggle_shortlist(uuid) to authenticated;
grant execute on all functions in schema public to service_role;
