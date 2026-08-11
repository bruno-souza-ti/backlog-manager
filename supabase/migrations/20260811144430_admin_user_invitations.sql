-- Server-side team administration for the invite-only access model.
-- The browser keeps read-only access to profiles. Every privileged mutation
-- goes through the Express API using the Supabase secret/service-role key,
-- then reaches one of the service-role-only RPCs below.

alter table public.profiles
  add column if not exists invited_at timestamptz,
  add column if not exists invited_by uuid,
  add column if not exists access_updated_at timestamptz,
  add column if not exists access_updated_by uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_invited_by_fkey'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_invited_by_fkey
      foreign key (invited_by) references public.profiles(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_access_updated_by_fkey'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_access_updated_by_fkey
      foreign key (access_updated_by) references public.profiles(id) on delete set null;
  end if;
end $$;

create index if not exists profiles_invited_by_idx on public.profiles (invited_by);
create index if not exists profiles_access_updated_by_idx on public.profiles (access_updated_by);

-- Generic profile writes would let an admin bypass owner/last-owner rules by
-- calling PostgREST directly. Presence remains available only through the
-- existing update_my_presence() RPC.
revoke insert, update, delete on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
drop policy if exists profiles_admin_update_others on public.profiles;

create or replace function public.register_team_invitation(
  p_actor_id uuid,
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_role text,
  p_event_key text,
  p_is_resend boolean default false
)
returns setof public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile public.profiles%rowtype;
  target_profile public.profiles%rowtype;
  normalized_email text := lower(trim(p_email));
  normalized_name text := trim(p_full_name);
  audit_key text := 'team-admin:' || trim(p_event_key);
begin
  select * into actor_profile
  from public.profiles
  where id = p_actor_id
    and is_active = true
    and role in ('owner', 'admin');

  if not found then
    raise exception 'Solicitante sem permissao administrativa ativa.' using errcode = '42501';
  end if;

  if p_user_id is null or normalized_email = '' or normalized_name = '' then
    raise exception 'Dados do convite invalidos.' using errcode = '22023';
  end if;

  if p_role not in ('owner', 'admin', 'member') then
    raise exception 'Papel invalido.' using errcode = '22023';
  end if;

  if actor_profile.role = 'admin' and p_role = 'owner' then
    raise exception 'Administradores nao podem atribuir o papel owner.' using errcode = '42501';
  end if;

  if p_event_key is null or length(trim(p_event_key)) < 8 then
    raise exception 'Identificador idempotente invalido.' using errcode = '22023';
  end if;

  select * into target_profile
  from public.profiles
  where id = p_user_id
  for update;

  if found and target_profile.role = 'owner' and actor_profile.role <> 'owner' then
    raise exception 'Somente owners podem gerenciar outros owners.' using errcode = '42501';
  end if;

  insert into public.profiles (
    id,
    full_name,
    email,
    role,
    is_active,
    invited_at,
    invited_by,
    access_updated_at,
    access_updated_by
  ) values (
    p_user_id,
    normalized_name,
    normalized_email,
    p_role,
    true,
    now(),
    p_actor_id,
    now(),
    p_actor_id
  )
  on conflict (id) do update
  set full_name = excluded.full_name,
      email = excluded.email,
      role = excluded.role,
      is_active = true,
      invited_at = excluded.invited_at,
      invited_by = coalesce(public.profiles.invited_by, excluded.invited_by),
      access_updated_at = excluded.access_updated_at,
      access_updated_by = excluded.access_updated_by,
      updated_at = now();

  insert into public.activity_log (
    user_id,
    action_type,
    description,
    event_key
  ) values (
    p_actor_id,
    case when p_is_resend then 'team_invite_resent' else 'team_invited' end,
    public.activity_actor_name(p_actor_id)
      || case when p_is_resend then ' reenviou o convite para ' else ' convidou ' end
      || normalized_name || ' (' || normalized_email || ') como ' || p_role,
    audit_key
  )
  on conflict (event_key) where event_key is not null do nothing;

  return query
  select p.* from public.profiles p where p.id = p_user_id;
end;
$$;

create or replace function public.manage_team_member(
  p_actor_id uuid,
  p_target_id uuid,
  p_action text,
  p_role text,
  p_event_key text
)
returns setof public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile public.profiles%rowtype;
  target_profile public.profiles%rowtype;
  next_role text;
  next_active boolean;
  action_type text;
  action_description text;
  audit_key text := 'team-admin:' || trim(p_event_key);
  active_owner_count integer;
begin
  select * into actor_profile
  from public.profiles
  where id = p_actor_id
    and is_active = true
    and role in ('owner', 'admin');

  if not found then
    raise exception 'Solicitante sem permissao administrativa ativa.' using errcode = '42501';
  end if;

  if p_actor_id = p_target_id then
    raise exception 'Nao e permitido alterar o proprio acesso.' using errcode = '42501';
  end if;

  if p_event_key is null or length(trim(p_event_key)) < 8 then
    raise exception 'Identificador idempotente invalido.' using errcode = '22023';
  end if;

  if p_action not in ('role', 'activate', 'deactivate') then
    raise exception 'Acao administrativa invalida.' using errcode = '22023';
  end if;

  select * into target_profile
  from public.profiles
  where id = p_target_id
  for update;

  if not found then
    raise exception 'Integrante nao encontrado.' using errcode = 'P0002';
  end if;

  if actor_profile.role = 'admin'
     and (target_profile.role = 'owner' or p_role = 'owner') then
    raise exception 'Somente owners podem gerenciar outros owners.' using errcode = '42501';
  end if;

  next_role := target_profile.role;
  next_active := target_profile.is_active;

  if p_action = 'role' then
    if p_role not in ('owner', 'admin', 'member') then
      raise exception 'Papel invalido.' using errcode = '22023';
    end if;
    next_role := p_role;
    action_type := 'team_role_changed';
    action_description := ' alterou o papel de ' || target_profile.full_name
      || ' de ' || target_profile.role || ' para ' || next_role;
  elsif p_action = 'activate' then
    next_active := true;
    action_type := 'team_access_activated';
    action_description := ' reativou o acesso de ' || target_profile.full_name;
  else
    next_active := false;
    action_type := 'team_access_deactivated';
    action_description := ' desativou o acesso de ' || target_profile.full_name;
  end if;

  if target_profile.role = 'owner'
     and target_profile.is_active = true
     and (next_role <> 'owner' or next_active = false) then
    select count(*) into active_owner_count
    from public.profiles
    where role = 'owner' and is_active = true;

    if active_owner_count <= 1 then
      raise exception 'O ultimo owner ativo nao pode ser removido, rebaixado ou desativado.'
        using errcode = '23514';
    end if;
  end if;

  if target_profile.role is not distinct from next_role
     and target_profile.is_active is not distinct from next_active then
    return query select p.* from public.profiles p where p.id = p_target_id;
    return;
  end if;

  update public.profiles
  set role = next_role,
      is_active = next_active,
      access_updated_at = now(),
      access_updated_by = p_actor_id,
      updated_at = now()
  where id = p_target_id;

  insert into public.activity_log (
    user_id,
    action_type,
    description,
    event_key
  ) values (
    p_actor_id,
    action_type,
    public.activity_actor_name(p_actor_id) || action_description,
    audit_key
  )
  on conflict (event_key) where event_key is not null do nothing;

  return query select p.* from public.profiles p where p.id = p_target_id;
end;
$$;

revoke all on function public.register_team_invitation(uuid, uuid, text, text, text, text, boolean)
  from public, anon, authenticated;
revoke all on function public.manage_team_member(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.register_team_invitation(uuid, uuid, text, text, text, text, boolean)
  to service_role;
grant execute on function public.manage_team_member(uuid, uuid, text, text, text)
  to service_role;

comment on function public.register_team_invitation(uuid, uuid, text, text, text, text, boolean) is
  'Service-role-only atomic profile activation and invite audit.';
comment on function public.manage_team_member(uuid, uuid, text, text, text) is
  'Service-role-only role/activation mutation with owner invariants and audit.';
