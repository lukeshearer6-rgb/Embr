-- Travel range decides which other cities a talent shows up in: "region" means
-- nearby cities only, "uk"/"international" means anywhere. Before this, any
-- travelling talent showed up in every city.

create or replace function public._region(c text) returns text
language sql immutable as $$
  select case c when 'Manchester' then 'north' when 'Liverpool' then 'north' when 'Leeds' then 'north'
    when 'Birmingham' then 'midlands' when 'London' then 'south' when 'Bristol' then 'south'
    when 'Glasgow' then 'scotland' else c end $$;

create or replace function public._travels_to(t talents, c text) returns boolean
language sql immutable as $$
  select c is null or t.city = c
    or t.travel_range in ('uk', 'international')
    or (t.travel_range = 'region' and _region(t.city) = _region(c))
    or (t.travel_range = 'local' and t.travels) $$;

create or replace function public._rank(b briefs) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(card order by rk), '[]') from (
    select _talent_card(t) || jsonb_build_object('away', t.city <> b.city,
             'offered', exists (select 1 from bookings k where k.brief_id = b.id and k.talent_id = t.id)) card,
           row_number() over (order by (t.city <> b.city), abs(coalesce(t.day_rate, 0) - b.day_rate), t.age_verified desc,
             (select count(*) from talent_photos p where p.talent_id = t.id and p.role = b.category)
               + (select count(*) from talent_links l where l.talent_id = t.id and l.role = b.category) desc, t.created_at) rk
    from talents t
    where t.published and b.category = any (t.roles) and _is_free(t.id, b.shoot_date, b.days)
      and (t.city = b.city or (b.travel = 'covered' and _travels_to(t, b.city)))
      and (b.category <> 'Model' or _fits(t, b.specs))
    order by rk limit 6) x $$;

create or replace function public.search_talent(f jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare u uuid := _need('brand'); v_q text := lower(trim(coalesce(f->>'q', ''))); v_d date := nullif(f->>'date', '')::date;
  v_city text := nullif(f->>'city', ''); v_cat text := nullif(f->>'category', ''); v_max int := nullif(f->>'max_rate', '')::int;
  v_specs jsonb := case when f->>'category' = 'Model' then _specs_in(f->'specs') else '{}' end;
begin
  return coalesce((
    select jsonb_agg(card || jsonb_build_object('saved', exists (select 1 from shortlist s where s.brand_id = u and s.talent_id = (card->>'id')::uuid),
                                                'away', away) order by away, score desc, (card->>'day_rate')::int)
    from (
      select _talent_card(t) card, (v_city is not null and t.city <> v_city) away,
             (case when t.age_verified then 1 else 0 end) + array_length(t.roles, 1) * 0.05
               + (select count(*) from talent_photos p where p.talent_id = t.id) * 0.02 score
      from talents t
      where t.published
        and (v_cat is null or v_cat = any (t.roles))
        and (v_max is null or t.day_rate <= v_max)
        and (v_d is null or _is_free(t.id, v_d))
        and (v_city is null or _travels_to(t, v_city))
        and _fits(t, v_specs)
        and (v_q = '' or lower(t.name || ' ' || array_to_string(t.roles, ' ') || ' ' || t.city || ' ' || coalesce(t.bio, '') || ' ' || array_to_string(t.tags, ' ') || ' ' || coalesce(t.hair, '')) like '%' || v_q || '%')
      limit 200) x), '[]');
end $$;


revoke execute on function public._region(text), public._travels_to(talents, text) from public, anon, authenticated;
grant execute on function public.search_talent(jsonb) to authenticated;
grant execute on all functions in schema public to service_role;
