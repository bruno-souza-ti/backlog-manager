import { afterEach, describe, expect, it, vi } from "vitest";
import type { GeminiRuntimeConfig } from "./geminiClient";
import { getGeminiRuntimeConfig, probeGeminiProvider, requireGeminiClient } from "./geminiClient";

function config(overrides: Partial<GeminiRuntimeConfig> = {}): GeminiRuntimeConfig {
  return {
    enabled: true,
    apiKey: "test-key",
    healthCacheTtlMs: 300_000,
    healthTimeoutMs: 5_000,
    models: {
      analytics: "gemini-test-analytics",
      task_extraction: "gemini-test-tasks",
      document_chat: "gemini-test-documents",
      meeting_summary: "gemini-test-meetings",
    },
    ...overrides,
  };
}

describe("Gemini runtime configuration", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("supports an administrative kill switch", () => {
    vi.stubEnv("AI_ENABLED", "false");
    vi.stubEnv("GEMINI_API_KEY", "configured-key");
    expect(getGeminiRuntimeConfig().enabled).toBe(false);
    expect(() => requireGeminiClient()).toThrow(expect.objectContaining({ code: "AI_DISABLED", status: 503 }));
  });

  it("uses a shared model with per-operation overrides", () => {
    vi.stubEnv("GEMINI_MODEL", "gemini-shared");
    vi.stubEnv("GEMINI_MODEL_ANALYTICS", "gemini-analytics");
    vi.stubEnv("GEMINI_MODEL_DOCUMENT_CHAT", "");
    expect(getGeminiRuntimeConfig().models).toEqual({
      analytics: "gemini-analytics",
      task_extraction: "gemini-shared",
      document_chat: "gemini-shared",
      meeting_summary: "gemini-shared",
    });
  });

  it("enforces the provider minimum deadline for health checks", () => {
    vi.stubEnv("AI_HEALTH_TIMEOUT_MS", "5000");
    expect(getGeminiRuntimeConfig().healthTimeoutMs).toBe(10_000);
  });

  it("rejects missing provider configuration without constructing a client", () => {
    vi.stubEnv("AI_ENABLED", "true");
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(() => requireGeminiClient()).toThrow(expect.objectContaining({ code: "AI_PROVIDER_NOT_CONFIGURED", status: 503 }));
  });
});

describe("Gemini provider health probe", () => {
  it("validates access to the configured model with a minimal generation probe", async () => {
    const generateContent = vi.fn().mockResolvedValue({ text: "O" });
    const result = await probeGeminiProvider({ models: { generateContent } }, config(), new Date("2026-08-17T12:00:00Z"));
    expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({
      model: "gemini-test-analytics",
      contents: "health-check",
      config: expect.objectContaining({ maxOutputTokens: 1 }),
    }));
    expect(result).toEqual({
      enabled: true,
      configured: true,
      available: true,
      state: "available",
      model: "gemini-test-analytics",
      checkedAt: "2026-08-17T12:00:00.000Z",
      retryable: false,
    });
  });

  it("does not contact the provider when the kill switch is active", async () => {
    const generateContent = vi.fn();
    const result = await probeGeminiProvider({ models: { generateContent } }, config({ enabled: false }));
    expect(generateContent).not.toHaveBeenCalled();
    expect(result).toMatchObject({ state: "disabled", enabled: false, available: false });
  });

  it("reports an invalid key without returning the provider message", async () => {
    const generateContent = vi.fn().mockRejectedValue({ status: 401, message: "raw invalid key response" });
    const result = await probeGeminiProvider({ models: { generateContent } }, config());
    expect(result).toMatchObject({ state: "authentication_failed", configured: true, available: false, retryable: false });
    expect(JSON.stringify(result)).not.toContain("raw invalid key response");
  });

  it("reports provider quota exhaustion as retryable", async () => {
    const generateContent = vi.fn().mockRejectedValue({ status: 429, message: "quota details" });
    const result = await probeGeminiProvider({ models: { generateContent } }, config());
    expect(result).toMatchObject({ state: "quota_exceeded", available: false, retryable: true });
  });

  it("enforces a hard timeout even when the provider promise does not settle", async () => {
    const generateContent = vi.fn(() => new Promise<never>(() => undefined));
    const result = await probeGeminiProvider({ models: { generateContent } }, config({ healthTimeoutMs: 5 }));
    expect(result).toMatchObject({ state: "timeout", available: false, retryable: true });
  });
});
