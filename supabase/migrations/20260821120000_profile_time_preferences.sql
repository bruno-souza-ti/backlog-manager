-- Each person sets their own contracted daily hours (defaults to 8h) —
-- self-service, same reasoning as name/avatar: update_own_profile already
-- does a blind overwrite of its two fields (confirmed by reading it), so a
-- third unrelated field goes in its own small RPC instead of coupling this
-- form to also know/resend full_name/avatar_url on every save.

alter table public.profiles
  add column expected_daily_minutes integer not null default 480
  check (expected_daily_minutes > 0 and expected_daily_minutes <= 720);

create or replace function public.update_own_time_preferences(p_expected_daily_minutes int)
returns setof public.profiles
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_expected_daily_minutes is null or p_expected_daily_minutes <= 0 or p_expected_daily_minutes > 720 then
    raise exception 'Horas de trabalho inválidas.' using errcode = '22023';
  end if;

  return query
    update public.profiles
       set expected_daily_minutes = p_expected_daily_minutes,
           updated_at = now()
     where id = (select auth.uid())
    returning *;
end;
$$;

revoke all on function public.update_own_time_preferences(int) from public, anon;
grant execute on function public.update_own_time_preferences(int) to authenticated;
