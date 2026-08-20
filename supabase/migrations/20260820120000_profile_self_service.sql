-- Lets a user edit their own display name and upload/change a profile
-- photo. UPDATE on profiles is revoked from `authenticated` (see
-- admin_user_invitations), so self-editing goes through a SECURITY DEFINER
-- RPC — same shape as heartbeat/update_my_presence.

alter table public.profiles
  add column if not exists avatar_url text;

create or replace function public.update_own_profile(
  p_full_name text,
  p_avatar_url text
)
returns table(full_name text, avatar_url text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.can_access_app() then
    raise exception 'User is not authorized to access the application' using errcode = '42501';
  end if;
  if p_full_name is null or length(trim(p_full_name)) = 0 then
    raise exception 'O nome não pode ficar vazio.' using errcode = '22023';
  end if;
  if length(p_full_name) > 120 then
    raise exception 'O nome é longo demais.' using errcode = '22023';
  end if;

  update public.profiles
     set full_name = trim(p_full_name),
         avatar_url = p_avatar_url,
         updated_at = now()
   where id = auth.uid();

  if not found then
    raise exception 'Perfil não encontrado.' using errcode = 'P0002';
  end if;

  return query select trim(p_full_name), p_avatar_url;
end;
$$;

revoke all on function public.update_own_profile(text, text) from public, anon;
grant execute on function public.update_own_profile(text, text) to authenticated;

-- Avatar storage: one public-read bucket; writes restricted to the
-- caller's own folder ({auth.uid()}/filename), so nobody can overwrite or
-- read-write another user's avatar path directly against Storage.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists avatars_owner_write on storage.objects;
create policy avatars_owner_write
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

drop policy if exists avatars_owner_update on storage.objects;
create policy avatars_owner_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

drop policy if exists avatars_owner_delete on storage.objects;
create policy avatars_owner_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );
