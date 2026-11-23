-- Multi-role talent (Luke, 23 Nov 2026): one person can be a model, a UGC
-- creator and an actor at once. Talent pick every role that applies, and
-- their profile has a portfolio section for each role. The profile only goes
-- live when every section they picked is filled in.
--
-- Videos are links (YouTube, Vimeo, TikTok, Instagram, Google Drive and so on)
-- rather than uploads, to stay inside Supabase's free 1 GB of storage.

alter table public.talents add column if not exists roles text[] not null default '{}';
update public.talents set roles = array[category] where roles = '{}';
alter table public.talent_photos add column if not exists role text;
alter table public.bookings add column if not exists role text;
alter table public.briefs drop constraint if exists briefs_category_check;

create table if not exists public.talent_links (
  id uuid primary key default gen_random_uuid(),
  talent_id uuid not null references public.talents (id) on delete cascade,
  role text not null,
  url text not null check (url ~ '^https://' and length(url) <= 500),
  title text check (length(title) <= 120),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists talent_links_talent on public.talent_links (talent_id, role, position);
alter table public.talent_links enable row level security;
revoke all on public.talent_links from anon, authenticated;

-- ---------------------------------------------------------------- what each role needs
-- photos / links: how many the section needs; height / social: extra fields.
create or replace function public.role_rules() returns jsonb
language sql immutable as $$
  select '{
    "Model":           {"photos": 3, "links": 0, "height": true,  "photo_label": "Modelling photos", "link_label": "Video (optional)", "hint": "At least 3 photos: a mix of close-up, full length and your best work."},
    "UGC creator":     {"photos": 0, "links": 2, "photo_label": "Stills (optional)", "link_label": "Example UGC videos", "hint": "Links to at least 2 UGC videos you have made (TikTok, Instagram, YouTube or Drive)."},
    "Actor":           {"photos": 1, "links": 1, "photo_label": "Headshots", "link_label": "Showreel", "hint": "At least 1 headshot and a link to your showreel."},
    "Content creator": {"photos": 1, "links": 1, "social": true, "photo_label": "Photos", "link_label": "Your channel or best posts", "hint": "Your Instagram or TikTok handle, a photo and a link to your channel or best post."},
    "Photographer":    {"photos": 3, "links": 0, "photo_label": "Portfolio", "link_label": "Website (optional)", "hint": "At least 3 photos you have shot."},
    "Videographer":    {"photos": 0, "links": 1, "photo_label": "Stills (optional)", "link_label": "Showreel", "hint": "A link to your showreel."},
    "Make-up artist":  {"photos": 3, "links": 0, "photo_label": "Portfolio", "link_label": "Video (optional)", "hint": "At least 3 photos of your work."},
    "Stylist":         {"photos": 3, "links": 0, "photo_label": "Portfolio", "link_label": "Video (optional)", "hint": "At least 3 photos of your work."}
  }'::jsonb $$;

-- what's still missing, per role the talent picked
create or replace function public._role_gaps(t talents) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r text; rule jsonb; np int; nl int; miss text[]; out jsonb := '[]';
begin
  foreach r in array t.roles loop
    rule := role_rules() -> r;
    continue when rule is null;
    select count(*) into np from talent_photos where talent_id = t.id and role = r;
    select count(*) into nl from talent_links where talent_id = t.id and role = r;
    miss := '{}';
    if np < (rule->>'photos')::int then miss := miss || ((rule->>'photos')::int - np || ' more ' || lower(rule->>'photo_label')); end if;
    if nl < (rule->>'links')::int then miss := miss || ((rule->>'links')::int - nl || ' more ' || case when (rule->>'links')::int = 1 then lower(rule->>'link_label') || ' link' else lower(rule->>'link_label') end); end if;
    if coalesce((rule->>'height')::boolean, false) and coalesce(t.height, '') = '' then miss := miss || 'your height'::text; end if;
    if coalesce((rule->>'social')::boolean, false) and coalesce(t.instagram, '') = '' then miss := miss || 'your Instagram or TikTok handle'::text; end if;
    if array_length(miss, 1) > 0 then out := out || jsonb_build_object('role', r, 'missing', to_jsonb(miss)); end if;
  end loop;
  return out;
