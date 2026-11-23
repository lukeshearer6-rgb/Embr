-- Run once in the Supabase SQL editor after deploying the functions.
-- Replace the three values in angle brackets first.

-- 1. Secrets the database uses to call Embr's functions (stored encrypted in Vault)
select vault.create_secret('https://<PROJECT-REF>.supabase.co/functions/v1', 'functions_url');
select vault.create_secret('<EMAIL_HOOK_SECRET>', 'email_hook_secret');
select vault.create_secret('<CRON_SECRET>', 'cron_secret');

-- 2. Extensions for web calls and scheduling (both on Supabase's free plan)
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- 3. Every 15 minutes: sign off bookings 72 hours after wrap
select cron.schedule('embr-auto-signoff', '*/15 * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'functions_url') || '/cron',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-embr-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{}'::jsonb)
$$);

-- 4. Your first Embr staff invite code. Copy the code it returns.
select public.first_ops_invite();
