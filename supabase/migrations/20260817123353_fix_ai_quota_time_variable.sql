-- Avoid collision between the PL/pgSQL variable and PostgreSQL CURRENT_TIME.
create or replace function public.reserve_ai_quota(
  p_user_id uuid,
  p_route text,
  p_input_chars integer,
  p_hourly_limit integer default 20,
  p_daily_char_limit integer default 500000
)
returns table (
  allowed boolean,
  retry_after_seconds integer,
  hourly_count bigint,
  daily_chars bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_route text := trim(p_route);
  reservation_time timestamptz := clock_timestamp();
  reservation_hour_start timestamptz := date_trunc('hour', reservation_time);
  reservation_day_start timestamptz := date_trunc('day', reservation_time);
  hour_requests bigint;
  day_characters bigint;
  wait_seconds integer := 0;
begin
  if p_user_id is null
     or normalized_route = ''
     or length(normalized_route) > 120
     or p_input_chars < 0
     or p_hourly_limit <= 0
     or p_daily_char_limit <= 0 then
    raise exception 'Invalid AI quota reservation.' using errcode = '22023';
  end if;

  insert into public.ai_usage_buckets (user_id, route, window_kind, window_start)
  values
    (p_user_id, normalized_route, 'hour', reservation_hour_start),
    (p_user_id, normalized_route, 'day', reservation_day_start)
  on conflict do nothing;

  perform 1
  from public.ai_usage_buckets
  where user_id = p_user_id
    and route = normalized_route
    and (
      (window_kind = 'hour' and window_start = reservation_hour_start)
      or (window_kind = 'day' and window_start = reservation_day_start)
    )
  order by window_kind
  for update;

  select request_count into hour_requests
  from public.ai_usage_buckets
  where user_id = p_user_id
    and route = normalized_route
    and window_kind = 'hour'
    and window_start = reservation_hour_start;

  select input_chars into day_characters
  from public.ai_usage_buckets
  where user_id = p_user_id
    and route = normalized_route
    and window_kind = 'day'
    and window_start = reservation_day_start;

  if hour_requests + 1 > p_hourly_limit then
    wait_seconds := greatest(
      wait_seconds,
      ceil(extract(epoch from (reservation_hour_start + interval '1 hour' - reservation_time)))::integer + 1
    );
  end if;

  if day_characters + p_input_chars > p_daily_char_limit then
    wait_seconds := greatest(
      wait_seconds,
      ceil(extract(epoch from (reservation_day_start + interval '1 day' - reservation_time)))::integer + 1
    );
  end if;

  if wait_seconds > 0 then
    return query select false, wait_seconds, hour_requests, day_characters;
    return;
  end if;

  update public.ai_usage_buckets
  set request_count = request_count + 1,
      input_chars = input_chars + p_input_chars,
      updated_at = reservation_time
  where user_id = p_user_id
    and route = normalized_route
    and window_kind = 'hour'
    and window_start = reservation_hour_start;

  update public.ai_usage_buckets
  set request_count = request_count + 1,
      input_chars = input_chars + p_input_chars,
      updated_at = reservation_time
  where user_id = p_user_id
    and route = normalized_route
    and window_kind = 'day'
    and window_start = reservation_day_start;

  return query select true, 0, hour_requests + 1, day_characters + p_input_chars;
end;
$$;

revoke all on function public.reserve_ai_quota(uuid, text, integer, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.reserve_ai_quota(uuid, text, integer, integer, integer)
  to service_role;
