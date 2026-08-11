-- Invite-only access control and role-based RLS.
--
-- IMPORTANT: existing profiles are intentionally backfilled as active so this
-- migration does not lock the current internal team out. Review the profile
-- list before applying this migration to staging/production.

alter table public.profiles
  add column if not exists is_active boolean;

-- Existing accounts predate invite-only access and are treated as approved.
update public.profiles
set is_active = true
where is_active is null;

alter table public.profiles
  alter column is_active set default false,
  alter column is_active set not null,
  alter column role set default 'member',
  alter column role set not null;

update public.profiles
set role = 'member'
where role not in ('owner', 'admin', 'member');

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('owner', 'admin', 'member'));

-- These helpers deliberately take no user id. Authorization is always based
-- on the JWT subject and callers cannot ask about another user's access.
create or replace function public.can_access_app()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_active = true
      and role in ('owner', 'admin', 'member')
  );
$$;

create or replace function public.has_admin_role()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_active = true
      and role in ('owner', 'admin')
  );
$$;

-- Presence is the only profile mutation available directly to a member.
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
      status_updated_at = now()
  where id = auth.uid();

  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
end;
$$;

-- New Auth users are created inactive. Stage 2 will activate them only after
-- an owner/admin invitation has been accepted by the server-side flow.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, role, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.email, ''),
    'member',
    false
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.can_access_app() from public, anon;
revoke all on function public.has_admin_role() from public, anon;
revoke all on function public.update_my_presence(text, uuid) from public, anon;
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.can_access_app() to authenticated;
grant execute on function public.has_admin_role() to authenticated;
grant execute on function public.update_my_presence(text, uuid) to authenticated;

-- Remove every existing policy on application tables before installing the
-- closed policy set below. This prevents legacy "authenticated = true"
-- policies from silently keeping broad access open.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles',
        'user_settings',
        'clients',
        'tasks',
        'meetings',
        'client_files',
        'client_notes_history',
        'activity_log',
        'client_health_state',
        'google_oauth_tokens'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  end loop;
end;
$$;

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.clients enable row level security;
alter table public.tasks enable row level security;
alter table public.meetings enable row level security;
alter table public.client_files enable row level security;
alter table public.client_notes_history enable row level security;
alter table public.activity_log enable row level security;
alter table public.client_health_state enable row level security;
alter table public.google_oauth_tokens enable row level security;

-- An inactive user may read only their own profile so the frontend can show a
-- precise access-denied screen. Active users may read the team directory.
create policy profiles_select_authorized
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.can_access_app());

-- Direct profile administration is never allowed against the caller's own
-- row. Stage 2 adds stricter owner/admin business rules in the server API.
create policy profiles_admin_update_others
  on public.profiles for update
  to authenticated
  using (public.has_admin_role() and id <> auth.uid())
  with check (public.has_admin_role() and id <> auth.uid());

create policy user_settings_select_own
  on public.user_settings for select
  to authenticated
  using (public.can_access_app() and user_id = auth.uid());

create policy user_settings_insert_own
  on public.user_settings for insert
  to authenticated
  with check (public.can_access_app() and user_id = auth.uid());

create policy user_settings_update_own
  on public.user_settings for update
  to authenticated
  using (public.can_access_app() and user_id = auth.uid())
  with check (public.can_access_app() and user_id = auth.uid());

create policy user_settings_delete_own
  on public.user_settings for delete
  to authenticated
  using (public.can_access_app() and user_id = auth.uid());

create policy clients_active_members
  on public.clients for all
  to authenticated
  using (public.can_access_app())
  with check (public.can_access_app());

create policy tasks_active_members
  on public.tasks for all
  to authenticated
  using (public.can_access_app())
  with check (public.can_access_app());

create policy meetings_active_members
  on public.meetings for all
  to authenticated
  using (public.can_access_app())
  with check (public.can_access_app());

create policy client_files_active_members
  on public.client_files for all
  to authenticated
  using (public.can_access_app())
  with check (public.can_access_app());

create policy client_notes_active_members
  on public.client_notes_history for all
  to authenticated
  using (public.can_access_app())
  with check (public.can_access_app());

create policy activity_log_select_active_members
  on public.activity_log for select
  to authenticated
  using (public.can_access_app());

create policy activity_log_insert_own
  on public.activity_log for insert
  to authenticated
  with check (public.can_access_app() and user_id = auth.uid());

create policy client_health_select_active_members
  on public.client_health_state for select
  to authenticated
  using (public.can_access_app());

create policy google_tokens_own_active_member
  on public.google_oauth_tokens for all
  to authenticated
  using (public.can_access_app() and user_id = auth.uid())
  with check (public.can_access_app() and user_id = auth.uid());

-- PostgreSQL views otherwise execute with the view owner's permissions and can
-- bypass the RLS policies on profiles/tasks/clients.
alter view public.team_assignments set (security_invoker = true);
alter view public.team_workload set (security_invoker = true);

comment on column public.profiles.is_active is
  'Whether this profile is approved to access Geniality operational data.';
comment on function public.can_access_app() is
  'JWT-bound active membership check used by application RLS policies.';
comment on function public.has_admin_role() is
  'JWT-bound owner/admin check used by privileged application operations.';
