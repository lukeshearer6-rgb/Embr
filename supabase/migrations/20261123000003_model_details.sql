-- Also: staff emails link to the separate admin website (/admin).
--
-- Model details: the stats agencies put on the back of a comp card, required
-- before a Model profile goes live, and filters on briefs and search.
--
-- Field list follows the comp-card guides checked on 2026-11-23:
--   Sirency: "Height, bust or chest, waist, hips, dress or suit size, shoe
--     size, hair color, eye color" (sirency.com/blog/model-comp-card-guide)
--   StarNow: "body measurements, shoe size, eye colour, and hair colour",
--     plus inseam (starnow.com/magazine/article/how-to-take-your-own-measurements-80322)
--   Universal Extras (UK): UK dress and shoe sizes, inside leg and collar for
--     menswear, bra size for womenswear; the set used depends on the clothes
--     someone is booked to wear, "this does not relate to gender itself".
-- Height in cm, body measurements in inches, sizes in UK sizes.

alter table public.talents
  add column if not exists sizing text check (sizing in ('womenswear','menswear')),
  add column if not exists height_cm int check (height_cm between 120 and 220),
  add column if not exists bust_in numeric(4,1) check (bust_in between 20 and 60),
  add column if not exists chest_in numeric(4,1) check (chest_in between 20 and 60),
  add column if not exists waist_in numeric(4,1) check (waist_in between 18 and 60),
  add column if not exists hips_in numeric(4,1) check (hips_in between 20 and 64),
  add column if not exists inside_leg_in numeric(4,1) check (inside_leg_in between 20 and 40),
  add column if not exists dress_uk int check (dress_uk between 2 and 32 and dress_uk % 2 = 0),
  add column if not exists suit text check (suit ~ '^(3[0-9]|4[0-9]|5[0-6])(S|R|L)$'),
  add column if not exists collar_in numeric(3,1) check (collar_in between 12 and 22),
  add column if not exists bra text check (bra ~ '^[2-4][0-9](AA|[A-K]{1,2})$'),
  add column if not exists shoe_uk numeric(3,1) check (shoe_uk between 1 and 16 and shoe_uk * 2 = floor(shoe_uk * 2)),
  add column if not exists hair text,
  add column if not exists eyes text;

alter table public.briefs add column if not exists specs jsonb not null default '{}';

-- choices shown in the app (and the only values accepted)
create or replace function public.model_options() returns jsonb
language sql immutable as $$
  select '{
    "hair": ["Black", "Dark brown", "Brown", "Light brown", "Blonde", "Red", "Auburn", "Grey", "White", "Shaved or bald", "Dyed or other"],
    "eyes": ["Brown", "Hazel", "Blue", "Green", "Grey", "Other"],
    "required": {
      "womenswear": ["height_cm", "bust_in", "waist_in", "hips_in", "dress_uk", "shoe_uk", "hair", "eyes"],
      "menswear":   ["height_cm", "chest_in", "waist_in", "inside_leg_in", "suit", "shoe_uk", "hair", "eyes"]
    },
    "labels": {"sizing": "which sizes you model", "height_cm": "height", "bust_in": "bust", "chest_in": "chest", "waist_in": "waist",
               "hips_in": "hips", "inside_leg_in": "inside leg", "dress_uk": "dress size", "suit": "suit size", "collar_in": "collar",
               "bra": "bra size", "shoe_uk": "shoe size", "hair": "hair colour", "eyes": "eye colour"}
  }'::jsonb $$;

