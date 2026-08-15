import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { ApiError, requestContext, sendApiError } from "./apiErrors";

describe("API error contract", () => {
  it("returns a structured error and Retry-After", () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const setHeader = vi.fn();
    const response = { locals: { requestId: "req-429" }, status, setHeader } as unknown as Response;
    sendApiError(response, new ApiError(429, "AI_RATE_LIMIT_EXCEEDED", "Cota excedida.", 12.2));
    expect(setHeader).toHaveBeenCalledWith("Retry-After", "13");
    expect(status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith({ error: { code: "AI_RATE_LIMIT_EXCEEDED", message: "Cota excedida.", requestId: "req-429" } });
  });

  it("preserves a valid request id for correlation", () => {
    const request = { headers: { "x-request-id": "external-request" } } as unknown as Request;
    const setHeader = vi.fn();
    const response = { locals: {}, setHeader } as unknown as Response;
    const next = vi.fn() as NextFunction;
    requestContext(request, response, next);
    expect(response.locals.requestId).toBe("external-request");
    expect(setHeader).toHaveBeenCalledWith("X-Request-Id", "external-request");
    expect(next).toHaveBeenCalledOnce();
  });
});
