import { supabase } from "./supabaseClient";

export class ApiError extends Error {}

async function authenticatedHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

async function parseApiResponse<T>(res: Response): Promise<T> {
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

/** GET helper for internal endpoints protected by the Supabase session. */
export async function authGetJson<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url, { headers: await authenticatedHeaders() });
  return parseApiResponse<T>(res);
}

/** POST helper for internal endpoints protected by the Supabase session. */
export async function authPostJson<T = unknown>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authenticatedHeaders()),
    },
    body: JSON.stringify(body),
  });
  return parseApiResponse<T>(res);
}
