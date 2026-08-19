-- Consolidates client lifecycle from four states (active/inactive/frozen +
-- soft-delete) down to three business-meaningful ones: Ativo, Congelado,
-- Cancelado. "Inativo" is dropped as a standalone status — existing
-- standalone-inactive clients migrate to "active" per product decision.
-- Soft-deleted ("Cancelado") clients keep whatever status they had before
-- deletion instead of being force-set to 'inactive'; getClientLifecycleKey
-- already treats deleted_at as authoritative over status, so this only
-- matters for what a restored client looks like afterwards.

-- 1. Data migration: fold every remaining 'inactive' row into 'active',
--    including legacy soft-deleted rows that the old set_client_lifecycle
--    forced to 'inactive' on delete.
update public.clients
   set status = 'active'
 where status = 'inactive';

-- 2. Tighten the check constraint now that 'inactive' is no longer a valid
--    status value going forward.
alter table public.clients
  drop constraint if exists clients_status_check;

alter table public.clients
  add constraint clients_status_check
  check (status in ('active', 'frozen'));

-- 3. Redefine the lifecycle RPC: reject 'inactive' as a directly selectable
--    action, and stop overwriting status on delete/restore.
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

  if p_action not in ('active', 'frozen', 'deleted', 'restore') then
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
    next_status := current_client.status;
    next_deleted_at := coalesce(current_client.deleted_at, now());
    action_label := 'cancelou o cliente';
  elsif p_action = 'restore' then
    next_status := current_client.status;
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
