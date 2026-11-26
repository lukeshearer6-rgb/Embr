-- Brand snag list 2 (Luke, 2026-11-26). Notes and evidence: docs/dev/brand-snags-2.md
--  * briefs hold several roles, each with its own head count, days, day-rate range, usage fee,
--    travel and (optional) gender; "only show talent within the range" is a brief-level switch
--  * briefs can be edited after posting (update_brief)
--  * options: a brand holds up to 3 people per place in a role, in order. The talent only ever sees
--    "Optioned", never their number. If the offer isn't answered in time or is declined, Embr asks the
--    brand whether to move to the next option. Booking someone releases the others.
--  * talent can add an optional gender to their profile
--  * cancellation: free until 48 hours before the shoot day begins (was 7 days). DRAFT: BPP review
--  * booking-link rate (5%) only when the brand hadn't already found that talent on Embr

-- ---------------------------------------------------------------- settings
-- 48 hours before 00:00 UK time on the first shoot day is the end of the day three days before, so the
-- existing date maths (shoot_date - free_cancel_days, days_to_shoot >= free_cancel_days in payments.ts)
-- stays right with free_cancel_days = 3. The check keeps the two settings in step.
alter table public.settings add column if not exists free_cancel_hours int not null default 48;
alter table public.settings add column if not exists option_hours int not null default 24 check (option_hours between 1 and 168);
update public.settings set free_cancel_hours = 48, free_cancel_days = 3, agreement_version = 'pilot-2026-11-v3' where id = 1;
alter table public.settings drop constraint if exists settings_free_cancel_match;
alter table public.settings add constraint settings_free_cancel_match check (free_cancel_hours = (free_cancel_days - 1) * 24);

-- the last day a brand can cancel for free: 48 hours before the first shoot day begins
create or replace function public._free_cancel_last_day(d date) returns date
language sql stable security definer set search_path = public as $$
  select d - (select free_cancel_days from settings where id = 1) $$;

-- ---------------------------------------------------------------- talent gender (optional)
-- Only used when a brief casts a particular gender, which the Equality Act 2010 allows where it is an
-- occupational requirement (Schedule 9 para 1; the explanatory notes name modelling jobs). Null means
-- the talent didn't say; they still appear for those briefs, after people who match.
alter table public.talents add column if not exists gender text check (gender in ('woman','man','non_binary'));

create or replace function public.save_gender(p_gender text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('talent');
begin
  if nullif(p_gender, '') is not null and p_gender not in ('woman','man','non_binary') then raise exception 'Pick one of the options, or leave it blank'; end if;
  update talents set gender = nullif(p_gender, '') where id = u;
  return jsonb_build_object('gender', nullif(p_gender, ''));
end $$;

create or replace function public._talent_card(t talents) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', t.id, 'handle', t.handle, 'name', t.name, 'category', t.roles[1],
    'roles', to_jsonb(t.roles), 'city', t.city, 'height', t.height, 'day_rate', t.day_rate, 'half_rate', t.half_rate,
    'packages', t.packages, 'gender', t.gender,
    'travels', t.travels, 'travel_range', t.travel_range, 'travel_costs', t.travel_costs, 'agency_declared', t.agency_declared_at is not null, 'verified', t.age_verified, 'photo', _photo(t.id),
    'photos', coalesce((select jsonb_agg(p.path order by p.position, p.created_at)
                        from (select path, position, created_at from talent_photos where talent_id = t.id
                              order by position, created_at limit 5) p), '[]'::jsonb),
    'reel', (select jsonb_build_object('url', l.url, 'title', l.title, 'role', l.role)
             from talent_links l where l.talent_id = t.id order by l.position, l.created_at limit 1),
    'stats', case when 'Model' = any (t.roles) then _model_stats(t) end,
    'rebooked_by', (select count(*) from (select brand_id from bookings where talent_id = t.id and status = 'completed'
                    group by brand_id having count(*) >= 2) x)) $$;

-- ---------------------------------------------------------------- briefs: several roles
alter table public.briefs add column if not exists only_in_range boolean not null default false;
alter table public.briefs add column if not exists updated_at timestamptz;

