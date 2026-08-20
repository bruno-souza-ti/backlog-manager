-- Task comments: the one form of "context" a task had no way to carry
-- before — every discussion about a task had to happen by rewriting its
-- description. Team-wide visibility (same model as activity_log and
-- client_notes_history: any active member sees everything), delete
-- restricted to the comment's own author or an admin. No edit in this pass.

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (length(trim(content)) > 0 and length(content) <= 4000),
  created_at timestamptz not null default now()
);

create index if not exists task_comments_task_id_idx on public.task_comments (task_id, created_at);
create index if not exists task_comments_author_id_idx on public.task_comments (author_id);

alter table public.task_comments enable row level security;
alter table public.task_comments force row level security;

revoke all on table public.task_comments from public, anon;
grant select, insert, delete on table public.task_comments to authenticated;

create policy task_comments_select_active_members
  on public.task_comments for select to authenticated
  using ((select public.can_access_app()));

create policy task_comments_insert_active_members
  on public.task_comments for insert to authenticated
  with check (
    (select public.can_access_app())
    and author_id = (select auth.uid())
  );

create policy task_comments_delete_author_or_admin
  on public.task_comments for delete to authenticated
  using (
    (select public.can_access_app())
    and (author_id = (select auth.uid()) or (select public.has_admin_role()))
  );

-- Same "frozen/cancelled clients are read-only" rule already enforced on
-- tasks/notes/files, resolved here through the task's client_id since
-- task_comments has no client_id column of its own.
create or replace function public.check_task_comment_client_not_frozen()
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
      raise exception 'O cliente está cancelado. Restaure-o antes de comentar nas tarefas.'
        using errcode = '55000';
    end if;

    if client_status = 'frozen' then
      raise exception 'O cliente está congelado. Descongele-o antes de comentar nas tarefas.'
        using errcode = '55000';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.check_task_comment_client_not_frozen() from public, anon, authenticated;

drop trigger if exists task_comments_block_frozen_client on public.task_comments;
create trigger task_comments_block_frozen_client
  before insert or delete on public.task_comments
  for each row execute function public.check_task_comment_client_not_frozen();

alter publication supabase_realtime add table public.task_comments;
