-- Clearer staff alert when an ID check needs staff to confirm the age, linking to People
create or replace function public._notify_ops_url(link text, t text) returns void
language sql security definer set search_path = public as $$
  insert into notifications (user_id, text, url) select id, t, link from profiles where role = 'ops' $$;

create or replace function public.svc_identity_result(p_user uuid, p_session text, p_status text, p_dob date) returns void
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  if p_status = 'verified' and p_dob is null then
    update talents set identity_status = 'review', identity_session = p_session where id = p_user;
    perform _notify(p_user, null, 'Your ID check went through. Embr is confirming your age and will let you know shortly.', '/profile');
    perform _notify_ops_url('/people', 'An ID check passed and needs you to confirm the age. Open the admin website, go to People, and tap Confirm 18+ under ID checks to confirm.');
  elsif p_status = 'verified' then
    ok := p_dob <= (current_date - interval '18 years')::date;
    update talents set age_verified = ok, age_verified_at = case when ok then now() end,
      identity_status = case when ok then 'verified' else 'under_18' end, identity_session = p_session where id = p_user;
    perform _notify(p_user, null, case when ok then 'ID checked. You''re verified 18+ and can accept bookings.'
      else 'Your ID shows you''re under 18. Embr is for talent aged 18 and over.' end, '/profile');
    if not ok then perform _notify_ops_url('/people', 'ID check returned under 18 for a talent account. Review it in People.'); end if;
  else
    update talents set identity_status = p_status where id = p_user and identity_session = p_session;
    if p_status = 'requires_input' then
      perform _notify(p_user, null, 'Your ID check couldn''t be completed. Open Profile to try again.', '/profile');
    end if;
  end if;
end $$;

revoke execute on function public._notify_ops_url(text, text) from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