end $$;

create or replace function public._republish(u uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t talents;
begin
  select * into t from talents where id = u;
  update talents set published = (t.name <> '' and t.handle is not null and t.day_rate is not null
                                  and array_length(t.roles, 1) > 0 and jsonb_array_length(_role_gaps(t)) = 0)
  where id = u;
end $$;

create or replace function public._roles_in(p jsonb) returns text[]
language sql immutable as $$
  select coalesce(array_agg(distinct x order by x), '{}') from jsonb_array_elements_text(coalesce(p, '[]')) x
  where public.role_rules() ? x $$;

-- ---------------------------------------------------------------- JSON shapes
create or replace function public._talent_card(t talents) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', t.id, 'handle', t.handle, 'name', t.name, 'category', t.roles[1],
    'roles', to_jsonb(t.roles), 'city', t.city, 'height', t.height, 'day_rate', t.day_rate, 'half_rate', t.half_rate,
    'travels', t.travels, 'verified', t.age_verified, 'photo', _photo(t.id),
    'rebooked_by', (select count(*) from (select brand_id from bookings where talent_id = t.id and status = 'completed'
                    group by brand_id having count(*) >= 2) x)) $$;

create or replace function public._talent_full(t talents) returns jsonb
language sql stable security definer set search_path = public as $$
  select _talent_card(t) || jsonb_build_object('bio', t.bio, 'tags', t.tags, 'instagram', t.instagram,
    'comfort', t.comfort, 'published', t.published, 'gaps', _role_gaps(t),
    'photos', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'path', path, 'role', role) order by position, created_at)
                        from talent_photos where talent_id = t.id), '[]'),
    'links', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'url', url, 'title', title, 'role', role) order by position, created_at)
                       from talent_links where talent_id = t.id), '[]'),
    'off_days', coalesce((select jsonb_agg(day order by day) from talent_off_days
                          where talent_id = t.id and day >= current_date and day < current_date + 120), '[]'),
    'booked_days', coalesce((select jsonb_agg(distinct d::date) from bookings b,
                              generate_series(b.shoot_date, b.shoot_date + b.days - 1, '1 day') d
                            where b.talent_id = t.id and b.status in ('accepted','confirmed','wrapped','disputed')
                              and b.shoot_date >= current_date - 14), '[]'),
    'completed', (select count(*) from bookings where talent_id = t.id and status = 'completed')) $$;

