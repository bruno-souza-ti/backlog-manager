import type { AuthChangeEvent } from "@supabase/supabase-js";

export type PasswordFlowMode = "invite" | "recovery";

const INVITE_PATH = "/auth/setup-password";
const RECOVERY_PATH = "/auth/update-password";

export function detectPasswordFlow(location: Pick<Location, "pathname" | "search" | "hash">): PasswordFlowMode | null {
  if (location.pathname === INVITE_PATH) return "invite";
  if (location.pathname === RECOVERY_PATH) return "recovery";

  const search = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  const type = search.get("type") || hash.get("type");
  if (type === "invite") return "invite";
  if (type === "recovery") return "recovery";
  return null;
}

export function passwordFlowFromAuthEvent(event: AuthChangeEvent): PasswordFlowMode | null {
  return event === "PASSWORD_RECOVERY" ? "recovery" : null;
}

export function validateNewPassword(password: string, confirmation: string): string | null {
  if (password.length < 8) return "A senha deve ter pelo menos 8 caracteres.";
  if (password.length > 72) return "A senha deve ter no máximo 72 caracteres.";
  if (password !== confirmation) return "As senhas informadas não coincidem.";
  return null;
}

export function passwordRedirectUrl(origin: string): string {
  return `${origin}${RECOVERY_PATH}`;
}

export function clearAuthCallbackUrl(): void {
  window.history.replaceState(null, "", "/");
}