-- 5'10" from 178
create or replace function public._ft(cm int) returns text language sql immutable as $$
  select case when cm is null then null else floor(round(cm / 2.54) / 12)::int || '''' || (round(cm / 2.54)::int % 12) || '"' end $$;

create or replace function public._model_stats(t talents) returns jsonb
language sql stable as $$
  select jsonb_strip_nulls(jsonb_build_object('sizing', t.sizing, 'height_cm', t.height_cm, 'height_ft', _ft(t.height_cm),
    'bust_in', t.bust_in, 'chest_in', t.chest_in, 'waist_in', t.waist_in, 'hips_in', t.hips_in, 'inside_leg_in', t.inside_leg_in,
    'dress_uk', t.dress_uk, 'suit', t.suit, 'collar_in', t.collar_in, 'bra', t.bra, 'shoe_uk', t.shoe_uk, 'hair', t.hair, 'eyes', t.eyes)) $$;

-- which required model details are missing (empty when complete)
create or replace function public._model_missing(t talents) returns text[]
language sql stable as $$
  select case when t.sizing is null then array['which sizes you model']
    else coalesce((select array_agg(model_options()->'labels'->>k order by ord)
                   from jsonb_array_elements_text(model_options()->'required'->t.sizing) with ordinality r(k, ord)
                   where coalesce(_model_stats(t)->>k, '') = ''), '{}') end $$;

-- Model now needs the full set of details instead of height alone
create or replace function public.role_rules() returns jsonb
language sql immutable as $$
  select '{
    "Model":           {"photos": 3, "links": 0, "stats": true, "photo_label": "Modelling photos", "link_label": "Video (optional)", "hint": "At least 3 photos (a mix of close-up, full length and your best work) and your full model details."},
    "UGC creator":     {"photos": 0, "links": 2, "photo_label": "Stills (optional)", "link_label": "Example UGC videos", "hint": "Links to at least 2 UGC videos you have made (TikTok, Instagram, YouTube or Drive)."},
    "Actor":           {"photos": 1, "links": 1, "photo_label": "Headshots", "link_label": "Showreel", "hint": "At least 1 headshot and a link to your showreel."},
    "Content creator": {"photos": 1, "links": 1, "social": true, "photo_label": "Photos", "link_label": "Your channel or best posts", "hint": "Your Instagram or TikTok handle, a photo and a link to your channel or best post."},
    "Photographer":    {"photos": 3, "links": 0, "photo_label": "Portfolio", "link_label": "Website (optional)", "hint": "At least 3 photos you have shot."},
    "Videographer":    {"photos": 0, "links": 1, "photo_label": "Stills (optional)", "link_label": "Showreel", "hint": "A link to your showreel."},
    "Make-up artist":  {"photos": 3, "links": 0, "photo_label": "Portfolio", "link_label": "Video (optional)", "hint": "At least 3 photos of your work."},
    "Stylist":         {"photos": 3, "links": 0, "photo_label": "Portfolio", "link_label": "Video (optional)", "hint": "At least 3 photos of your work."}
  }'::jsonb $$;

create or replace function public._role_gaps(t talents) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r text; rule jsonb; np int; nl int; miss text[]; mm text[]; out jsonb := '[]';
begin
  foreach r in array t.roles loop
    rule := role_rules() -> r;
    continue when rule is null;
    select count(*) into np from talent_photos where talent_id = t.id and role = r;
    select count(*) into nl from talent_links where talent_id = t.id and role = r;
    miss := '{}';
    if np < (rule->>'photos')::int then miss := miss || ((rule->>'photos')::int - np || ' more ' || lower(rule->>'photo_label')); end if;
    if nl < (rule->>'links')::int then miss := miss || ((rule->>'links')::int - nl || ' more ' || case when (rule->>'links')::int = 1 then lower(rule->>'link_label') || ' link' else lower(rule->>'link_label') end); end if;
    if coalesce((rule->>'stats')::boolean, false) then
      mm := _model_missing(t);
      if array_length(mm, 1) > 0 then miss := miss || ('your ' || array_to_string(mm, ', ')); end if;
    end if;
    if coalesce((rule->>'social')::boolean, false) and coalesce(t.instagram, '') = '' then miss := miss || 'your Instagram or TikTok handle'::text; end if;
    if array_length(miss, 1) > 0 then out := out || jsonb_build_object('role', r, 'missing', to_jsonb(miss)); end if;
  end loop;
  return out;
end $$;

-- cards carry the details brands scan for; the full profile carries them all
create or replace function public._talent_card(t talents) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', t.id, 'handle', t.handle, 'name', t.name, 'category', t.roles[1],
    'roles', to_jsonb(t.roles), 'city', t.city, 'height', t.height, 'day_rate', t.day_rate, 'half_rate', t.half_rate,
    'travels', t.travels, 'verified', t.age_verified, 'photo', _photo(t.id),
    'stats', case when 'Model' = any (t.roles) then _model_stats(t) end,
    'rebooked_by', (select count(*) from (select brand_id from bookings where talent_id = t.id and status = 'completed'
                    group by brand_id having count(*) >= 2) x)) $$;

create or replace function public.save_model_stats(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('talent'); o jsonb := model_options();
  v_hair text := nullif(trim(p->>'hair'), ''); v_eyes text := nullif(trim(p->>'eyes'), '');
  v_suit text := upper(nullif(replace(trim(p->>'suit'), ' ', ''), '')); v_bra text := upper(nullif(replace(trim(p->>'bra'), ' ', ''), ''));
  n numeric;
begin
  if nullif(p->>'sizing', '') is not null and p->>'sizing' not in ('womenswear','menswear') then raise exception 'Choose womenswear or menswear sizes'; end if;
  if v_hair is not null and not (o->'hair' ? v_hair) then raise exception 'Choose a hair colour from the list'; end if;
  if v_eyes is not null and not (o->'eyes' ? v_eyes) then raise exception 'Choose an eye colour from the list'; end if;
  begin
    update talents set
      sizing = nullif(p->>'sizing', ''),
      height_cm = nullif(p->>'height_cm', '')::int,
      bust_in = nullif(p->>'bust_in', '')::numeric, chest_in = nullif(p->>'chest_in', '')::numeric,
      waist_in = nullif(p->>'waist_in', '')::numeric, hips_in = nullif(p->>'hips_in', '')::numeric,
      inside_leg_in = nullif(p->>'inside_leg_in', '')::numeric,
      dress_uk = nullif(p->>'dress_uk', '')::int, suit = v_suit,
      collar_in = nullif(p->>'collar_in', '')::numeric, bra = v_bra,
      shoe_uk = nullif(p->>'shoe_uk', '')::numeric, hair = v_hair, eyes = v_eyes
    where id = u;
  exception
    when check_violation then
      raise exception '%', case
        when sqlerrm ~ 'height' then 'Height should be in centimetres, between 120 and 220'
        when sqlerrm ~ 'dress' then 'Dress size should be a UK size: 4, 6, 8 and so on'
        when sqlerrm ~ 'suit' then 'Suit size is your chest size and fit, for example 40R (S short, R regular, L long)'
        when sqlerrm ~ 'bra' then 'Bra size is band and cup, for example 34B'
        when sqlerrm ~ 'shoe' then 'Shoe size should be a UK size, in whole or half sizes'
        when sqlerrm ~ 'collar' then 'Collar should be in inches, for example 15.5'
        else 'Measurements should be in inches. Check the numbers look right' end;
    when invalid_text_representation then raise exception 'Use numbers for measurements';
  end;
  -- keep the short height text in step for cards and older screens
  update talents set height = _ft(height_cm) where id = u and height_cm is not null;
  perform _republish(u);
  return me();
end $$;

-- does this person fit what a brief or search asks for? Empty specs fit everyone.
create or replace function public._fits(t talents, s jsonb) returns boolean
language sql stable as $$
  select coalesce(s, '{}') = '{}' or (
        (nullif(s->>'sizing', '') is null or t.sizing = s->>'sizing')
    and (nullif(s->>'height_min', '') is null or t.height_cm >= (s->>'height_min')::int)
    and (nullif(s->>'height_max', '') is null or t.height_cm <= (s->>'height_max')::int)
    and (jsonb_array_length(coalesce(s->'dress', '[]')) = 0 or (s->'dress') @> to_jsonb(t.dress_uk))
    and (jsonb_array_length(coalesce(s->'suit', '[]')) = 0
         or coalesce((select bool_or(t.suit like x || '%') from jsonb_array_elements_text(s->'suit') x), false))
    and (nullif(s->>'shoe_min', '') is null or t.shoe_uk >= (s->>'shoe_min')::numeric)
    and (nullif(s->>'shoe_max', '') is null or t.shoe_uk <= (s->>'shoe_max')::numeric)
    and (jsonb_array_length(coalesce(s->'hair', '[]')) = 0 or (s->'hair') ? coalesce(t.hair, ''))
    and (jsonb_array_length(coalesce(s->'eyes', '[]')) = 0 or (s->'eyes') ? coalesce(t.eyes, '')))
$$;

-- tidy what a brand typed into a specs object (drops blanks)
create or replace function public._specs_in(p jsonb) returns jsonb
language sql immutable as $$
  select coalesce(jsonb_object_agg(k, v), '{}') from jsonb_each(coalesce(p, '{}')) e(k, v)
  where k in ('sizing','height_min','height_max','dress','suit','shoe_min','shoe_max','hair','eyes')
    and v not in ('""'::jsonb, '[]'::jsonb, 'null'::jsonb) $$;

create or replace function public.create_brief(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('brand'); id uuid; s jsonb := _specs_in(p->'specs');
begin
  if nullif(trim(p->>'title'), '') is null then raise exception 'Give the brief a title'; end if;
  if (p->>'shoot_date')::date < current_date then raise exception 'The shoot date has passed'; end if;
  if (s->>'height_min')::int > (s->>'height_max')::int then raise exception 'The lowest height is above the highest'; end if;
  insert into briefs (brand_id, title, category, city, shoot_date, days, day_rate, spots, travel, description, usage, specs)
  values (u, trim(p->>'title'), p->>'category', p->>'city', (p->>'shoot_date')::date, coalesce((p->>'days')::int, 1),
          (p->>'day_rate')::int, coalesce((p->>'spots')::int, 1), coalesce(p->>'travel', 'local'),
          nullif(trim(p->>'description'), ''), nullif(trim(p->>'usage'), ''),
          case when p->>'category' = 'Model' then s else '{}' end)
  returning briefs.id into id;
  return id;
end $$;

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
      and (t.city = b.city or (b.travel = 'covered' and t.travels))
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
        and (v_city is null or t.city = v_city or t.travels)
        and _fits(t, v_specs)
        and (v_q = '' or lower(t.name || ' ' || array_to_string(t.roles, ' ') || ' ' || t.city || ' ' || coalesce(t.bio, '') || ' ' || array_to_string(t.tags, ' ') || ' ' || coalesce(t.hair, '')) like '%' || v_q || '%')
      limit 200) x), '[]');
end $$;

-- staff emails link to the admin website, everyone else's to the app
create or replace function public.svc_email_for(p_notification bigint) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', n.id, 'email', p.email, 'text', n.text, 'url', n.url, 'emailed', n.emailed_at is not null,
    'staff', p.role = 'ops',
    'name', coalesce((select _first(name) from talents where id = p.id), (select contact_name from brands where id = p.id)))
  from notifications n join profiles p on p.id = n.user_id where n.id = p_notification and n.email $$;

-- grants: new functions are closed by default, open only what the app calls
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.check_invite(text), public.public_link(text), public.public_talent(text),
  public.role_rules(), public.model_options() to anon, authenticated;
grant execute on function public.create_profile(text, text, text, text, jsonb), public.me(),
  public.save_talent(jsonb), public.save_model_stats(jsonb), public.add_photo(text, text), public.remove_photo(uuid), public.cover_photo(uuid),
  public.toggle_off_day(date), public.add_link(text, text, text), public.remove_link(uuid),
  public.save_brand(jsonb), public.search_talent(jsonb), public.talent_detail(uuid), public.toggle_shortlist(uuid), public.my_shortlist(),
  public.create_brief(jsonb), public.my_briefs(), public.brief_detail(uuid), public.close_brief(uuid),
  public.quote(uuid, int, int, int), public.create_offer(jsonb), public.my_bookings(), public.booking_detail(uuid),
  public.respond_offer(uuid, boolean, boolean, text), public.withdraw_offer(uuid), public.talent_withdraw(uuid, text),
  public.mark_wrapped(uuid), public.report_problem(uuid, text), public.send_message(uuid, text),
  public.notifications(), public.read_notifications(),
  public.create_link(jsonb), public.my_links(), public.withdraw_link(uuid), public.accept_link(text, boolean, jsonb),
  public.ops_overview(), public.ops_bookings(text), public.ops_people(), public.ops_briefs(), public.ops_create_invite(text, text),
  public.ops_invites(), public.ops_message(uuid, text)
  to authenticated;
grant execute on all functions in schema public to service_role;
