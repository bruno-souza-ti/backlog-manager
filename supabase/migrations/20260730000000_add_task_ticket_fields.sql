-- Adds support for internal tickets/tasks without a linked client, manual strategic
-- priority (independent from the deadline-based computed urgency), free-form tags,
-- request origin, and a new "blocked" Kanban status.

alter table public.tasks
  alter column client_id drop not null;

alter table public.tasks
  add column if not exists priority text,
  add column if not exists tags text[] default '{}'::text[],
  add column if not exists request_origin text,
  add column if not exists completed_at timestamptz;

alter table public.tasks
  add constraint tasks_priority_check check (priority is null or priority in ('P1', 'P2', 'P3'));

alter table public.tasks
  add constraint tasks_request_origin_check check (
    request_origin is null or request_origin in ('email', 'whatsapp', 'ligacao', 'interno', 'outro')
  );

-- Replace the existing "column" status check constraint (whatever its name is)
-- with one that also allows 'blocked'.
do $$
declare
  existing_constraint text;
begin
  select con.conname into existing_constraint
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
  where rel.relname = 'tasks'
    and con.contype = 'c'
    and att.attname = 'column';

  if existing_constraint is not null then
    execute format('alter table public.tasks drop constraint %I', existing_constraint);
  end if;
end $$;

alter table public.tasks
  add constraint tasks_column_check check ("column" in ('todo', 'doing', 'blocked', 'done'));