create table if not exists public.brief_roles (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references public.briefs (id) on delete cascade,
  position int not null default 0,
  category text not null,
  spots int not null default 1 check (spots between 1 and 20),
  days int not null default 1 check (days between 1 and 14),
  rate_min int not null check (rate_min between 0 and 100000),
  rate_max int not null check (rate_max between 0 and 100000),
  usage_fee int not null default 0 check (usage_fee between 0 and 1000000),
  travel text not null default 'local' check (travel in ('local','covered')),
  gender text not null default 'any' check (gender in ('any','woman','man','non_binary')),
  specs jsonb not null default '{}',
  created_at timestamptz not null default now(),
  check (rate_min <= rate_max)
);
create index if not exists brief_roles_brief on public.brief_roles (brief_id, position);
alter table public.brief_roles enable row level security;
revoke all on public.brief_roles from anon, authenticated;

create table if not exists public.brief_options (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references public.briefs (id) on delete cascade,
  role_id uuid not null references public.brief_roles (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  talent_id uuid not null references public.talents (id) on delete cascade,
  rank int not null check (rank between 0 and 60),
  status text not null default 'held' check (status in ('held','offered','booked','declined','passed','released')),
  booking_id uuid references public.bookings (id) on delete set null,
  respond_by timestamptz,
  nudged_at timestamptz,
  released_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (role_id, talent_id)
);
create index if not exists brief_options_talent on public.brief_options (talent_id, status);
create index if not exists brief_options_booking on public.brief_options (booking_id);
alter table public.brief_options enable row level security;
revoke all on public.brief_options from anon, authenticated;

-- every brief posted before this keeps working as a one-role brief
insert into brief_roles (brief_id, position, category, spots, days, rate_min, rate_max, usage_fee, travel, specs)
select b.id, 0, b.category, b.spots, b.days, b.day_rate, b.day_rate, b.usage_fee, b.travel, b.specs
from briefs b where not exists (select 1 from brief_roles r where r.brief_id = b.id);

-- cleans one role from the form. p_days caps the role's days at the shoot's length.
create or replace function public._role_in(x jsonb, p_days int) returns brief_roles
language plpgsql stable security definer set search_path = public as $$
declare r brief_roles; s jsonb := _specs_in(x->'specs');
begin
  r.category := x->>'category';
  if r.category is null or not exists (select 1 from unnest(array['Model','UGC creator','Actor','Content creator','Photographer','Videographer','Make-up artist','Hair stylist','Nail technician','Stylist']) c where c = r.category) then
    raise exception 'Pick who you''re looking for in each role';
  end if;
  r.spots := greatest(1, least(20, coalesce((x->>'spots')::int, 1)));
  r.days := greatest(1, least(p_days, coalesce((x->>'days')::int, p_days)));
  r.rate_min := coalesce((x->>'rate_min')::int, (x->>'day_rate')::int);
  r.rate_max := coalesce((x->>'rate_max')::int, (x->>'day_rate')::int, r.rate_min);
  if r.rate_min is null or r.rate_min < 5 then raise exception 'Set a day rate from £5 for each role'; end if;
  if r.rate_max < r.rate_min then raise exception 'The top of a day-rate range is below the bottom (% role)', r.category; end if;
  r.usage_fee := coalesce((x->>'usage_fee')::int, 0);
  if r.usage_fee < 0 then raise exception 'The usage fee can''t be below £0'; end if;
  r.travel := case when x->>'travel' = 'covered' then 'covered' else 'local' end;
  r.gender := case when x->>'gender' in ('woman','man','non_binary') then x->>'gender' else 'any' end;
  if (s->>'height_min')::int > (s->>'height_max')::int then raise exception 'The lowest height is above the highest'; end if;
  r.specs := case when r.category = 'Model' then s else '{}' end;
  return r;
end $$;

-- the roles list from a brief payload; older clients send one role in the top-level fields
create or replace function public._roles_in(p jsonb, p_days int) returns brief_roles[]
language plpgsql stable security definer set search_path = public as $$
declare out brief_roles[] := '{}'; x jsonb; i int := 0; r brief_roles;
begin
  if jsonb_typeof(p->'roles') = 'array' and jsonb_array_length(p->'roles') > 0 then
    if jsonb_array_length(p->'roles') > 12 then raise exception 'A brief can have up to 12 roles'; end if;
    for x in select * from jsonb_array_elements(p->'roles') loop
      r := _role_in(x, p_days); r.position := i; r.id := nullif(x->>'id', '')::uuid; i := i + 1;
      out := out || r;
    end loop;
  else
    r := _role_in(p, p_days); r.position := 0; out := array[r];
  end if;
  return out;
end $$;

create or replace function public._brief_check(p jsonb) returns int
language plpgsql stable security definer set search_path = public as $$
begin
  if nullif(trim(p->>'title'), '') is null then raise exception 'Give the brief a title'; end if;
  if (p->>'shoot_date')::date < current_date then raise exception 'The shoot date has passed'; end if;
  return greatest(1, least(14, coalesce((p->>'days')::int, 1)));
end $$;

create or replace function public.create_brief(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('brand'); v_id uuid; v jsonb := _usage_clean(p->'usage_terms'); n int := _brief_check(p);
  rs brief_roles[] := _roles_in(p, n); f brief_roles := rs[1]; r brief_roles;
begin
  insert into briefs (brand_id, title, category, city, shoot_date, days, day_rate, spots, travel, description, usage, specs,
    usage_terms, usage_fee, only_in_range)
  values (u, trim(p->>'title'), f.category, p->>'city', (p->>'shoot_date')::date, n, f.rate_max, f.spots, f.travel,
    nullif(trim(p->>'description'), ''), coalesce(_usage_summary(v), nullif(trim(p->>'usage'), '')), f.specs, v, f.usage_fee,
    coalesce((p->>'only_in_range')::boolean, false))
  returning id into v_id;
  foreach r in array rs loop
    insert into brief_roles (brief_id, position, category, spots, days, rate_min, rate_max, usage_fee, travel, gender, specs)
    values (v_id, r.position, r.category, r.spots, r.days, r.rate_min, r.rate_max, r.usage_fee, r.travel, r.gender, r.specs);
  end loop;
  return v_id;
end $$;

-- edit a posted brief. Roles sent with their id are updated, new ones added, missing ones removed
-- (their options are released and the talent told). Offers already sent keep their own terms.
create or replace function public.update_brief(p_id uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('brand'); b briefs; v jsonb := _usage_clean(p->'usage_terms'); n int := _brief_check(p);
  rs brief_roles[] := _roles_in(p, n); f brief_roles := rs[1]; r brief_roles; keep uuid[] := '{}'; o record;
begin
  select * into b from briefs where id = p_id for update;
  if b.id is null or b.brand_id <> u then raise exception 'Brief not found'; end if;
  if b.status <> 'open' then raise exception 'This brief is closed. Post a new one instead.'; end if;
  update briefs set title = trim(p->>'title'), category = f.category, city = coalesce(p->>'city', city), shoot_date = (p->>'shoot_date')::date,
    days = n, day_rate = f.rate_max, spots = f.spots, travel = f.travel, description = nullif(trim(p->>'description'), ''),
    usage = coalesce(_usage_summary(v), nullif(trim(p->>'usage'), '')), specs = f.specs, usage_terms = v, usage_fee = f.usage_fee,
    only_in_range = coalesce((p->>'only_in_range')::boolean, false), updated_at = now()
  where id = p_id;
  foreach r in array rs loop
    if r.id is not null and exists (select 1 from brief_roles where id = r.id and brief_id = p_id) then
      update brief_roles set position = r.position, category = r.category, spots = r.spots, days = r.days, rate_min = r.rate_min,
        rate_max = r.rate_max, usage_fee = r.usage_fee, travel = r.travel, gender = r.gender, specs = r.specs where id = r.id;
      keep := keep || r.id;
    else
      insert into brief_roles (brief_id, position, category, spots, days, rate_min, rate_max, usage_fee, travel, gender, specs)
      values (p_id, r.position, r.category, r.spots, r.days, r.rate_min, r.rate_max, r.usage_fee, r.travel, r.gender, r.specs)
      returning id into r.id;
      keep := keep || r.id;
    end if;
  end loop;
  for o in select x.* from brief_options x join brief_roles rr on rr.id = x.role_id
           where rr.brief_id = p_id and not rr.id = any (keep) and x.status = 'held' loop
    perform _release_option(o.id, 'role removed');
  end loop;
  delete from brief_roles where brief_id = p_id and not id = any (keep);
  return p_id;
end $$;

-- ---------------------------------------------------------------- ranking one role
create or replace function public._rank_role(b briefs, r brief_roles) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(card order by rk), '[]') from (
    select _talent_card(t) || jsonb_build_object('away', t.city <> b.city,
             'in_range', coalesce(t.day_rate between r.rate_min and r.rate_max, false),
             'gender_unstated', r.gender <> 'any' and t.gender is null,
             'offered', exists (select 1 from bookings k where k.brief_id = b.id and k.talent_id = t.id and k.status not in ('declined','withdrawn','cancelled')),
             'optioned', exists (select 1 from brief_options o where o.role_id = r.id and o.talent_id = t.id and o.status in ('held','offered'))) card,
           row_number() over (order by coalesce(t.day_rate between r.rate_min and r.rate_max, false) desc, (t.city <> b.city),
             (r.gender <> 'any' and t.gender is null),
             greatest(r.rate_min - coalesce(t.day_rate, 0), coalesce(t.day_rate, 0) - r.rate_max, 0), t.age_verified desc,
             (select count(*) from talent_photos p where p.talent_id = t.id and p.role = r.category)
               + (select count(*) from talent_links l where l.talent_id = t.id and l.role = r.category) desc, t.created_at) rk
    from talents t
    where t.published and r.category = any (t.roles) and _is_free(t.id, b.shoot_date, r.days)
      and (t.city = b.city or (r.travel = 'covered' and _travels_to(t, b.city)))
      and (r.category <> 'Model' or _fits(t, r.specs))
      and (r.gender = 'any' or t.gender is null or t.gender = r.gender)
      and (not b.only_in_range or t.day_rate between r.rate_min and r.rate_max)
    order by rk limit 12) x $$;

-- ---------------------------------------------------------------- options (1st, 2nd, 3rd)

-- releases one option and tells the talent, without saying why or naming anyone else
create or replace function public._release_option(p_option uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare o brief_options; b briefs; r brief_roles;
begin
  update brief_options set status = 'released', released_reason = p_reason, updated_at = now()
  where id = p_option and status = 'held' returning * into o;
  if o.id is null then return; end if;
  select * into b from briefs where id = o.brief_id;
  select * into r from brief_roles where id = o.role_id;
  if p_reason <> 'talent unavailable' then
    perform _notify(o.talent_id, null, (select name from brands where id = o.brand_id) || ' has released your option for ' ||
      lower(r.category) || ' work on ' || _date_range(b.shoot_date, r.days) || '. Your dates are free again.', '/bookings', false);
  end if;
end $$;

-- brand: hold someone for a role. They go to the end of the list.
create or replace function public.option_add(p_role uuid, p_talent uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('brand'); r brief_roles; b briefs; t talents; n int; o brief_options;
begin
  select * into r from brief_roles where id = p_role;
  select * into b from briefs where id = r.brief_id;
  if b.id is null or b.brand_id <> u then raise exception 'Brief not found'; end if;
  if b.status <> 'open' then raise exception 'This brief is closed'; end if;
  if b.shoot_date < current_date then raise exception 'The shoot date has passed'; end if;
  select * into t from talents where id = p_talent;
  if t.id is null or not t.published then raise exception 'That profile isn''t available'; end if;
  if not r.category = any (t.roles) then raise exception '% doesn''t do % work', _first(t.name), lower(r.category); end if;
  select count(*) into n from brief_options where role_id = p_role and status in ('held','offered');
  if n >= 3 * r.spots then
    raise exception 'You can hold up to % for this role. Remove someone first.', case when r.spots = 1 then '3 options' else (3 * r.spots) || ' options (3 for each place)' end;
  end if;
  select * into o from brief_options where role_id = p_role and talent_id = p_talent;
  if o.id is not null and o.status in ('held','offered','booked') then raise exception '% is already on your list', _first(t.name); end if;
  if o.id is not null then delete from brief_options where id = o.id; end if;
  insert into brief_options (brief_id, role_id, brand_id, talent_id, rank)
  values (b.id, p_role, u, p_talent, coalesce((select max(rank) from brief_options where role_id = p_role), 0) + 1);
  -- the talent sees a hold, never their number or who else is held
  perform _notify(p_talent, null, (select name from brands where id = u) || ' has optioned you for ' || lower(r.category) ||
    ' work on ' || _date_range(b.shoot_date, r.days) || '. Nothing to do yet: they''ll send an offer or release you.', '/bookings', true);
  return brief_detail(b.id);
end $$;

-- brand: take someone off the list (they're told they're released)
create or replace function public.option_remove(p_option uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('brand'); o brief_options;
begin
  select * into o from brief_options where id = p_option;
  if o.id is null or o.brand_id <> u then raise exception 'Option not found'; end if;
  if o.status <> 'held' then raise exception 'Only someone who hasn''t had an offer yet can be removed. Withdraw the offer instead.'; end if;
  perform _release_option(o.id, 'brand removed');
  return brief_detail(o.brief_id);
end $$;

-- brand: move someone one place up the list
create or replace function public.option_up(p_option uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('brand'); o brief_options; prev brief_options;
begin
  select * into o from brief_options where id = p_option for update;
  if o.id is null or o.brand_id <> u then raise exception 'Option not found'; end if;
  select * into prev from brief_options where role_id = o.role_id and rank < o.rank and status in ('held','offered','booked')
    order by rank desc limit 1 for update;
  if prev.id is not null then
    update brief_options set rank = 0 where id = o.id;
    update brief_options set rank = o.rank, updated_at = now() where id = prev.id;
    update brief_options set rank = prev.rank, updated_at = now() where id = o.id;
  end if;
  return brief_detail(o.brief_id);
end $$;

-- brand: send the offer to an option. The terms come from the offer form (create_offer checks them);
-- p_hours is how long they have to answer before Embr asks the brand about the next option.
create or replace function public.option_offer(p_option uuid, p jsonb, p_hours int default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('brand'); o brief_options; v_id uuid; h int;
begin
  select * into o from brief_options where id = p_option for update;
  if o.id is null or o.brand_id <> u then raise exception 'Option not found'; end if;
  if o.status <> 'held' then raise exception 'This option already has an offer, or has been released'; end if;
  h := coalesce(p_hours, (select option_hours from settings where id = 1));
  if h not between 1 and 168 then raise exception 'Pick how long they have to answer'; end if;
  v_id := create_offer(p || jsonb_build_object('talent_id', o.talent_id, 'brief_id', o.brief_id));
  update brief_options set status = 'offered', booking_id = v_id, respond_by = now() + make_interval(hours => h), updated_at = now()
  where id = o.id;
  return v_id;
end $$;

-- brand: move on from an option whose offer hasn't been accepted (no answer in time, or no deal).
-- An open offer is withdrawn; the talent is told the offer was withdrawn, as with any withdrawal.
create or replace function public.option_pass(p_option uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('brand'); o brief_options; k bookings;
begin
  select * into o from brief_options where id = p_option for update;
  if o.id is null or o.brand_id <> u then raise exception 'Option not found'; end if;
  if o.status not in ('offered','declined') then raise exception 'There''s nothing to move on from here'; end if;
  select * into k from bookings where id = o.booking_id;
  if k.status in ('accepted','confirmed','wrapped','completed','disputed') then
    raise exception '% has already accepted. Withdraw or cancel the booking itself if you need to.', (select _first(name) from talents where id = o.talent_id);
  end if;
  update brief_options set status = 'passed', updated_at = now() where id = o.id;
  if k.status = 'offer' then perform withdraw_offer(k.id); end if;
  return brief_detail(o.brief_id);
end $$;

-- talent: "I can't do those dates" on a hold. The brand is told; the talent's number is never shown.
create or replace function public.option_unavailable(p_option uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('talent'); o brief_options; b briefs;
begin
  select * into o from brief_options where id = p_option;
  if o.id is null or o.talent_id <> u then raise exception 'Option not found'; end if;
  if o.status <> 'held' then raise exception 'This option has already moved on'; end if;
  select * into b from briefs where id = o.brief_id;
  perform _release_option(o.id, 'talent unavailable');
  perform _notify(o.brand_id, null, (select _first(name) from talents where id = u) || ' can''t do “' || b.title || '” and has come off your options.', '/jobs', true);
  return my_options();
end $$;

-- talent: the holds on them. No number, no other names, no brief text or rate (talent can't read briefs).
create or replace function public.my_options() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'brand', br.name, 'role', r.category,
      'shoot_date', b.shoot_date, 'days', r.days, 'city', b.city, 'since', o.created_at) order by b.shoot_date), '[]')
  from brief_options o join briefs b on b.id = o.brief_id join brief_roles r on r.id = o.role_id join brands br on br.id = o.brand_id
  where o.talent_id = _need('talent') and o.status = 'held' and b.status = 'open' and b.shoot_date >= current_date $$;

-- booking changes move the option along: declined (Embr asks the brand about the next option),
-- confirmed (booked; once every place in the role is filled, everyone still held is released)
create or replace function public._option_follow() returns trigger
language plpgsql security definer set search_path = public as $$
declare o brief_options; r brief_roles; b briefs; nxt record; filled int; x record;
begin
  if new.status = old.status then return new; end if;
  select * into o from brief_options where booking_id = new.id;
  if o.id is null then return new; end if;
  select * into r from brief_roles where id = o.role_id;
  select * into b from briefs where id = o.brief_id;
  if new.status = 'declined' and o.status = 'offered' then
    update brief_options set status = 'declined', updated_at = now() where id = o.id;
    select t.name into nxt from brief_options bo join talents t on t.id = bo.talent_id
      where bo.role_id = o.role_id and bo.status = 'held' order by bo.rank limit 1;
    -- respond_offer already says they can't do it; this adds what's next on the options list
    perform _notify(o.brand_id, new.id, case when nxt.name is not null
      then 'Your next option for ' || lower(r.category) || ' on “' || b.title || '” is ' || nxt.name || '. Send them the offer?'
      else 'You have no more options for ' || lower(r.category) || ' on “' || b.title || '”. Find someone else on the board.' end,
      '/jobs', true);
  elsif new.status = 'confirmed' and o.status = 'offered' then
    update brief_options set status = 'booked', updated_at = now() where id = o.id;
    select count(*) into filled from brief_options where role_id = o.role_id and status = 'booked';
    if filled >= r.spots then
      for x in select id from brief_options where role_id = o.role_id and status = 'held' loop
        perform _release_option(x.id, 'booked someone else');
      end loop;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists option_follow on public.bookings;
create trigger option_follow after update of status on public.bookings for each row execute function public._option_follow();

-- every 15 minutes (pg_cron on the live project): tell the brand once when an option's time to answer
-- has run out. The brand decides; Embr never moves on by itself.
create or replace function public.svc_option_nudge() returns int
language plpgsql security definer set search_path = public as $$
declare x record; n int := 0;
begin
  for x in select o.id, o.brand_id, o.booking_id, o.role_id, t.name, b.title,
             (select t2.name from brief_options o2 join talents t2 on t2.id = o2.talent_id where o2.role_id = o.role_id and o2.status = 'held' order by o2.rank limit 1) nxt
           from brief_options o join bookings k on k.id = o.booking_id join talents t on t.id = o.talent_id join briefs b on b.id = o.brief_id
           where o.status = 'offered' and k.status = 'offer' and o.respond_by < now() and o.nudged_at is null loop
    update brief_options set nudged_at = now() where id = x.id;
    perform _notify(x.brand_id, x.booking_id, _first(x.name) || ' hasn''t answered your offer for “' || x.title || '” in time.' ||
      case when x.nxt is not null then ' Move to your next option, ' || x.nxt || '?' else ' Keep waiting, or find someone else on the board.' end, '/jobs', true);
    n := n + 1;
  end loop;
  return n;
end $$;
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('embr-option-nudge', '*/15 * * * *', 'select public.svc_option_nudge()');
  end if;
end $$;

create or replace function public._options_json(p_role uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'rank', o.rank, 'status', o.status, 'talent', _talent_card(t),
      'booking_id', o.booking_id, 'booking_status', k.status, 'respond_by', o.respond_by,
      'lapsed', o.status = 'offered' and k.status = 'offer' and o.respond_by < now(),
      'changes_open', exists (select 1 from offer_changes c where c.booking_id = k.id and c.status = 'open'))
    order by o.rank), '[]')
  from brief_options o join talents t on t.id = o.talent_id left join bookings k on k.id = o.booking_id
  where o.role_id = p_role and o.status in ('held','offered','booked','declined') $$;

create or replace function public.brief_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare u uuid := _need('brand'); b briefs;
begin
  select * into b from briefs where id = p_id;
  if b.id is null or (b.brand_id <> u and _role() <> 'ops') then raise exception 'Brief not found'; end if;
  return to_jsonb(b) || jsonb_build_object(
    'roles', coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object('ranked', _rank_role(b, r), 'options', _options_json(r.id),
        'booked', (select count(*) from bookings k where k.brief_id = b.id and k.status in ('confirmed','wrapped','completed','disputed')
                    and (k.roles @> array[r.category] or k.role = r.category)))
      order by r.position) from brief_roles r where r.brief_id = b.id), '[]'),
    'ranked', coalesce((select _rank_role(b, r) from brief_roles r where r.brief_id = b.id order by r.position limit 1), '[]'),
    'bookings', coalesce((select jsonb_agg(_booking_row(k, 'brand') order by k.created_at desc) from bookings k where k.brief_id = b.id), '[]'));
end $$;

create or replace function public.my_briefs() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(b) || jsonb_build_object(
      'offers', (select count(*) from bookings k where k.brief_id = b.id),
      'booked', (select count(*) from bookings k where k.brief_id = b.id and k.status in ('confirmed','wrapped','completed','disputed')),
      'roles', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'category', r.category, 'spots', r.spots, 'days', r.days,
          'rate_min', r.rate_min, 'rate_max', r.rate_max, 'usage_fee', r.usage_fee) order by r.position) from brief_roles r where r.brief_id = b.id), '[]'),
      'needs_you', (select count(*) from brief_options o left join bookings k on k.id = o.booking_id where o.brief_id = b.id
          and (o.status = 'declined' or (o.status = 'offered' and k.status = 'offer' and o.respond_by < now()))))
    order by b.created_at desc), '[]')
  from briefs b where b.brand_id = _need('brand') $$;

