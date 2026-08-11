-- Round 2: Backlog Geral (tasks with no client), realtime presence, and an
-- activity feed. Also walks back the P1-P3 priority / tags / request_origin
-- fields added in the previous migration — the support flow here is
-- intentionally informal (WhatsApp-based), so those "ticket formalization"
-- fields were dropped from the app and are dropped here too.

-- 1. Backlog Geral: client_id must accept NULL (idempotent even if the
--    previous migration already applied this).
alter table public.tasks
  alter column client_id drop not null;

-- Drop the now-unused support-ticket-flavored columns and their constraints.
alter table public.tasks drop constraint if exists tasks_priority_check;
alter table public.tasks drop constraint if exists tasks_request_origin_check;
alter table public.tasks drop column if exists priority;
alter table public.tasks drop column if exists tags;
alter table public.tasks drop column if exists request_origin;

-- Tracks when a task last changed column, so "Agora na Equipe" can show the
-- most recently moved-to-"Fazendo" task per person.
alter table public.tasks
  add column if not exists column_changed_at timestamptz not null default now();

-- 2. Presence: profiles.status_updated_at should already exist per product
--    context, but this is a safe no-op if so.
alter table public.profiles
  add column if not exists status_updated_at timestamptz not null default now();

-- 3. Activity feed
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action_type text not null,
  description text not null,
  client_id uuid references public.clients(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.activity_log enable row level security;

drop policy if exists "Authenticated users can read activity log" on public.activity_log;
create policy "Authenticated users can read activity log"
  on public.activity_log for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert their own activity" on public.activity_log;
create policy "Authenticated users can insert their own activity"
  on public.activity_log for insert
  to authenticated
  with check (auth.uid() = user_id);

-- 4. Make sure Realtime actually broadcasts changes for the tables the app
--    subscribes to. Supabase only streams postgres_changes for tables
--    explicitly added to the supabase_realtime publication.
do $$
begin
  begin
    alter publication supabase_realtime add table public.profiles;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.tasks;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.activity_log;
  exception when duplicate_object then null;
  end;
end $$;
