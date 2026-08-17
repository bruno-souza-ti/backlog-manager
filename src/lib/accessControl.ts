import type { Profile } from "../types";

export type AccessState = "signed_out" | "checking" | "allowed" | "denied" | "error";

/**
 * Token renewal is routine session maintenance. It must not replace the
 * authenticated application with the blocking access screen, otherwise every
 * local component state (including an in-flight AI answer) is discarded.
 */
export function shouldCheckProfileInBackground(authEvent: string): boolean {
  return authEvent === "TOKEN_REFRESHED";
}

export function resolveAccessState(params: {
  hasSession: boolean;
  checking: boolean;
  profile: Profile | null;
  profileLoadFailed?: boolean;
}): AccessState {
  if (!params.hasSession) return "signed_out";
  if (params.checking) return "checking";
  if (params.profileLoadFailed) return "error";
  return params.profile?.is_active === true ? "allowed" : "denied";
}