-- closing a brief releases everyone still held on it
create or replace function public.close_brief(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('brand'); x record;
begin
  update briefs set status = 'closed' where id = p_id and brand_id = u;
  for x in select id from brief_options where brief_id = p_id and brand_id = u and status = 'held' loop
    perform _release_option(x.id, 'brief closed');
  end loop;
end $$;

-- ---------------------------------------------------------------- booking-link rate
-- The 5% link rate is for a brand the talent brought to Embr. If the brand had already found that talent
-- on Embr (opened their profile, saved them, held or booked them), the usual rate applies, so a brand gains
-- nothing by asking someone it found on the board to send a link. Same idea as Fresha's marketplace
-- new-client fee, which until 31 Dec 2026 can apply when the client first found the business on the marketplace.
create or replace function public._found_on_embr(p_brand uuid, p_talent uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profile_views where brand_id = p_brand and talent_id = p_talent)
      or exists (select 1 from shortlist where brand_id = p_brand and talent_id = p_talent)
      or exists (select 1 from brief_options where brand_id = p_brand and talent_id = p_talent)
      or exists (select 1 from bookings where brand_id = p_brand and talent_id = p_talent) $$;

create or replace function public.fee_for(p_brand uuid, p_talent uuid, p_link boolean default false)
returns table (rate numeric, label text, done int)
language plpgsql stable security definer set search_path = public as $$
declare s settings; n int;
begin
  select * into s from settings where id = 1;
  select count(*) into n from bookings where brand_id = p_brand and talent_id = p_talent and status = 'completed';
  if p_link and not _found_on_embr(p_brand, p_talent) then return query select s.fee_link, 'Booking link rate'::text, n; return; end if;
  if n >= s.loyal_after then return query select s.fee_loyal, ('Booking ' || (n + 1) || ' with this person')::text, n;
  elsif n >= 1 then return query select s.fee_repeat, ('Booking ' || (n + 1) || ' with this person')::text, n;
  else return query select s.fee_first, 'First booking with this person'::text, n; end if;
end $$;

-- the link page shows the rate the signed-in brand would actually pay
create or replace function public.public_link(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare l booking_links; t talents; s settings; m record; f record; rate numeric; lbl text := 'Booking link rate';
begin
  select * into l from booking_links where code = upper(trim(p_code));
  if l.id is null or l.status = 'withdrawn' then return null; end if;
  select * into t from talents where id = l.talent_id;
  select * into s from settings where id = 1;
  rate := s.fee_link;
  if auth.uid() is not null and _role() = 'brand' then
    select * into f from fee_for(auth.uid(), l.talent_id, true);
    rate := f.rate; lbl := f.label;
  end if;
  select * into m from _money(l.day_rate, l.days, l.usage_fee, rate);
  return jsonb_build_object('code', l.code, 'title', l.title, 'shoot_date', l.shoot_date, 'days', l.days, 'role', l.role,
    'day_rate', l.day_rate, 'usage', l.usage, 'usage_fee', l.usage_fee, 'note', l.note,
    'usage_terms', l.usage_terms, 'day_hours', l.day_hours, 'signed', l.talent_signed_name is not null,
    'open', l.status = 'open' and l.expires_at > now() and l.shoot_date >= current_date,
    'status', l.status, 'fee_rate', rate, 'fee_label', lbl, 'talent_fee_p', m.talent_fee_p, 'embr_fee_p', m.embr_fee_p,
    'total_p', m.total_p, 'deposit_p', m.deposit_p, 'balance_p', m.balance_p,
    'talent', _talent_card(t) || jsonb_build_object('bio', t.bio));
end $$;

-- ---------------------------------------------------------------- me(): new settings
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
        'free_cancel_hours', s.free_cancel_hours, 'option_hours', s.option_hours,
        'late_cancel_share', s.late_cancel_share));
