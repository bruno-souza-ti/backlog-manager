-- Time tracking, tied to real tasks — the team's boss started requiring a
-- separate Google Sheet for daily activity + time logging, where the day's
-- total must match contracted hours. This pulls that into the app instead,
-- deliberately more traceable than a spreadsheet: every entry is tied to a
-- real existing task, never freeform text. v1 scope: always logs against
-- today (no backdating, no personal history browser) — the ask is "does
-- today add up," not a full timesheet archive.

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  minutes integer not null check (minutes > 0 and minutes <= 1440),
  note text not null default '' check (length(note) <= 2000),
  entry_date date not null default (current_date),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index time_entries_user_date_idx on public.time_entries (user_id, entry_date);
create index time_entries_task_id_idx on public.time_entries (task_id);

alter table public.time_entries enable row level security;
alter table public.time_entries force row level security;

revoke all on table public.time_entries from public, anon;
grant select, insert, update, delete on table public.time_entries to authenticated;

-- Team-wide read (same as task_comments/tasks) — required so TeamDashboard
-- can show "horas hoje" for every teammate, not just yourself.
create policy time_entries_select_active_members
  on public.time_entries for select to authenticated
  using ((select public.can_access_app()));

create policy time_entries_insert_self
  on public.time_entries for insert to authenticated
  with check (
    (select public.can_access_app())
    and user_id = (select auth.uid())
  );

-- Self-only, deliberately NOT admin-overridable (unlike task_comments'
-- delete-author-or-admin) — letting anyone but the owner edit logged hours
-- would undermine the one property that actually matters: the day's total
-- has to be something the person themself vouches for.
create policy time_entries_update_self
  on public.time_entries for update to authenticated
  using (
    (select public.can_access_app())
    and user_id = (select auth.uid())
  )
  with check (
    (select public.can_access_app())
    and user_id = (select auth.uid())
  );

create policy time_entries_delete_self
  on public.time_entries for delete to authenticated
  using (
    (select public.can_access_app())
    and user_id = (select auth.uid())
  );

-- Same "frozen/cancelled clients are read-only" rule already enforced on
-- tasks/notes/files/comments, resolved here through the entry's task_id
-- since time_entries has no client_id column of its own. Unlike
-- task_comments, entries are editable, so this also guards UPDATE.
create or replace function public.check_time_entry_client_not_frozen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_task_id uuid := case when tg_op = 'DELETE' then old.task_id else new.task_id end;
  target_client_id uuid;
  client_status text;
  client_deleted_at timestamptz;
begin
  select t.client_id into target_client_id
    from public.tasks t
   where t.id = target_task_id;

  if target_client_id is not null then
    select status, deleted_at into client_status, client_deleted_at
      from public.clients
     where id = target_client_id;

    if client_deleted_at is not null then
      raise exception 'O cliente está cancelado. Restaure-o antes de registrar tempo nas tarefas.'
        using errcode = '55000';
    end if;

    if client_status = 'frozen' then
      raise exception 'O cliente está congelado. Descongele-o antes de registrar tempo nas tarefas.'
        using errcode = '55000';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.check_time_entry_client_not_frozen() from public, anon, authenticated;

drop trigger if exists time_entries_block_frozen_client on public.time_entries;
create trigger time_entries_block_frozen_client
  before insert or update or delete on public.time_entries
  for each row execute function public.check_time_entry_client_not_frozen();

alter publication supabase_realtime add table public.time_entries;
