-- Reliable operational history and persisted client-health transitions.
-- Events derived from database mutations are written by triggers in the same
-- transaction as the business operation. event_key makes every derived event
-- idempotent, including retried requests.

alter table public.activity_log
  add column if not exists event_key text;

create unique index if not exists activity_log_event_key_uidx
  on public.activity_log (event_key)
  where event_key is not null;

create table if not exists public.client_health_state (
  client_id uuid primary key references public.clients(id) on delete cascade,
  level text not null check (level in ('stable', 'warning', 'critical')),
  score integer not null default 0,
  reasons jsonb not null default '[]'::jsonb,
  version bigint not null default 1,
  evaluated_at timestamptz not null default now()
);

alter table public.client_health_state enable row level security;

drop policy if exists "Authenticated users can read client health" on public.client_health_state;
create policy "Authenticated users can read client health"
  on public.client_health_state for select
  to authenticated
  using (true);

create or replace function public.activity_actor_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select nullif(trim(full_name), '') from public.profiles where id = p_user_id),
    'Sistema'
  );
$$;

create or replace function public.activity_client_context(p_client_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when p_client_id is null then ' (Backlog Geral)'
    else coalesce(
      (select ' (' || name || ')' from public.clients where id = p_client_id),
      ''
    )
  end;
$$;

create or replace function public.calculate_client_health(p_client_id uuid)
returns table(level text, score integer, reasons jsonb)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_score integer := 0;
  v_reasons jsonb := '[]'::jsonb;
  v_count integer;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_last_activity timestamptz;
  v_idle_days integer;
  v_last_meeting timestamptz;
begin
  select count(*) into v_count
  from public.tasks
  where client_id = p_client_id
    and "column" <> 'done'
    and nullif(deadline::text, '')::date < v_today;

  if v_count > 0 then
    v_score := v_score + least(v_count, 3) * 25;
    v_reasons := v_reasons || jsonb_build_array(
      v_count || case when v_count = 1 then ' tarefa atrasada' else ' tarefas atrasadas' end
    );
  end if;

  select count(*) into v_count
  from public.tasks
  where client_id = p_client_id and "column" = 'blocked';

  if v_count > 0 then
    v_score := v_score + least(v_count, 3) * 15;
    v_reasons := v_reasons || jsonb_build_array(
      v_count || case when v_count = 1 then ' tarefa bloqueada' else ' tarefas bloqueadas' end
    );
  end if;

  select max(coalesce(column_changed_at, created_at)) into v_last_activity
  from public.tasks
  where client_id = p_client_id;

  if exists (
    select 1 from public.tasks where client_id = p_client_id and "column" <> 'done'
  ) and v_last_activity is not null then
    v_idle_days := v_today - (v_last_activity at time zone 'America/Sao_Paulo')::date;
    if v_idle_days >= 30 then
      v_score := v_score + 35;
      v_reasons := v_reasons || jsonb_build_array('Sem movimentação há ' || v_idle_days || ' dias');
    elsif v_idle_days >= 14 then
      v_score := v_score + 20;
      v_reasons := v_reasons || jsonb_build_array('Sem movimentação há ' || v_idle_days || ' dias');
    end if;
  end if;

  select count(*) into v_count
  from public.tasks
  where client_id = p_client_id
    and "column" <> 'done'
    and nullif(deadline::text, '')::date = v_today;

  if v_count > 0 then
    v_score := v_score + least(v_count, 3) * 12;
    v_reasons := v_reasons || jsonb_build_array(
      v_count || case when v_count = 1 then ' tarefa vencendo hoje' else ' tarefas vencendo hoje' end
    );
  else
    select count(*) into v_count
    from public.tasks
    where client_id = p_client_id
      and "column" <> 'done'
      and nullif(deadline::text, '')::date > v_today
      and nullif(deadline::text, '')::date <= v_today + 3;

    if v_count > 0 then
      v_score := v_score + least(v_count, 3) * 6;
      v_reasons := v_reasons || jsonb_build_array(
        v_count || case when v_count = 1 then ' tarefa com prazo próximo' else ' tarefas com prazo próximo' end
      );
    end if;
  end if;

  select count(*) into v_count
  from public.activity_log
  where client_id = p_client_id
    and action_type = 'task_moved'
    and created_at >= now() - interval '14 days';

  if v_count >= 6 then
    v_score := v_score + 15;
    v_reasons := v_reasons || jsonb_build_array(v_count || ' alterações de status nos últimos 14 dias');
  end if;

  select max(occurred_at) into v_last_meeting
  from public.meetings
  where client_id = p_client_id;

  if v_last_meeting is not null then
    v_idle_days := v_today - (v_last_meeting at time zone 'America/Sao_Paulo')::date;
    if v_idle_days >= 30 then
      v_score := v_score + 10;
      v_reasons := v_reasons || jsonb_build_array('Sem reunião há ' || v_idle_days || ' dias');
    end if;
  end if;

  if jsonb_array_length(v_reasons) = 0 then
    v_reasons := jsonb_build_array('Nenhum sinal de risco identificado');
  end if;

  return query select
    case when v_score >= 50 then 'critical'
         when v_score >= 20 then 'warning'
         else 'stable' end,
    v_score,
    v_reasons;
end;
$$;

create or replace function public.refresh_client_health(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_previous public.client_health_state%rowtype;
  v_level text;
  v_score integer;
  v_reasons jsonb;
  v_version bigint;
  v_client_name text;
  v_label text;
begin
  if p_client_id is null or not exists (select 1 from public.clients where id = p_client_id) then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_client_id::text, 0));

  select * into v_previous
  from public.client_health_state
  where client_id = p_client_id
  for update;

  select calculated.level, calculated.score, calculated.reasons
    into v_level, v_score, v_reasons
  from public.calculate_client_health(p_client_id) calculated;

  v_version := coalesce(v_previous.version, 0) + 1;

  insert into public.client_health_state (client_id, level, score, reasons, version, evaluated_at)
  values (p_client_id, v_level, v_score, v_reasons, v_version, now())
  on conflict (client_id) do update set
    level = excluded.level,
    score = excluded.score,
    reasons = excluded.reasons,
    version = excluded.version,
    evaluated_at = excluded.evaluated_at;

  if v_previous.client_id is not null
     and (case v_level when 'critical' then 2 when 'warning' then 1 else 0 end)
       > (case v_previous.level when 'critical' then 2 when 'warning' then 1 else 0 end) then
    select name into v_client_name from public.clients where id = p_client_id;
    v_label := case v_level when 'critical' then 'Crítico' else 'Atenção' end;

    insert into public.activity_log (
      user_id, action_type, description, client_id, event_key
    ) values (
      auth.uid(),
      'client_at_risk',
      'Projeto ' || v_client_name || ' entrou em risco (' || v_label || ')',
      p_client_id,
      'client-health:' || p_client_id || ':' || v_version
    )
    on conflict do nothing;
  end if;
