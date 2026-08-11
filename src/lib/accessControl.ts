import type { Profile } from "../types";

export type AccessState = "signed_out" | "checking" | "allowed" | "denied" | "error";

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
