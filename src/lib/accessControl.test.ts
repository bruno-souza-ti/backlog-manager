import { describe, expect, it } from "vitest";
import type { Profile } from "../types";
import { resolveAccessState, shouldCheckProfileInBackground } from "./accessControl";

function profile(isActive: boolean): Profile {
  return {
    id: "user-1",
    full_name: "Pessoa Teste",
    email: "pessoa@geniality.com.br",
    role: "member",
    is_active: isActive,
    status: "available",
  };
}

describe("resolveAccessState", () => {
  it("keeps unauthenticated visitors on the login flow", () => {
    expect(resolveAccessState({ hasSession: false, checking: false, profile: null })).toBe("signed_out");
  });

  it("does not make an authorization decision while the profile is loading", () => {
    expect(resolveAccessState({ hasSession: true, checking: true, profile: null })).toBe("checking");
  });

  it("allows only an explicitly active profile", () => {
    expect(resolveAccessState({ hasSession: true, checking: false, profile: profile(true) })).toBe("allowed");
    expect(resolveAccessState({ hasSession: true, checking: false, profile: profile(false) })).toBe("denied");
  });

  it("denies a session without a profile and separates database failures", () => {
    expect(resolveAccessState({ hasSession: true, checking: false, profile: null })).toBe("denied");
    expect(resolveAccessState({ hasSession: true, checking: false, profile: null, profileLoadFailed: true })).toBe("error");
  });
});

describe("shouldCheckProfileInBackground", () => {
  it("keeps the authenticated UI mounted during routine token renewal", () => {
    expect(shouldCheckProfileInBackground("TOKEN_REFRESHED")).toBe(true);
  });

  it.each(["INITIAL_SESSION", "SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"])(
    "keeps %s in the blocking authorization path",
    (event) => {
      expect(shouldCheckProfileInBackground(event)).toBe(false);
    }
  );
});
