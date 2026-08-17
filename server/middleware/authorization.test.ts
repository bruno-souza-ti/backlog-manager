import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import type { ProfileRole } from "../../src/types";
import { requireActiveUser, requirePermission } from "./authorization";

function createMiddlewareContext(role?: ProfileRole) {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const response = { locals: { authRole: role, requestId: "req-test" }, status } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { request: {} as Request, response, next, status, json };
}

describe("requirePermission", () => {
  it("allows a member capability", () => {
    const context = createMiddlewareContext("member");
    requirePermission("ai.extract_tasks")(context.request, context.response, context.next);
    expect(context.next).toHaveBeenCalledOnce();
    expect(context.status).not.toHaveBeenCalled();
  });

  it("returns 403 for a global capability denied to a member", () => {
    const context = createMiddlewareContext("member");
    requirePermission("analytics.global")(context.request, context.response, context.next);
    expect(context.next).not.toHaveBeenCalled();
    expect(context.status).toHaveBeenCalledWith(403);
    expect(context.json).toHaveBeenCalledWith({
      error: {
        code: "ACCESS_DENIED",
        message: "Seu nível de acesso não permite esta operação.",
        requestId: "req-test",
      },
    });
  });

  it("allows the same global capability for an admin", () => {
    const context = createMiddlewareContext("admin");
    requirePermission("analytics.global")(context.request, context.response, context.next);
    expect(context.next).toHaveBeenCalledOnce();
  });

  it("protects team administration endpoints from members", () => {
    const member = createMiddlewareContext("member");
    requirePermission("team.manage")(member.request, member.response, member.next);
    expect(member.status).toHaveBeenCalledWith(403);

    const admin = createMiddlewareContext("admin");
    requirePermission("team.manage")(admin.request, admin.response, admin.next);
    expect(admin.next).toHaveBeenCalledOnce();
  });
});

describe("requireActiveUser", () => {
  it("returns a structured 401 when the bearer token is absent", async () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const response = { locals: { requestId: "req-auth" }, status } as unknown as Response;
    const next = vi.fn() as NextFunction;

    await requireActiveUser({ headers: {} } as Request, response, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: { code: "AUTH_REQUIRED", message: "Autenticação necessária.", requestId: "req-auth" } });
  });
});
