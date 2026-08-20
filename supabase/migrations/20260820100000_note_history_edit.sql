-- Lets a note already archived in client_notes_history be edited in place.
-- Deleting one was already possible (client_notes_delete_author_or_admin
-- exists since harden_operational_writes); editing wasn't, and UPDATE on
-- this table is deliberately revoked from `authenticated` at the grant
-- level, so it has to go through a SECURITY DEFINER RPC — same shape as
-- archive_client_notes/deposit_client_notes. The existing
-- notes_block_frozen_client trigger (BEFORE INSERT OR UPDATE OR DELETE)
-- already covers this table, so a frozen/cancelled client's notes stay
-- read-only without any extra check here.

alter table public.client_notes_history
  add column if not exists updated_at timestamptz;

create or replace function public.update_client_note(
  p_note_id uuid,
  p_content text
)
returns table(id uuid, created_at timestamptz, updated_at timestamptz, content text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.client_notes_history%rowtype;
begin
  if auth.uid() is null or not public.can_access_app() then
    raise exception 'User is not authorized to access the application' using errcode = '42501';
  end if;
  if p_content is null or length(trim(p_content)) = 0 then
    raise exception 'A anotação está vazia.' using errcode = '22023';
  end if;

  select * into existing
    from public.client_notes_history
   where public.client_notes_history.id = p_note_id
   for update;

  if not found then
    raise exception 'Anotação não encontrada.' using errcode = 'P0002';
  end if;

  if existing.author_id is distinct from auth.uid() and not public.has_admin_role() then
    raise exception 'Você não tem permissão para editar esta anotação.' using errcode = '42501';
  end if;

  update public.client_notes_history
     set content = p_content,
         updated_at = now()
   where public.client_notes_history.id = p_note_id
   returning * into existing;

  return query select existing.id, existing.created_at, existing.updated_at, existing.content;
end;
$$;

revoke all on function public.update_client_note(uuid, text) from public, anon;
grant execute on function public.update_client_note(uuid, text) to authenticated;
