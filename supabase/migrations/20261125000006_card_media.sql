-- Talent cards carry a little more media for the board's swipeable card
-- (CreativeCard, docs/dev/creative-card.md): up to 5 photo paths in profile
-- order, and the first video link (showreel, UGC example, channel) if there is one.
-- Everything else is unchanged from 20261125000001_talent_snags.sql.
-- Nothing new is exposed: brands can already see every photo and link on the profile.

create or replace function public._talent_card(t talents) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', t.id, 'handle', t.handle, 'name', t.name, 'category', t.roles[1],
    'roles', to_jsonb(t.roles), 'city', t.city, 'height', t.height, 'day_rate', t.day_rate, 'half_rate', t.half_rate,
    'travels', t.travels, 'travel_range', t.travel_range, 'travel_costs', t.travel_costs, 'agency_declared', t.agency_declared_at is not null, 'verified', t.age_verified, 'photo', _photo(t.id),
    'photos', coalesce((select jsonb_agg(p.path order by p.position, p.created_at)
                        from (select path, position, created_at from talent_photos where talent_id = t.id
                              order by position, created_at limit 5) p), '[]'::jsonb),
    'reel', (select jsonb_build_object('url', l.url, 'title', l.title, 'role', l.role)
             from talent_links l where l.talent_id = t.id order by l.position, l.created_at limit 1),
    'stats', case when 'Model' = any (t.roles) then _model_stats(t) end,
    'rebooked_by', (select count(*) from (select brand_id from bookings where talent_id = t.id and status = 'completed'
                    group by brand_id having count(*) >= 2) x)) $$;