end $$;

-- ---------------------------------------------------------------- agreement v3: 48-hour cancellation (DRAFT)
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
a) Client cancels at least %s hours before the shoot day begins (by 11:59pm UK time on %s): the deposit is refunded in full.
b) Client cancels later than that: the Talent is paid %s of the day rate (%s) from the deposit and the rest is refunded.
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
    s.free_cancel_hours, to_char(_free_cancel_last_day(b.shoot_date), 'FMDay FMDD FMMonth YYYY'), (round(s.late_cancel_share * 100))::text || '%',
    _gbp(round(b.session_p * s.late_cancel_share)::int),
    case when b.link_id is not null
      then 'The Talent set these terms and signed them by typing their full name when they created the booking link. The Client agreed by booking through the link.'
      else 'The Client agreed by sending the offer. The Talent signs by typing their full name and tapping Sign and accept in Embr.' end);
end $$;

-- ---------------------------------------------------------------- grants
revoke execute on function public._free_cancel_last_day(date), public._role_in(jsonb, int), public._roles_in(jsonb, int),
  public._brief_check(jsonb), public._rank_role(briefs, brief_roles), public._release_option(uuid, text),
  public._option_follow(), public.svc_option_nudge(), public._options_json(uuid), public._found_on_embr(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.save_gender(text), public.update_brief(uuid, jsonb), public.option_add(uuid, uuid),
  public.option_remove(uuid), public.option_up(uuid), public.option_offer(uuid, jsonb, int), public.option_pass(uuid),
  public.option_unavailable(uuid), public.my_options() from public, anon;
grant execute on function public.save_gender(text), public.update_brief(uuid, jsonb), public.option_add(uuid, uuid),
  public.option_remove(uuid), public.option_up(uuid), public.option_offer(uuid, jsonb, int), public.option_pass(uuid),
  public.option_unavailable(uuid), public.my_options() to authenticated;
grant execute on all functions in schema public to service_role;
