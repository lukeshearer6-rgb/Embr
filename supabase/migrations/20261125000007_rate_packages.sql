-- Rates and availability (docs/dev/rates-and-detail.md).
--
-- 1. Day-rate packages. Talent already have day_rate (full day) and half_rate (half day).
--    This adds what each package covers: hours and an optional "what's included" line,
--    kept in talents.packages as {"full": {"hours": 8, "includes": "..."}, "half": {...}}.
--    A brand picking a package only fills the existing day_rate and days of an offer,
--    so quote(), create_offer(), deposits, holds and payouts are unchanged.
-- 2. Blocked dates as ranges. talent_off_days stays one row per day; set_off_range()
--    blocks or frees every day between two dates in one go (toggle_off_day still works).
--
-- Brands already see day and half-day rates on a profile, so nothing new about money is exposed.

alter table public.talents add column if not exists packages jsonb not null default '{}'::jsonb;

-- the card every brand-facing list uses, now with packages (otherwise as 20261125000006_card_media.sql)
create or replace function public._talent_card(t talents) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', t.id, 'handle', t.handle, 'name', t.name, 'category', t.roles[1],
    'roles', to_jsonb(t.roles), 'city', t.city, 'height', t.height, 'day_rate', t.day_rate, 'half_rate', t.half_rate,
    'packages', t.packages,
    'travels', t.travels, 'travel_range', t.travel_range, 'travel_costs', t.travel_costs, 'agency_declared', t.agency_declared_at is not null, 'verified', t.age_verified, 'photo', _photo(t.id),
    'photos', coalesce((select jsonb_agg(p.path order by p.position, p.created_at)
                        from (select path, position, created_at from talent_photos where talent_id = t.id
                              order by position, created_at limit 5) p), '[]'::jsonb),
    'reel', (select jsonb_build_object('url', l.url, 'title', l.title, 'role', l.role)
             from talent_links l where l.talent_id = t.id order by l.position, l.created_at limit 1),
    'stats', case when 'Model' = any (t.roles) then _model_stats(t) end,
    'rebooked_by', (select count(*) from (select brand_id from bookings where talent_id = t.id and status = 'completed'
                    group by brand_id having count(*) >= 2) x)) $$;

-- one package from the editor: hours within the package's range, includes trimmed to 160 characters
create or replace function public._package_in(p jsonb, lo int, hi int, dflt int, what text) returns jsonb
language plpgsql immutable set search_path = public as $$
declare h int;
begin
  h := coalesce(nullif(p->>'hours', '')::int, dflt);
  if h < lo or h > hi then raise exception '% is between % and % hours', what, lo, hi; end if;
  return jsonb_build_object('hours', h, 'includes', left(nullif(trim(coalesce(p->>'includes', '')), ''), 160));
end $$;

-- the Rates editor: p = {day_rate, half_rate (blank turns half days off), full: {hours, includes}, half: {hours, includes}}
create or replace function public.save_rates(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('talent'); d int; h int;
begin
  d := nullif(p->>'day_rate', '')::int;
  h := nullif(p->>'half_rate', '')::int;
  if d is null or d < 5 then raise exception 'Set a full-day rate of at least £5'; end if;
  if d > 100000 or h > 100000 then raise exception 'That rate is too high'; end if;
  if h is not null and h < 5 then raise exception 'Set a half-day rate of at least £5, or turn half days off'; end if;
  if h is not null and h >= d then raise exception 'Your half-day rate should be less than your full-day rate'; end if;
  update talents set
    day_rate = d,
    half_rate = h,
    packages = jsonb_strip_nulls(jsonb_build_object(
      'full', _package_in(coalesce(p->'full', '{}'), 4, 12, 8, 'A full day'),
      'half', case when h is not null then _package_in(coalesce(p->'half', '{}'), 1, 6, 4, 'A half day') end)),
    updated_at = now()
  where id = u;
  perform _republish(u);
  return me();
end $$;

-- block (p_off true) or free every day from p_from to p_to; booked days stay booked either way
create or replace function public.set_off_range(p_from date, p_to date, p_off boolean default true) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('talent');
begin
  if p_from is null or p_to is null then raise exception 'Pick a first and last day'; end if;
  if p_to < p_from then raise exception 'The last day is before the first day'; end if;
  if p_from < current_date then raise exception 'That date has passed'; end if;
  if p_to - p_from > 92 then raise exception 'Block up to three months at a time'; end if;
  if p_off then
    insert into talent_off_days (talent_id, day)
      select u, d::date from generate_series(p_from, p_to, '1 day') d
      on conflict do nothing;
  else
    delete from talent_off_days where talent_id = u and day between p_from and p_to;
  end if;
  return me();
end $$;

revoke all on function public._package_in(jsonb, int, int, int, text) from public;
grant execute on function public.save_rates(jsonb), public.set_off_range(date, date, boolean) to authenticated;
