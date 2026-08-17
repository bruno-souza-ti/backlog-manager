-- Enforce least-privilege grants after project-level default privileges.
revoke all on table public.ai_usage_buckets from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.ai_usage_buckets to service_role;

revoke all on table public.ai_request_log from public, anon, authenticated, service_role;
grant select, insert on table public.ai_request_log to service_role;

revoke all on sequence public.ai_request_log_id_seq from public, anon, authenticated, service_role;
grant usage, select on sequence public.ai_request_log_id_seq to service_role;

revoke all on function public.reserve_ai_quota(uuid, text, integer, integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.reserve_ai_quota(uuid, text, integer, integer, integer) to service_role;