-- ---------------------------------------------------------------- sign-up and profile
create or replace function public.create_profile(p_role text, p_invite text default null, p_link text default null,
  p_handle text default null, p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _uid(); inv invites; mail text; ok boolean := false; dob date; rs text[];
begin
  if exists (select 1 from profiles where id = u) then raise exception 'Your account is already set up'; end if;
  if p_role not in ('talent','brand','ops') then raise exception 'Choose talent or brand'; end if;
  if nullif(trim(p_invite), '') is not null then
    select * into inv from invites where upper(code) = upper(trim(p_invite)) for update;
    if inv.code is null or inv.used_by is not null then raise exception 'That invite code isn''t valid or has been used'; end if;
    if inv.role <> p_role then raise exception 'That invite is for a % account', inv.role; end if;
    ok := true;
  elsif p_role = 'brand' and (exists (select 1 from booking_links where code = upper(trim(p_link)) and status = 'open')
                           or exists (select 1 from talents where lower(handle) = lower(trim(leading '@' from trim(p_handle))) and published)) then
    ok := true;
  end if;
  if not ok then raise exception 'Embr is invite-only during the pilot. You need an invite code.'; end if;

  if p_role = 'talent' then
    dob := nullif(p_data->>'dob', '')::date;
    if dob is null or dob > (current_date - interval '18 years')::date then raise exception 'Embr is for talent aged 18 and over'; end if;
    rs := _roles_in(p_data->'roles');
    if coalesce(array_length(rs, 1), 0) = 0 and role_rules() ? (p_data->>'category') then rs := array[p_data->>'category']; end if;
    if coalesce(array_length(rs, 1), 0) = 0 then raise exception 'Pick at least one thing you do'; end if;
  end if;

  mail := coalesce(auth.jwt()->>'email', (select email from auth.users where id = u));
  insert into profiles (id, role, email) values (u, p_role, mail);
  if inv.code is not null then update invites set used_by = u, used_at = now() where code = inv.code; end if;

  if p_role = 'talent' then
    insert into talents (id, name, category, roles, city, dob)
    values (u, coalesce(nullif(trim(p_data->>'name'), ''), ''), rs[1], rs, coalesce(nullif(p_data->>'city', ''), 'Manchester'), dob);
  elsif p_role = 'brand' then
    insert into brands (id, name, contact_name, city)
    values (u, coalesce(nullif(trim(p_data->>'name'), ''), ''), nullif(trim(p_data->>'contact_name'), ''),
            coalesce(nullif(p_data->>'city', ''), 'Manchester'));
    perform _notify_ops(null, 'New brand joined: ' || coalesce(nullif(trim(p_data->>'name'), ''), mail));
  end if;
  return me();
end $$;

create or replace function public.save_talent(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('talent'); h text; rs text[];
begin
  h := nullif(trim(leading '@' from trim(p->>'handle')), '');
  if h is not null and exists (select 1 from talents where lower(handle) = lower(h) and id <> u) then
    raise exception 'That Book-me name is taken. Try another.';
  end if;
  if p ? 'roles' then
    rs := _roles_in(p->'roles');
    if coalesce(array_length(rs, 1), 0) = 0 then raise exception 'Pick at least one thing you do'; end if;
  end if;
  update talents set
    name = coalesce(nullif(trim(p->>'name'), ''), name),
    handle = coalesce(h, handle),
    roles = coalesce(rs, roles),
    category = coalesce(rs[1], category),
    city = coalesce(nullif(p->>'city', ''), city),
    height = case when p ? 'height' then nullif(trim(p->>'height'), '') else height end,
    day_rate = case when p ? 'day_rate' then nullif(p->>'day_rate', '')::int else day_rate end,
    half_rate = case when p ? 'half_rate' then nullif(p->>'half_rate', '')::int else half_rate end,
    travels = coalesce((p->>'travels')::boolean, travels),
    instagram = case when p ? 'instagram' then nullif(trim(p->>'instagram'), '') else instagram end,
    bio = case when p ? 'bio' then left(nullif(trim(p->>'bio'), ''), 1200) else bio end,
    comfort = case when p ? 'comfort' then left(nullif(trim(p->>'comfort'), ''), 600) else comfort end,
    tags = case when p ? 'tags' then (select coalesce(array_agg(left(trim(x), 30)), '{}') from jsonb_array_elements_text(p->'tags') x where trim(x) <> '') else tags end,
    updated_at = now()
  where id = u;
  perform _republish(u);
  return me();
end $$;

drop function if exists public.add_photo(text);
create or replace function public.add_photo(p_path text, p_role text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('talent'); r text;
begin
  if split_part(p_path, '/', 1) <> u::text then raise exception 'Photo must be in your own folder'; end if;
  if (select count(*) from talent_photos where talent_id = u) >= 24 then raise exception 'You can have up to 24 photos'; end if;
  select coalesce(p_role, roles[1]) into r from talents where id = u;
  if not exists (select 1 from talents where id = u and r = any(roles)) then raise exception 'Add % to the things you do first', coalesce(r, 'a role'); end if;
  insert into talent_photos (talent_id, path, position, role)
  values (u, p_path, coalesce((select max(position) + 1 from talent_photos where talent_id = u), 0), r);
  perform _republish(u);
  return me();
end $$;

create or replace function public.add_link(p_role text, p_url text, p_title text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('talent'); url text := trim(p_url);
begin
  if not exists (select 1 from talents where id = u and p_role = any(roles)) then raise exception 'Add % to the things you do first', coalesce(p_role, 'a role'); end if;
  if url !~* '^https?://[^ ]+\.[^ ]+' then raise exception 'Paste the full link, starting https://'; end if;
  url := regexp_replace(url, '^http://', 'https://', 'i');
  if (select count(*) from talent_links where talent_id = u) >= 24 then raise exception 'You can have up to 24 links'; end if;
  insert into talent_links (talent_id, role, url, title, position)
  values (u, p_role, url, left(nullif(trim(p_title), ''), 120), coalesce((select max(position) + 1 from talent_links where talent_id = u), 0));
  perform _republish(u);
  return me();
end $$;

create or replace function public.remove_link(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('talent');
begin
  delete from talent_links where id = p_id and talent_id = u;
  perform _republish(u);
  return me();
end $$;

-- ---------------------------------------------------------------- search and ranking use every role
create or replace function public.search_talent(f jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare u uuid := _need('brand'); v_q text := lower(trim(coalesce(f->>'q', ''))); v_d date := nullif(f->>'date', '')::date;
  v_city text := nullif(f->>'city', ''); v_cat text := nullif(f->>'category', ''); v_max int := nullif(f->>'max_rate', '')::int;
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
        and (v_q = '' or lower(t.name || ' ' || array_to_string(t.roles, ' ') || ' ' || t.city || ' ' || coalesce(t.bio, '') || ' ' || array_to_string(t.tags, ' ')) like '%' || v_q || '%')
      limit 200) x), '[]');
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
    order by rk limit 6) x $$;

-- ---------------------------------------------------------------- bookings record which role they're for
create or replace function public._new_booking(p_brand uuid, p_talent uuid, p jsonb, p_link uuid default null) returns bookings
language plpgsql security definer set search_path = public as $$
declare f record; m record; b bookings; s settings; r text; v_role text;
begin
  select * into s from settings where id = 1;
  select * into f from fee_for(p_brand, p_talent, p_link is not null);
  select * into m from _money((p->>'day_rate')::int, coalesce((p->>'days')::int, 1), coalesce((p->>'usage_fee')::int, 0), f.rate);
  select case when nullif(p->>'role', '') = any (roles) then p->>'role' else roles[1] end into v_role from talents where id = p_talent;
  loop
    r := 'EMB-' || _code(6);
    exit when not exists (select 1 from bookings where ref = r);
  end loop;
  insert into bookings (ref, brand_id, talent_id, brief_id, link_id, title, shoot_date, days, day_rate, usage, usage_fee,
    location, call_time, notes, content_agreed, fee_rate, fee_label, session_p, talent_fee_p, embr_fee_p, total_p,
    deposit_p, balance_p, agreement_version, agreement_text, brand_agreed_at, role)
  values (r, p_brand, p_talent, nullif(p->>'brief_id', '')::uuid, p_link, trim(p->>'title'), (p->>'shoot_date')::date,
    coalesce((p->>'days')::int, 1), (p->>'day_rate')::int, nullif(trim(p->>'usage'), ''), coalesce((p->>'usage_fee')::int, 0),
    nullif(trim(p->>'location'), ''), nullif(trim(p->>'call_time'), ''), nullif(trim(p->>'notes'), ''),
    nullif(trim(p->>'content_agreed'), ''), f.rate, f.label, m.session_p, m.talent_fee_p, m.embr_fee_p, m.total_p,
    m.deposit_p, m.balance_p, s.agreement_version, '', now(), v_role)
  returning * into b;
  update bookings set agreement_text = replace(_agreement(b), E'\nTalent: ' || (select name from talents where id = p_talent),
      E'\nTalent: ' || (select name from talents where id = p_talent) || ' (booked as: ' || v_role || ')')
  where id = b.id returning * into b;
  return b;
end $$;

-- talent's own booking links carry a role too
alter table public.booking_links add column if not exists role text;
create or replace function public.create_link(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('talent'); t talents; c text; l booking_links;
begin
  select * into t from talents where id = u;
  if not t.age_verified then raise exception 'Verify your ID (18+) before creating booking links'; end if;
  if not t.payouts_enabled then raise exception 'Set up payouts before creating booking links'; end if;
  if nullif(trim(p->>'title'), '') is null then raise exception 'Say what the job is'; end if;
  if (p->>'shoot_date')::date < current_date then raise exception 'The shoot date has passed'; end if;
  if coalesce((p->>'day_rate')::int, 0) < 1 then raise exception 'Set a day rate'; end if;
  loop c := _code(7); exit when not exists (select 1 from booking_links where code = c); end loop;
  insert into booking_links (code, talent_id, title, shoot_date, days, day_rate, usage, usage_fee, note, role)
  values (c, u, trim(p->>'title'), (p->>'shoot_date')::date, coalesce((p->>'days')::int, 1), (p->>'day_rate')::int,
          nullif(trim(p->>'usage'), ''), coalesce((p->>'usage_fee')::int, 0), nullif(trim(p->>'note'), ''),
          case when nullif(p->>'role', '') = any (t.roles) then p->>'role' else t.roles[1] end)
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
         'location', p_extra->>'location', 'call_time', p_extra->>'call_time', 'notes', p_extra->>'notes'), l.id);
  update bookings set status = 'accepted', talent_agreed_at = l.created_at where id = b.id;
  update booking_links set status = 'used', booking_id = b.id where id = l.id;
  perform _log(b.id, 'brand', br.name || ' booked through ' || t.name || '''s booking link and accepted the booking agreement.');
  perform _notify(l.talent_id, b.id, br.name || ' accepted your booking link for “' || l.title || '”. You''ll hear when the deposit is paid.');
  return b.id;
end $$;

-- public Book-me page: no to-do list for strangers
create or replace function public.public_talent(p_handle text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t talents;
begin
  select * into t from talents where lower(handle) = lower(trim(leading '@' from trim(p_handle))) and published;
  if t.id is null then return null; end if;
  return _talent_full(t) - 'off_days' - 'comfort' - 'gaps' - 'published';
end $$;

-- role on the booking for the call sheet

create or replace function public.booking_detail(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b bookings; v text;
begin
  select * into b from bookings where id = p_id;
  if b.id is null then raise exception 'Booking not found'; end if;
  v := _can_see(b);
  insert into message_reads (booking_id, user_id) values (b.id, auth.uid())
    on conflict (booking_id, user_id) do update set read_at = now();
  return _booking_json(b, v) || jsonb_build_object('role', b.role);
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
    'open', l.status = 'open' and l.expires_at > now() and l.shoot_date >= current_date,
    'status', l.status, 'fee_rate', s.fee_link, 'talent_fee_p', m.talent_fee_p, 'embr_fee_p', m.embr_fee_p,
    'total_p', m.total_p, 'deposit_p', m.deposit_p, 'balance_p', m.balance_p,
    'talent', _talent_card(t) || jsonb_build_object('bio', t.bio));
end $$;

-- existing photos belong to the person's first role
update public.talent_photos p set role = t.roles[1] from public.talents t where t.id = p.talent_id and p.role is null;

-- ---------------------------------------------------------------- permissions
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.check_invite(text), public.public_link(text), public.public_talent(text), public.role_rules() to anon, authenticated;
grant execute on function
  public.me(), public.create_profile(text, text, text, text, jsonb),
  public.save_talent(jsonb), public.add_photo(text, text), public.remove_photo(uuid), public.cover_photo(uuid), public.toggle_off_day(date),
  public.add_link(text, text, text), public.remove_link(uuid),
  public.save_brand(jsonb), public.search_talent(jsonb), public.talent_detail(uuid), public.toggle_shortlist(uuid), public.my_shortlist(),
  public.create_brief(jsonb), public.my_briefs(), public.brief_detail(uuid), public.close_brief(uuid),
  public.quote(uuid, int, int, int), public.create_offer(jsonb), public.my_bookings(), public.booking_detail(uuid),
  public.respond_offer(uuid, boolean, boolean, text), public.withdraw_offer(uuid), public.talent_withdraw(uuid, text),
  public.mark_wrapped(uuid), public.report_problem(uuid, text), public.send_message(uuid, text),
  public.notifications(), public.read_notifications(),
  public.create_link(jsonb), public.my_links(), public.withdraw_link(uuid), public.accept_link(text, boolean, jsonb),
  public.ops_overview(), public.ops_bookings(text), public.ops_people(), public.ops_briefs(),
  public.ops_create_invite(text, text), public.ops_invites(), public.ops_message(uuid, text)
to authenticated;
grant execute on all functions in schema public to service_role;
