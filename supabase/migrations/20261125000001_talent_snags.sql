-- Talent demo snag list (Luke, 2026-11-25):
--  * hair stylist and nail technician roles
--  * travel is a range plus who covers costs, not just "local" or "anywhere"
--  * talent confirm their agency status at sign-up (wording: agency_declaration(),
--    DRAFT pending solicitor review, see docs/dev/agency-declaration.md)
--  * a Stripe ID check that comes back without a date of birth goes to staff review,
--    not "under 18"

alter table public.talents
  add column if not exists travel_range text not null default 'local'
    check (travel_range in ('local', 'region', 'uk', 'international')),
  add column if not exists travel_costs text not null default 'discuss'
    check (travel_costs in ('paid', 'nearby_included', 'discuss')),
  add column if not exists agency_declared_at timestamptz,
  add column if not exists agency_declaration text;
update public.talents set travel_range = 'uk', travel_costs = 'paid' where travels;

-- the exact words talent agree to (versioned, so each record shows what was agreed)
create or replace function public.agency_declaration() returns text
language sql immutable as $$
  select 'agency-v1 (draft 2026-11-25): I confirm that I am not under an exclusive contract with a modelling or talent agency, '
      || 'or that any agency or management contract I have allows me to accept bookings on my own. I am responsible for making sure '
      || 'that using Embr and accepting bookings does not break any agreement I have with anyone else, and Embr is not responsible '
      || 'for any such breach. I will tell Embr if this changes.' $$;

-- roles: adds Hair stylist and Nail technician
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
    "Hair stylist":    {"photos": 3, "links": 0, "photo_label": "Portfolio", "link_label": "Video (optional)", "hint": "At least 3 photos of hair you have styled."},
    "Nail technician": {"photos": 3, "links": 0, "photo_label": "Portfolio", "link_label": "Video (optional)", "hint": "At least 3 photos of nails you have done."},
    "Stylist":         {"photos": 3, "links": 0, "photo_label": "Portfolio", "link_label": "Video (optional)", "hint": "At least 3 photos of your work."}
  }'::jsonb $$;

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
    if coalesce(p_data->>'agency', '') not in ('yes', 'true') then raise exception 'Confirm your agency status to continue'; end if;
  end if;

  mail := coalesce(auth.jwt()->>'email', (select email from auth.users where id = u));
  insert into profiles (id, role, email) values (u, p_role, mail);
  if inv.code is not null then update invites set used_by = u, used_at = now() where code = inv.code; end if;

  if p_role = 'talent' then
    insert into talents (id, name, category, roles, city, dob, agency_declared_at, agency_declaration)
    values (u, coalesce(nullif(trim(p_data->>'name'), ''), ''), rs[1], rs, coalesce(nullif(p_data->>'city', ''), 'Manchester'), dob,
            now(), agency_declaration());
  elsif p_role = 'brand' then
    insert into brands (id, name, contact_name, city)
    values (u, coalesce(nullif(trim(p_data->>'name'), ''), ''), nullif(trim(p_data->>'contact_name'), ''),
            coalesce(nullif(p_data->>'city', ''), 'Manchester'));
    perform _notify_ops(null, 'New brand joined: ' || coalesce(nullif(trim(p_data->>'name'), ''), mail));
  end if;
  return me();
end $$;


-- travel range and costs; "travels" stays as the search flag (anything beyond local)
create or replace function public.save_travel(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('talent'); r text := nullif(p->>'travel_range', ''); c text := nullif(p->>'travel_costs', '');
begin
  if r is not null and r not in ('local', 'region', 'uk', 'international') then raise exception 'Pick how far you travel'; end if;
  if c is not null and c not in ('paid', 'nearby_included', 'discuss') then raise exception 'Pick how travel costs work'; end if;
  update talents set travel_range = coalesce(r, travel_range), travel_costs = coalesce(c, travel_costs),
    travels = coalesce(r, travel_range) <> 'local', updated_at = now()
  where id = u;
  return me();
end $$;

create or replace function public._talent_card(t talents) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', t.id, 'handle', t.handle, 'name', t.name, 'category', t.roles[1],
    'roles', to_jsonb(t.roles), 'city', t.city, 'height', t.height, 'day_rate', t.day_rate, 'half_rate', t.half_rate,
    'travels', t.travels, 'travel_range', t.travel_range, 'travel_costs', t.travel_costs, 'agency_declared', t.agency_declared_at is not null, 'verified', t.age_verified, 'photo', _photo(t.id),
    'stats', case when 'Model' = any (t.roles) then _model_stats(t) end,
    'rebooked_by', (select count(*) from (select brand_id from bookings where talent_id = t.id and status = 'completed'
                    group by brand_id having count(*) >= 2) x)) $$;


-- talent who joined before the declaration existed confirm it from their profile
create or replace function public.declare_agency() returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('talent');
begin
  update talents set agency_declared_at = now(), agency_declaration = agency_declaration() where id = u;
  perform _republish(u);
  return me();
end $$;

-- a profile only goes live once the agency status is confirmed
create or replace function public._republish(u uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t talents;
begin
  select * into t from talents where id = u;
  update talents set published = (t.name <> '' and t.handle is not null and t.day_rate is not null
                                  and array_length(t.roles, 1) > 0 and jsonb_array_length(_role_gaps(t)) = 0
                                  and t.agency_declared_at is not null)
  where id = u;
end $$;

-- verified by Stripe but no date of birth came back: staff check it, it is not "under 18"
create or replace function public.svc_identity_result(p_user uuid, p_session text, p_status text, p_dob date) returns void
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  if p_status = 'verified' and p_dob is null then
    update talents set identity_status = 'review', identity_session = p_session where id = p_user;
    perform _notify(p_user, null, 'Your ID check went through. Embr is confirming your age and will let you know shortly.', '/profile');
    perform _notify_ops(null, 'An ID check was verified but Stripe sent no date of birth. Check it in Stripe and People.');
  elsif p_status = 'verified' then
    ok := p_dob <= (current_date - interval '18 years')::date;
    update talents set age_verified = ok, age_verified_at = case when ok then now() end,
      identity_status = case when ok then 'verified' else 'under_18' end, identity_session = p_session where id = p_user;
    perform _notify(p_user, null, case when ok then 'ID checked. You''re verified 18+ and can accept bookings.'
      else 'Your ID shows you''re under 18. Embr is for talent aged 18 and over.' end, '/profile');
    if not ok then perform _notify_ops(null, 'ID check returned under 18 for a talent account. Review it in People.'); end if;
  else
    update talents set identity_status = p_status where id = p_user and identity_session = p_session;
    if p_status = 'requires_input' then
      perform _notify(p_user, null, 'Your ID check couldn''t be completed. Open Profile to try again.', '/profile');
    end if;
  end if;
end $$;

-- grants: new functions are closed by default, open only what the app calls
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.check_invite(text), public.public_link(text), public.public_talent(text),
  public.role_rules(), public.model_options(), public.agency_declaration() to anon, authenticated;
grant execute on function public.create_profile(text, text, text, text, jsonb), public.me(),
  public.save_talent(jsonb), public.save_model_stats(jsonb), public.add_photo(text, text), public.remove_photo(uuid), public.cover_photo(uuid),
  public.toggle_off_day(date), public.add_link(text, text, text), public.remove_link(uuid), public.save_travel(jsonb), public.declare_agency(),
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
