-- calculate_client_health is an internal building block used by the persisted
-- health refresh routine. The browser reads client_health_state and does not
-- need a privileged arbitrary-client calculation RPC.
revoke all on function public.calculate_client_health(uuid) from public, anon, authenticated;
