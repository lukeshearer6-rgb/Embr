-- Staff confirm an ID check that Stripe passed but whose date of birth Embr couldn't read
-- (status 'review'). Staff check the session in the Stripe dashboard first.
create or replace function public.ops_confirm_age(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := _need('ops');
begin
  update talents set age_verified = true, age_verified_at = now(), identity_status = 'verified'
  where id = p_id and identity_status = 'review';
  if not found then raise exception 'This ID check isn''t waiting for staff to confirm'; end if;
  perform _notify(p_id, null, 'ID checked. You''re verified 18+ and can accept bookings.', '/profile');
  return jsonb_build_object('ok', true, 'by', u);
end $$;

revoke execute on function public.ops_confirm_age(uuid) from public, anon;
grant execute on function public.ops_confirm_age(uuid) to authenticated;
grant execute on all functions in schema public to service_role;
