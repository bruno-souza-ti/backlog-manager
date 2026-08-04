import { supabase } from "./supabaseClient";

export class ApiError extends Error {}

/**
 * POST helper for internal /api/* endpoints that require a logged-in user.
 * Attaches the current Supabase access token (the server now rejects these
 * routes without it) and normalizes non-2xx responses into a thrown
 * ApiError instead of letting callers silently treat error JSON as success.
 */
export async function authPostJson<T = unknown>(url: string, body: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Falha na requisição (HTTP ${res.status}).`;
    throw new ApiError(message);
  }
  return data as T;
}