end;
$$;

create or replace function public.refresh_all_client_health()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_client_id uuid;
begin
  for v_client_id in select id from public.clients loop
    perform public.refresh_client_health(v_client_id);
  end loop;
end;
$$;

create or replace function public.log_task_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_actor text;
  v_context text;
  v_action text;
  v_description text;
begin
  if tg_op = 'DELETE' then
    v_user_id := coalesce(auth.uid(), old.created_by);
  else
    v_user_id := coalesce(auth.uid(), new.created_by);
  end if;

  if tg_op = 'INSERT' then
    v_actor := public.activity_actor_name(v_user_id);
    v_context := public.activity_client_context(new.client_id);
    insert into public.activity_log (user_id, action_type, description, client_id, task_id, event_key)
    values (v_user_id, 'task_created', v_actor || ' criou a tarefa "' || new.title || '"' || v_context,
            new.client_id, new.id, 'task:created:' || new.id)
    on conflict do nothing;
    perform public.refresh_client_health(new.client_id);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new."column" is distinct from old."column" then
      v_actor := public.activity_actor_name(v_user_id);
      v_context := public.activity_client_context(new.client_id);
      v_action := case when new."column" = 'done' then 'task_completed' else 'task_moved' end;
      v_description := case
        when new."column" = 'done' then v_actor || ' concluiu a tarefa "' || new.title || '"' || v_context
        else v_actor || ' moveu "' || new.title || '" para ' ||
          case new."column" when 'todo' then 'A Fazer' when 'doing' then 'Fazendo'
                          when 'blocked' then 'Bloqueado' else new."column" end || v_context
      end;
      insert into public.activity_log (user_id, action_type, description, client_id, task_id, event_key)
      values (v_user_id, v_action, v_description, new.client_id, new.id,
              'task:column:' || new.id || ':' || coalesce(new.column_changed_at::text, now()::text) || ':' || new."column")
      on conflict do nothing;
    end if;
    if old.client_id is distinct from new.client_id then
      perform public.refresh_client_health(old.client_id);
    end if;
    perform public.refresh_client_health(new.client_id);
    return new;
  end if;

  v_actor := public.activity_actor_name(v_user_id);
  v_context := public.activity_client_context(old.client_id);
  insert into public.activity_log (user_id, action_type, description, client_id, task_id, event_key)
  values (v_user_id, 'task_deleted', v_actor || ' excluiu a tarefa "' || old.title || '"' || v_context,
          old.client_id, null, 'task:deleted:' || old.id)
  on conflict do nothing;
  perform public.refresh_client_health(old.client_id);
  return old;
