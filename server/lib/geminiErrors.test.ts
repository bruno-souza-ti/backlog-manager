import { describe, expect, it } from "vitest";
import { classifyGeminiError, toGeminiApiError } from "./geminiErrors";

describe("Gemini error classification", () => {
  it.each([
    [400, "request_rejected", "AI_PROVIDER_REQUEST_REJECTED", 502, false],
    [401, "authentication_failed", "AI_PROVIDER_AUTHENTICATION_FAILED", 503, false],
    [403, "permission_denied", "AI_PROVIDER_PERMISSION_DENIED", 503, false],
    [404, "model_unavailable", "AI_MODEL_UNAVAILABLE", 503, false],
    [429, "quota_exceeded", "AI_PROVIDER_QUOTA_EXCEEDED", 503, true],
    [503, "unavailable", "AI_PROVIDER_UNAVAILABLE", 502, true],
  ] as const)("maps provider status %s to a safe operational category", (status, category, code, publicStatus, retryable) => {
    const classified = classifyGeminiError({ status, message: "sensitive-provider-detail" });
    expect(classified).toMatchObject({ category, providerStatus: status, retryable });
    expect(classified.apiError).toMatchObject({ code, status: publicStatus });
    expect(classified.apiError.message).not.toContain("sensitive-provider-detail");
  });

  it("maps abort and timeout failures without exposing the provider message", () => {
    const normalized = toGeminiApiError(new Error("provider deadline exceeded with secret detail"));
    expect(normalized).toMatchObject({ code: "AI_TIMEOUT", status: 504 });
    expect(normalized.message).not.toContain("secret detail");
  });

  it("sanitizes unknown errors", () => {
    const normalized = toGeminiApiError(new Error("raw upstream response with private data"));
    expect(normalized).toMatchObject({ code: "AI_PROVIDER_UNAVAILABLE", status: 502 });
    expect(normalized.message).not.toContain("private data");
  });
});
