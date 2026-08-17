-- Tighten browser write permissions and make note archiving atomic.
-- This migration is intentionally not applied automatically to production.

revoke truncate, references, trigger on table public.tasks from authenticated;
revoke truncate, references, trigger on table public.client_files from authenticated;
revoke truncate, references, trigger on table public.client_notes_history from authenticated;
revoke update on table public.client_files from authenticated;
revoke update on table public.client_notes_history from authenticated;

drop policy if exists tasks_active_members on public.tasks;
create policy tasks_select_active_members
  on public.tasks for select to authenticated
  using ((select public.can_access_app()));
create policy tasks_insert_active_members
  on public.tasks for insert to authenticated
  with check (
    (select public.can_access_app())
    and created_by = (select auth.uid())
  );
create policy tasks_update_active_members
  on public.tasks for update to authenticated
  using ((select public.can_access_app()))
  with check ((select public.can_access_app()));
create policy tasks_delete_owner_assignee_or_admin
  on public.tasks for delete to authenticated
  using (
    (select public.can_access_app())
    and (
      created_by = (select auth.uid())
      or assignee_id = (select auth.uid())
      or (select public.has_admin_role())
    )
  );

drop policy if exists client_files_active_members on public.client_files;
create policy client_files_select_active_members
  on public.client_files for select to authenticated
  using ((select public.can_access_app()));
create policy client_files_insert_active_members
  on public.client_files for insert to authenticated
  with check (
    (select public.can_access_app())
    and uploaded_by = (select auth.uid())
  );
create policy client_files_delete_owner_or_admin
  on public.client_files for delete to authenticated
  using (
    (select public.can_access_app())
    and (uploaded_by = (select auth.uid()) or (select public.has_admin_role()))
  );

drop policy if exists client_notes_active_members on public.client_notes_history;
create policy client_notes_select_active_members
  on public.client_notes_history for select to authenticated
  using ((select public.can_access_app()));
create policy client_notes_insert_active_members
  on public.client_notes_history for insert to authenticated
  with check (
    (select public.can_access_app())
    and author_id = (select auth.uid())
  );
create policy client_notes_delete_author_or_admin
  on public.client_notes_history for delete to authenticated
  using (
    (select public.can_access_app())
    and (author_id = (select auth.uid()) or (select public.has_admin_role()))
  );

-- OAuth refresh/access tokens are server-side secrets. The application uses
-- Supabase Auth's provider token and has no browser query for this table.
drop policy if exists google_tokens_own_active_member on public.google_oauth_tokens;
revoke all on table public.google_oauth_tokens from public, anon, authenticated;

create or replace function public.archive_client_notes(p_client_id uuid, p_content text)
returns table(id uuid, created_at timestamptz, content text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  archived public.client_notes_history%rowtype;
begin
  if auth.uid() is null or not public.can_access_app() then
    raise exception 'User is not authorized to access the application' using errcode = '42501';
  end if;
  if p_content is null or length(trim(p_content)) = 0 then
    raise exception 'A anotação está vazia.' using errcode = '22023';
  end if;

  perform 1 from public.clients where public.clients.id = p_client_id for update;
  if not found then
    raise exception 'Cliente não encontrado.' using errcode = 'P0002';
  end if;

  insert into public.client_notes_history (client_id, content, author_id)
  values (p_client_id, p_content, auth.uid())
  returning * into archived;

  update public.clients set notes = '' where public.clients.id = p_client_id;

  return query select archived.id, archived.created_at, archived.content;
end;
$$;

revoke all on function public.archive_client_notes(uuid, text) from public, anon;
grant execute on function public.archive_client_notes(uuid, text) to authenticated;

create or replace function public.deposit_client_notes(p_client_id uuid, p_content text)
returns table(id uuid, created_at timestamptz, content text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  deposited public.client_notes_history%rowtype;
begin
  if auth.uid() is null or not public.can_access_app() then
    raise exception 'User is not authorized to access the application' using errcode = '42501';
  end if;
  if p_content is null or length(trim(p_content)) = 0 then
    raise exception 'A anotação está vazia.' using errcode = '22023';
  end if;

  update public.clients set notes = p_content where public.clients.id = p_client_id;
  if not found then raise exception 'Cliente não encontrado.' using errcode = 'P0002'; end if;

  insert into public.client_notes_history (client_id, content, author_id)
  values (p_client_id, p_content, auth.uid())
  returning * into deposited;

  return query select deposited.id, deposited.created_at, deposited.content;
end;
$$;

revoke all on function public.deposit_client_notes(uuid, text) from public, anon;
grant execute on function public.deposit_client_notes(uuid, text) to authenticated;

create or replace function public.log_task_urgency_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := coalesce(auth.uid(), new.created_by);
  actor_name text;
  urgency_label text;
begin
  if new.urgency is not distinct from old.urgency then return new; end if;
  actor_name := public.activity_actor_name(actor_id);
  urgency_label := coalesce(new.urgency, 'Automática pelo prazo');
  insert into public.activity_log (user_id, action_type, description, client_id, task_id, event_key)
  values (
    actor_id,
    'task_updated',
    actor_name || ' alterou a urgência de "' || new.title || '" para ' || urgency_label,
    new.client_id,
    new.id,
    'task:urgency:' || new.id || ':' || new.updated_at::text
  ) on conflict do nothing;
  return new;
end;
$$;

revoke all on function public.log_task_urgency_activity() from public, anon, authenticated;
drop trigger if exists tasks_urgency_activity_trigger on public.tasks;
create trigger tasks_urgency_activity_trigger
after update of urgency on public.tasks
for each row execute function public.log_task_urgency_activity();
