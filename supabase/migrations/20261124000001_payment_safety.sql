-- Payment safety fixes (review of the Stripe integration, 2026-11-24):
--  * a webhook that fails is forgotten, so Stripe's retry is handled, not skipped
--  * the balance charge and each transfer are recorded the moment they happen,
--    so a retry after a partial failure never charges or pays twice
--  * Embr staff are told about chargebacks, failed payouts and disconnected accounts

alter table public.bookings
  add column if not exists transfer_dep text,
  add column if not exists transfer_bal text;

create or replace function public.svc_event_forget(p_id text) returns void
language sql security definer set search_path = public as $$ delete from stripe_events where id = p_id $$;

-- the balance was charged: save it before anything else can fail
create or replace function public.svc_balance_charged(p_id uuid, p_intent text, p_charge text) returns void
language sql security definer set search_path = public as $$
  update bookings set balance_intent = p_intent, balance_charge = p_charge, balance_paid_at = coalesce(balance_paid_at, now())
  where id = p_id $$;

-- one transfer to the talent was made: 'dep' (from the deposit) or 'bal' (from the balance)
create or replace function public.svc_transfer_made(p_id uuid, p_kind text, p_transfer text) returns void
language sql security definer set search_path = public as $$
  update bookings set transfer_dep = case when p_kind = 'dep' then p_transfer else transfer_dep end,
                      transfer_bal = case when p_kind = 'bal' then p_transfer else transfer_bal end
  where id = p_id $$;

-- a balance Checkout link expired or was cancelled by Embr
create or replace function public.svc_balance_checkout_cleared(p_session text) returns void
language sql security definer set search_path = public as $$
  update bookings set balance_checkout = null, balance_checkout_url = null
  where balance_checkout = p_session and status <> 'completed' $$;

create or replace function public.svc_booking_by_charge(p_charge text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from bookings where deposit_charge = p_charge or balance_charge = p_charge limit 1 $$;

-- something about money that Embr staff need to look at
create or replace function public.svc_ops_alert(p_booking uuid, p_text text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_booking is not null then perform _log(p_booking, 'embr', p_text); end if;
  perform _notify_ops(p_booking, p_text);
end $$;

-- service-only, like the other svc_ functions
revoke execute on function public.svc_event_forget(text), public.svc_balance_charged(uuid, text, text),
  public.svc_transfer_made(uuid, text, text), public.svc_balance_checkout_cleared(text),
  public.svc_booking_by_charge(text), public.svc_ops_alert(uuid, text) from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
