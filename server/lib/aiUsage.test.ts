import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./apiErrors";
import { runGuardedAiRequest, type AiUsageStore } from "./aiUsage";

function createStore(allowed = true, retryAfter = 0) {
  const reserve = vi.fn().mockResolvedValue({ allowed, retry_after_seconds: retryAfter, hourly_count: 1, daily_chars: 12 });
  const audit = vi.fn().mockResolvedValue(undefined);
  return { store: { reserve, audit } satisfies AiUsageStore, reserve, audit };
}

const limits = { hourlyRequests: 20, dailyInputCharacters: 500_000, timeoutMs: 25 };

describe("runGuardedAiRequest", () => {
  it("reserves quota, executes and audits metadata on success", async () => {
    const { store, reserve, audit } = createStore();
    const execute = vi.fn().mockResolvedValue("ok");

    await expect(runGuardedAiRequest({ userId: "user-1", route: "/api/analyze", requestId: "req-1", inputChars: 123, execute, store, limits })).resolves.toBe("ok");
    expect(reserve).toHaveBeenCalledWith({ userId: "user-1", route: "/api/analyze", inputChars: 123, hourlyLimit: 20, dailyCharLimit: 500_000 });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ request_id: "req-1", user_id: "user-1", route: "/api/analyze", input_chars: 123, status_code: 200, outcome: "success" }));
    expect(Object.keys(audit.mock.calls[0][0]).sort()).toEqual(["duration_ms", "input_chars", "outcome", "request_id", "route", "status_code", "user_id"]);
  });

  it("returns 429 with retry information without calling the provider", async () => {
    const { store, audit } = createStore(false, 90);
    const execute = vi.fn();
    await expect(runGuardedAiRequest({ userId: "user-1", route: "/api/analyze", requestId: "req-2", inputChars: 10, execute, store, limits })).rejects.toMatchObject({ status: 429, code: "AI_RATE_LIMIT_EXCEEDED", retryAfterSeconds: 90 });
    expect(execute).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ status_code: 429, outcome: "AI_RATE_LIMIT_EXCEEDED" }));
  });

  it("aborts and reports a timeout", async () => {
    const { store, audit } = createStore();
    const execute = vi.fn((signal: AbortSignal) => new Promise<never>((_resolve, reject) => signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))));
    const assertion = expect(runGuardedAiRequest({ userId: "user-1", route: "/api/analyze", requestId: "req-3", inputChars: 10, execute, store, limits: { ...limits, timeoutMs: 5 } })).rejects.toMatchObject({ status: 504, code: "AI_TIMEOUT" });
    await assertion;
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ status_code: 504, outcome: "AI_TIMEOUT" }));
  });

  it("normalizes provider failures without exposing their content", async () => {
    const { store, audit } = createStore();
    await expect(runGuardedAiRequest({ userId: "user-1", route: "/api/chat-document", requestId: "req-4", inputChars: 999, execute: async () => { throw new Error("sensitive provider detail"); }, store, limits })).rejects.toMatchObject({ status: 502, code: "AI_PROVIDER_UNAVAILABLE" });
    expect(JSON.stringify(audit.mock.calls)).not.toContain("sensitive provider detail");
  });

  it("preserves a safe provider authentication category in the audit", async () => {
    const { store, audit } = createStore();
    await expect(runGuardedAiRequest({
      userId: "user-1",
      route: "/api/analyze",
      requestId: "req-auth-failure",
      inputChars: 50,
      execute: async () => { throw { status: 401, message: "raw invalid key response" }; },
      store,
      limits,
    })).rejects.toMatchObject({ status: 503, code: "AI_PROVIDER_AUTHENTICATION_FAILED" });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({
      request_id: "req-auth-failure",
      status_code: 503,
      outcome: "AI_PROVIDER_AUTHENTICATION_FAILED",
    }));
    expect(JSON.stringify(audit.mock.calls)).not.toContain("raw invalid key response");
  });
});
