import { supabase } from "./supabaseClient";

export class ApiError extends Error {}

async function authenticatedHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

async function parseApiResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const errorValue = data && typeof data === "object"
      ? (data as { error?: unknown }).error
      : undefined;
    const message = typeof errorValue === "string"
      ? errorValue
      : errorValue && typeof errorValue === "object" && typeof (errorValue as { message?: unknown }).message === "string"
        ? (errorValue as { message: string }).message
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

/** PATCH helper for internal endpoints protected by the Supabase session. */
export async function authPatchJson<T = unknown>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(await authenticatedHeaders()),
    },
    body: JSON.stringify(body),
  });
  return parseApiResponse<T>(res);
}
