-- Security and consistency follow-up for invite-only RBAC and the client
-- lifecycle migration already applied as 20260808140150.

-- Trigger helpers never need to be callable through the Data API. Fix their
-- object resolution and remove the default PUBLIC/anon/authenticated execute
-- grants that PostgreSQL gives new functions.
alter function public.set_updated_at() set search_path = '';
alter function public.set_status_updated_at() set search_path = '';

create or replace function public.check_client_not_frozen_or_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_client_id uuid;
  client_status text;
  client_deleted_at timestamptz;
begin
  target_client_id := case when tg_op = 'DELETE' then old.client_id else new.client_id end;

  if target_client_id is not null then
    select status, deleted_at
      into client_status, client_deleted_at
      from public.clients
     where id = target_client_id;

    if client_deleted_at is not null then
      raise exception 'O cliente está excluído. Restaure-o antes de modificar seus dados.'
        using errcode = '55000';
    end if;

    if client_status = 'frozen' then
      raise exception 'O cliente está congelado. Descongele-o antes de modificar seus dados.'
        using errcode = '55000';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.set_status_updated_at() from public, anon, authenticated;
revoke all on function public.check_client_not_frozen_or_deleted() from public, anon, authenticated;

-- Client lifecycle changes are privileged, audited and idempotent. Direct
-- column updates remain unavailable to the browser; owner/admin callers use
-- this RPC and provide one request key that can safely be retried.
create or replace function public.set_client_lifecycle(
  p_client_id uuid,
  p_action text,
  p_event_key text
)
returns table(status text, deleted_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_client public.clients%rowtype;
  next_status text;
  next_deleted_at timestamptz;
  actor_name text;
  action_label text;
begin
  if auth.uid() is null or not public.has_admin_role() then
    raise exception 'Somente administradores podem alterar o ciclo de vida do cliente.'
      using errcode = '42501';
  end if;

  if p_event_key is null or length(trim(p_event_key)) < 8 then
    raise exception 'Identificador idempotente inválido.' using errcode = '22023';
  end if;

  if p_action not in ('active', 'inactive', 'frozen', 'deleted', 'restore') then
    raise exception 'Ação de ciclo de vida inválida.' using errcode = '22023';
  end if;

  select * into current_client
  from public.clients
  where id = p_client_id
  for update;

  if not found then
    raise exception 'Cliente não encontrado.' using errcode = 'P0002';
  end if;

  if p_action = 'deleted' then
    next_status := 'inactive';
    next_deleted_at := coalesce(current_client.deleted_at, now());
    action_label := 'removeu o cliente';
  elsif p_action = 'restore' then
    next_status := 'active';
    next_deleted_at := null;
    action_label := 'restaurou o cliente';
  else
    if current_client.deleted_at is not null then
      raise exception 'Restaure o cliente antes de alterar seu status.' using errcode = '55000';
    end if;
    next_status := p_action;
    next_deleted_at := null;
    action_label := case p_action
      when 'active' then 'ativou o cliente'
      when 'inactive' then 'marcou o cliente como inativo'
      when 'frozen' then 'congelou o cliente'
    end;
  end if;

  if current_client.status is not distinct from next_status
     and current_client.deleted_at is not distinct from next_deleted_at then
    return query select current_client.status, current_client.deleted_at;
    return;
  end if;

  update public.clients
     set status = next_status,
         deleted_at = next_deleted_at,
         updated_at = now()
   where id = p_client_id;

  actor_name := public.activity_actor_name(auth.uid());

  insert into public.activity_log (
    user_id,
    action_type,
    description,
    client_id,
    event_key
  ) values (
    auth.uid(),
    'client_lifecycle_changed',
    actor_name || ' ' || action_label || ' (' || current_client.name || ')',
    p_client_id,
    'client-lifecycle:' || p_event_key
  )
  on conflict (event_key) where event_key is not null do nothing;

  return query select next_status, next_deleted_at;
end;
$$;

revoke all on function public.set_client_lifecycle(uuid, text, text) from public, anon;
grant execute on function public.set_client_lifecycle(uuid, text, text) to authenticated;

drop trigger if exists tasks_block_frozen_client on public.tasks;
drop trigger if exists notes_block_frozen_client on public.client_notes_history;
drop trigger if exists files_block_frozen_client on public.client_files;

create trigger tasks_block_frozen_client
  before insert or update or delete on public.tasks
  for each row execute function public.check_client_not_frozen_or_deleted();

create trigger notes_block_frozen_client
  before insert or update or delete on public.client_notes_history
  for each row execute function public.check_client_not_frozen_or_deleted();

create trigger files_block_frozen_client
  before insert or update or delete on public.client_files
  for each row execute function public.check_client_not_frozen_or_deleted();

-- Anonymous callers do not need to discover any operational object through
-- REST/GraphQL. RLS remains enabled as the row-level authority for signed-in
-- callers.
revoke all on table
  public.profiles,
  public.user_settings,
  public.clients,
  public.tasks,
  public.meetings,
  public.client_files,
  public.client_notes_history,
  public.activity_log,
  public.client_health_state,
  public.google_oauth_tokens,
  public.team_assignments,
  public.team_workload
from anon;

-- Client status/deletion cannot be changed through generic table UPDATE.
-- Normal operations keep only the columns currently used by the application.
revoke insert, update, delete on table public.clients from authenticated;
grant select on table public.clients to authenticated;
grant insert (name, logo_color, notes, created_by) on table public.clients to authenticated;
grant update (name, logo_color, notes) on table public.clients to authenticated;

drop policy if exists clients_active_members on public.clients;
drop policy if exists clients_select_active_members on public.clients;
drop policy if exists clients_insert_admins on public.clients;
drop policy if exists clients_update_active_members on public.clients;

create policy clients_select_active_members
  on public.clients for select
  to authenticated
  using (
    (select public.can_access_app())
    and (deleted_at is null or (select public.has_admin_role()))
  );

create policy clients_insert_admins
  on public.clients for insert
  to authenticated
  with check (
    (select public.has_admin_role())
    and created_by = (select auth.uid())
    and status = 'active'
    and deleted_at is null
  );

create policy clients_update_active_members
  on public.clients for update
  to authenticated
  using (
    (select public.can_access_app())
    and deleted_at is null
    and status <> 'frozen'
  )
  with check (
    (select public.can_access_app())
    and deleted_at is null
    and status <> 'frozen'
  );

-- Avoid per-row auth function evaluation in the policies flagged by the
-- database advisor.
drop policy if exists profiles_select_authorized on public.profiles;
create policy profiles_select_authorized
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or (select public.can_access_app()));

