import { describe, expect, it } from "vitest";
import {
  TeamAdminInputError,
  assertRoleAssignmentAllowed,
  assertTargetManagementAllowed,
  normalizeFullName,
  normalizeInviteEmail,
  parseEventKey,
  parseProfileRole,
} from "./teamAdminRules";

describe("team administration input", () => {
  it("normalizes e-mail and full name", () => {
    expect(normalizeInviteEmail("  Bruno@GENIALITY.com.br ")).toBe("bruno@geniality.com.br");
    expect(normalizeFullName("  Bruno   Lombardo ")).toBe("Bruno Lombardo");
  });

  it("rejects malformed input and unsafe event keys", () => {
    expect(() => normalizeInviteEmail("invalid-email")).toThrow(TeamAdminInputError);
    expect(() => normalizeFullName("x")).toThrow(TeamAdminInputError);
    expect(() => parseEventKey("short")).toThrow(TeamAdminInputError);
    expect(() => parseEventKey("invite:valid-key_123")).not.toThrow();
    expect(() => parseProfileRole("superadmin")).toThrow(TeamAdminInputError);
  });
});
describe("team administration authorization rules", () => {
  it("allows owner to assign owner and admin to assign member/admin", () => {
    expect(() => assertRoleAssignmentAllowed("owner", "owner")).not.toThrow();
    expect(() => assertRoleAssignmentAllowed("admin", "admin")).not.toThrow();
    expect(() => assertRoleAssignmentAllowed("admin", "member")).not.toThrow();
  });

  it("prevents admin from assigning or managing owner", () => {
    expect(() => assertRoleAssignmentAllowed("admin", "owner")).toThrow(/não podem atribuir/i);
    expect(() => assertTargetManagementAllowed("actor", "admin", "target", "owner")).toThrow(/proprietários/i);
    expect(() => assertTargetManagementAllowed("actor", "admin", "target", "member", "owner")).toThrow(/proprietários/i);
  });

  it("prevents self-management for every administrative role", () => {
    expect(() => assertTargetManagementAllowed("same", "admin", "same", "admin")).toThrow(/próprio acesso/i);
    expect(() => assertTargetManagementAllowed("same", "owner", "same", "owner")).toThrow(/próprio acesso/i);
  });

  it("allows owner to manage another owner", () => {
    expect(() => assertTargetManagementAllowed("actor", "owner", "target", "owner", "admin")).not.toThrow();
  });
});
