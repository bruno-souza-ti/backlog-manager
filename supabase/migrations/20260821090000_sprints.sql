-- Sprints: the team had no time-boxed iteration concept at all — tasks only
-- carried a deadline/urgency/column. Sprints are global/team-wide (one
-- sprint can hold tasks from any client plus Backlog Geral, matching how
-- the team actually works across several clients in the same week) and
-- created manually (no fixed recurring cadence in v1). A task's sprint
-- membership is optional — un-sprinted tasks keep working exactly as today.

create table public.sprints (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  goal text,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.sprints enable row level security;
alter table public.sprints force row level security;

revoke all on table public.sprints from public, anon;
grant select, insert, update, delete on table public.sprints to authenticated;

create policy sprints_select_active_members
  on public.sprints for select to authenticated
  using ((select public.can_access_app()));

create policy sprints_insert_admins
  on public.sprints for insert to authenticated
  with check ((select public.has_admin_role()));

create policy sprints_update_admins
  on public.sprints for update to authenticated
  using ((select public.has_admin_role()))
  with check ((select public.has_admin_role()));

create policy sprints_delete_admins
  on public.sprints for delete to authenticated
  using ((select public.has_admin_role()));

-- A sprint being edited/deleted never deletes its tasks — it just
-- un-sprints them, same "nothing is destructively removed" rule already
-- used for Kanban done-archiving and note history.
alter table public.tasks add column sprint_id uuid references public.sprints(id) on delete set null;
create index tasks_sprint_id_idx on public.tasks (sprint_id);

-- No new trigger/RPC needed for this column: tasks_update_active_members
-- already lets any active member UPDATE any task column via plain RLS, and
-- tasks_block_frozen_client already runs BEFORE INSERT OR UPDATE OR DELETE
-- on the whole row (reading new.client_id unconditionally), so writing
-- sprint_id on a task inherits the frozen/cancelled-client block for free.

alter publication supabase_realtime add table public.sprints;
