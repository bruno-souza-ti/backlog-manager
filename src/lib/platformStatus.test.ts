import { describe, expect, it } from "vitest";
import { describeGeminiStatus, type GeminiPlatformStatus } from "./platformStatus";

function status(overrides: Partial<GeminiPlatformStatus> = {}): GeminiPlatformStatus {
  return {
    enabled: true,
    configured: true,
    available: false,
    state: "unavailable",
    model: "gemini-test",
    checkedAt: "2026-08-17T12:00:00.000Z",
    retryable: true,
    ...overrides,
  };
}

describe("Gemini platform status presentation", () => {
  it("does not claim the integration is connected while it is only loading", () => {
    expect(describeGeminiStatus(null)).toMatchObject({ badge: "Verificando", operational: false });
  });

  it("only marks a provider as operational after a successful probe", () => {
    expect(describeGeminiStatus(status({ available: true, state: "available" }))).toEqual({
      badge: "Operacional",
      description: "A conexão com o modelo gemini-test foi validada pelo servidor.",
      operational: true,
    });
  });

  it.each([
    ["disabled", "Desativado"],
    ["not_configured", "Não configurado"],
    ["authentication_failed", "Indisponível"],
    ["model_unavailable", "Indisponível"],
    ["timeout", "Indisponível"],
  ] as const)("presents %s as a non-operational state", (state, badge) => {
    expect(describeGeminiStatus(status({ state })).badge).toBe(badge);
    expect(describeGeminiStatus(status({ state })).operational).toBe(false);
  });
});
