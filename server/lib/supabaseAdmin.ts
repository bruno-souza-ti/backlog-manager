import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedAdminClient: SupabaseClient | null = null;

export class AdminConfigurationError extends Error {
  constructor() {
    super("A administração de usuários ainda não foi configurada no servidor.");
    this.name = "AdminConfigurationError";
  }
}
/**
 * Trusted Supabase client for Auth Admin and service-role-only RPCs.
 * Never import this module from src/ or expose the secret through a VITE_ key.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  if (cachedAdminClient) return cachedAdminClient;

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !secretKey) throw new AdminConfigurationError();

  cachedAdminClient = createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return cachedAdminClient;
}
