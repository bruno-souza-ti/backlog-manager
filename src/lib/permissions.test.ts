import { describe, expect, it } from "vitest";
import { canAccessView, getAllowedViews, hasPermission } from "./permissions";

describe("role permissions", () => {
  it("keeps core operational views available to members", () => {
    expect(getAllowedViews("member")).toEqual(["dashboard", "clients", "backlog", "sprints", "team", "settings"]);
    expect(hasPermission("member", "ai.extract_tasks")).toBe(true);
    expect(hasPermission("member", "ai.document_chat")).toBe(true);
    expect(hasPermission("member", "calendar.read_self")).toBe(true);
  });

  it("does not expose global management capabilities to members", () => {
    expect(canAccessView("member", "reports")).toBe(false);
    expect(hasPermission("member", "clients.create")).toBe(false);
    expect(hasPermission("member", "clients.manage_lifecycle")).toBe(false);
    expect(hasPermission("member", "analytics.global")).toBe(false);
    expect(hasPermission("member", "team.manage")).toBe(false);
    expect(hasPermission("member", "sprints.manage")).toBe(false);
  });

  it("grants admins the global management capabilities", () => {
    expect(canAccessView("admin", "reports")).toBe(true);
    expect(hasPermission("admin", "clients.create")).toBe(true);
    expect(hasPermission("admin", "clients.manage_lifecycle")).toBe(true);
    expect(hasPermission("admin", "analytics.global")).toBe(true);
    expect(hasPermission("admin", "platform.status")).toBe(true);
    expect(hasPermission("admin", "sprints.manage")).toBe(true);
  });

  it("lets any member view and use sprints, even though only admins manage them", () => {
    expect(canAccessView("member", "sprints")).toBe(true);
    expect(hasPermission("member", "view.sprints")).toBe(true);
  });

  it("currently treats owner as a protected superset equivalent to admin", () => {
    expect(getAllowedViews("owner")).toEqual(getAllowedViews("admin"));
    expect(hasPermission("owner", "team.manage")).toBe(true);
  });

  it("denies every permission when no validated role exists", () => {
    expect(getAllowedViews(null)).toEqual([]);
    expect(hasPermission(undefined, "view.dashboard")).toBe(false);
  });
});
