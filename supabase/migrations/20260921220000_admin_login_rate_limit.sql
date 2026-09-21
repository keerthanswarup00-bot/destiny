-- Durable, bounded admin login rate limiting for serverless deployments.
create table if not exists public.admin_login_rate_limits (
  bucket_key text primary key check (char_length(bucket_key) = 64),
  attempt_count integer not null check (attempt_count > 0),
  window_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_login_rate_limits enable row level security;
revoke all on public.admin_login_rate_limits from anon, authenticated;

create or replace function public.check_admin_login_rate_limit(
  p_account_key text,
  p_network_key text,
  p_account_limit integer,
  p_network_limit integer,
  p_window_minutes integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  account_count integer;
  network_count integer;
  now_at timestamptz := now();
begin
  if (p_account_key is not null and char_length(p_account_key) <> 64)
    or p_network_key is null and p_account_key is null
    or p_account_limit < 1 or p_network_limit < 1 or p_window_minutes < 1 then
    return true;
  end if;

  if p_account_key is not null then
    select case
      when window_started_at <= now_at - make_interval(mins => p_window_minutes) then 0
      else attempt_count
    end into account_count
    from public.admin_login_rate_limits
    where bucket_key = p_account_key;

    if coalesce(account_count, 0) >= p_account_limit then
      return false;
    end if;
  end if;

  if p_network_key is null then
    return true;
  end if;

  select case
    when window_started_at <= now_at - make_interval(mins => p_window_minutes) then 0
    else attempt_count
  end into network_count
  from public.admin_login_rate_limits
  where bucket_key = p_network_key;

  return coalesce(network_count, 0) < p_network_limit;
end;
$$;

create or replace function public.record_admin_login_failure(
  p_account_key text,
  p_network_key text,
  p_window_minutes integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  now_at timestamptz := now();
begin
  if (p_account_key is not null and char_length(p_account_key) <> 64)
    or (p_network_key is not null and char_length(p_network_key) <> 64)
    or p_account_key is null and p_network_key is null
    or p_window_minutes < 1 then
    return;
  end if;

  if p_account_key is not null then
    insert into public.admin_login_rate_limits (bucket_key, attempt_count, window_started_at, updated_at)
    values (p_account_key, 1, now_at, now_at)
    on conflict (bucket_key) do update
      set attempt_count = case
        when public.admin_login_rate_limits.window_started_at <= now_at - make_interval(mins => p_window_minutes)
          then 1
        else public.admin_login_rate_limits.attempt_count + 1
      end,
      window_started_at = case
        when public.admin_login_rate_limits.window_started_at <= now_at - make_interval(mins => p_window_minutes)
          then now_at
        else public.admin_login_rate_limits.window_started_at
      end,
      updated_at = now_at;
  end if;

  if p_network_key is not null then
    insert into public.admin_login_rate_limits (bucket_key, attempt_count, window_started_at, updated_at)
    values (p_network_key, 1, now_at, now_at)
    on conflict (bucket_key) do update
      set attempt_count = case
        when public.admin_login_rate_limits.window_started_at <= now_at - make_interval(mins => p_window_minutes)
          then 1
        else public.admin_login_rate_limits.attempt_count + 1
      end,
      window_started_at = case
        when public.admin_login_rate_limits.window_started_at <= now_at - make_interval(mins => p_window_minutes)
          then now_at
        else public.admin_login_rate_limits.window_started_at
      end,
      updated_at = now_at;
  end if;
end;
$$;

revoke all on function public.check_admin_login_rate_limit(text, text, integer, integer, integer) from public;
revoke all on function public.record_admin_login_failure(text, text, integer) from public;
grant execute on function public.check_admin_login_rate_limit(text, text, integer, integer, integer) to service_role;
grant execute on function public.record_admin_login_failure(text, text, integer) to service_role;
