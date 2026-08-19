-- Real online/offline signal for team presence. Status alone (available/busy/
-- in_meeting/offline) was purely manual and never reflected whether the
-- person actually had an active session — someone could sit at "Disponível"
-- for days after closing the tab. last_seen_at is bumped by a lightweight
-- heartbeat RPC the client calls periodically while the tab is visible;
-- the frontend then treats a stale last_seen_at as authoritative for
-- "offline", regardless of the stored status value.

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

update public.profiles
   set last_seen_at = coalesce(last_seen_at, status_updated_at, now())
 where last_seen_at is null;

create or replace function public.heartbeat()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_access_app() then
    raise exception 'User is not authorized to access the application'
      using errcode = '42501';
  end if;

  update public.profiles
     set last_seen_at = now()
   where id = auth.uid();

  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.heartbeat() from public, anon;
grant execute on function public.heartbeat() to authenticated;

-- Any explicit presence update (e.g. starting/ending a meeting) is itself
-- proof of an active session, so it counts as a heartbeat too.
create or replace function public.update_my_presence(
  p_status text,
  p_current_client_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_access_app() then
    raise exception 'User is not authorized to access the application'
      using errcode = '42501';
  end if;

  if p_status not in ('available', 'busy', 'in_meeting', 'offline') then
    raise exception 'Invalid presence status' using errcode = '22023';
  end if;

  update public.profiles
  set status = p_status,
      current_client_id = p_current_client_id,
      status_updated_at = now(),
      last_seen_at = now()
  where id = auth.uid();

  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
end;
$$;
