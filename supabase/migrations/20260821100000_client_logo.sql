-- Clients could not be renamed after creation, and the only visual identity
-- was a decorative color gradient — no way to upload a real logo. Any
-- active member can already edit a client's name/logo_color (see
-- clients_update_active_members in 20260810174343_harden_rbac_and_client_lifecycle.sql),
-- so logo_url follows the exact same access model: no new RLS policy
-- needed, just extending the existing column grant.

alter table public.clients add column logo_url text;

grant update (name, logo_color, logo_url, notes) on table public.clients to authenticated;

-- Unlike avatars, a client has no single owning user — any active member
-- who can already rename a client can also change its logo, so this bucket
-- is gated on can_access_app() rather than a folder-owner check.
insert into storage.buckets (id, name, public)
values ('client-logos', 'client-logos', true)
on conflict (id) do nothing;

drop policy if exists client_logos_public_read on storage.objects;
create policy client_logos_public_read
  on storage.objects for select
  using (bucket_id = 'client-logos');

drop policy if exists client_logos_active_members_write on storage.objects;
create policy client_logos_active_members_write
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'client-logos'
    and (select public.can_access_app())
  );

drop policy if exists client_logos_active_members_update on storage.objects;
create policy client_logos_active_members_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'client-logos'
    and (select public.can_access_app())
  );

drop policy if exists client_logos_active_members_delete on storage.objects;
create policy client_logos_active_members_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'client-logos'
    and (select public.can_access_app())
  );