drop policy if exists profiles_admin_update_others on public.profiles;
create policy profiles_admin_update_others
  on public.profiles for update
  to authenticated
  using ((select public.has_admin_role()) and id <> (select auth.uid()))
  with check ((select public.has_admin_role()) and id <> (select auth.uid()));

drop policy if exists user_settings_select_own on public.user_settings;
create policy user_settings_select_own
  on public.user_settings for select
  to authenticated
  using ((select public.can_access_app()) and user_id = (select auth.uid()));

drop policy if exists user_settings_insert_own on public.user_settings;
create policy user_settings_insert_own
  on public.user_settings for insert
  to authenticated
  with check ((select public.can_access_app()) and user_id = (select auth.uid()));

drop policy if exists user_settings_update_own on public.user_settings;
create policy user_settings_update_own
  on public.user_settings for update
  to authenticated
  using ((select public.can_access_app()) and user_id = (select auth.uid()))
  with check ((select public.can_access_app()) and user_id = (select auth.uid()));

drop policy if exists user_settings_delete_own on public.user_settings;
create policy user_settings_delete_own
  on public.user_settings for delete
  to authenticated
  using ((select public.can_access_app()) and user_id = (select auth.uid()));

drop policy if exists activity_log_insert_own on public.activity_log;
create policy activity_log_insert_own
  on public.activity_log for insert
  to authenticated
  with check ((select public.can_access_app()) and user_id = (select auth.uid()));

drop policy if exists google_tokens_own_active_member on public.google_oauth_tokens;
create policy google_tokens_own_active_member
  on public.google_oauth_tokens for all
  to authenticated
  using ((select public.can_access_app()) and user_id = (select auth.uid()))
  with check ((select public.can_access_app()) and user_id = (select auth.uid()));

-- Foreign-key indexes used by joins, timelines and cascading deletes.
create index if not exists activity_log_client_id_idx on public.activity_log (client_id);
create index if not exists activity_log_task_id_idx on public.activity_log (task_id);
create index if not exists activity_log_user_id_idx on public.activity_log (user_id);
create index if not exists client_files_uploaded_by_idx on public.client_files (uploaded_by);
create index if not exists client_notes_history_author_id_idx on public.client_notes_history (author_id);
create index if not exists clients_created_by_idx on public.clients (created_by);
create index if not exists meetings_created_by_idx on public.meetings (created_by);
create index if not exists tasks_created_by_idx on public.tasks (created_by);
create index if not exists tasks_source_meeting_id_idx on public.tasks (source_meeting_id);