end;
$$;

drop trigger if exists tasks_activity_trigger on public.tasks;
create trigger tasks_activity_trigger
after insert or update or delete on public.tasks
for each row execute function public.log_task_activity();

create or replace function public.log_meeting_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := coalesce(auth.uid(), new.created_by);
begin
  insert into public.activity_log (user_id, action_type, description, client_id, event_key)
  values (
    v_user_id,
    'meeting_recorded',
    public.activity_actor_name(v_user_id) || ' registrou uma reunião' ||
      coalesce((select ' com ' || name from public.clients where id = new.client_id), ''),
    new.client_id,
    'meeting:recorded:' || new.id
  )
  on conflict do nothing;
  perform public.refresh_client_health(new.client_id);
  return new;
end;
$$;

drop trigger if exists meetings_activity_trigger on public.meetings;
create trigger meetings_activity_trigger
after insert on public.meetings
for each row execute function public.log_meeting_activity();

create or replace function public.log_file_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := coalesce(auth.uid(), new.uploaded_by);
begin
  insert into public.activity_log (user_id, action_type, description, client_id, event_key)
  values (
    v_user_id,
    'file_uploaded',
    public.activity_actor_name(v_user_id) || ' anexou o arquivo "' || new.name || '"' ||
      coalesce((select ' em ' || name from public.clients where id = new.client_id), ''),
    new.client_id,
    'file:uploaded:' || new.id
  )
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists client_files_activity_trigger on public.client_files;
create trigger client_files_activity_trigger
after insert on public.client_files
for each row execute function public.log_file_activity();

create or replace function public.log_meeting_presence_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_client_id uuid;
  v_action text;
  v_description text;
begin
  if new.status = 'in_meeting' and old.status is distinct from 'in_meeting' then
    v_client_id := new.current_client_id;
    v_action := 'meeting_started';
    v_description := coalesce(nullif(trim(new.full_name), ''), 'Alguém') || ' entrou em reunião';
  elsif old.status = 'in_meeting' and new.status is distinct from 'in_meeting' then
    v_client_id := old.current_client_id;
    v_action := 'meeting_ended';
    v_description := coalesce(nullif(trim(new.full_name), ''), 'Alguém') || ' saiu da reunião';
  else
    return new;
  end if;

  insert into public.activity_log (user_id, action_type, description, client_id, event_key)
  values (
    new.id,
    v_action,
    v_description,
    v_client_id,
    'profile:meeting:' || new.id || ':' || new.status_updated_at::text || ':' || v_action
  )
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_meeting_activity_trigger on public.profiles;
create trigger profiles_meeting_activity_trigger
after update of status, current_client_id on public.profiles
for each row execute function public.log_meeting_presence_activity();

-- Seed a baseline without emitting risk-transition events.
select public.refresh_all_client_health();

-- Re-evaluate time-based signals even when nobody has the dashboard open.
create extension if not exists pg_cron with schema pg_catalog;

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in select jobid from cron.job where jobname = 'refresh-client-health' loop
    perform cron.unschedule(v_job_id);
  end loop;
  perform cron.schedule(
    'refresh-client-health',
    '*/15 * * * *',
    'select public.refresh_all_client_health();'
  );
end;
$$;

revoke all on function public.refresh_client_health(uuid) from public, anon, authenticated;
revoke all on function public.refresh_all_client_health() from public, anon, authenticated;
revoke all on function public.calculate_client_health(uuid) from public, anon;
grant execute on function public.calculate_client_health(uuid) to authenticated;
revoke all on function public.activity_actor_name(uuid) from public, anon, authenticated;
revoke all on function public.activity_client_context(uuid) from public, anon, authenticated;
revoke all on function public.log_task_activity() from public, anon, authenticated;
revoke all on function public.log_meeting_activity() from public, anon, authenticated;
revoke all on function public.log_file_activity() from public, anon, authenticated;
revoke all on function public.log_meeting_presence_activity() from public, anon, authenticated;
