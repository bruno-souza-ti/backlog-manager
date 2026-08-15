import { describe, expect, it } from "vitest";
import { ApiError } from "./apiErrors";
import { AI_INPUT_LIMITS, measureInputCharacters, optionalBoundedText, requireBoundedText } from "./aiValidation";

describe("AI payload validation", () => {
  it("accepts bounded text and counts structured input", () => {
    expect(requireBoundedText("pergunta", AI_INPUT_LIMITS.analyzeQuestion, "Pergunta")).toBe("pergunta");
    expect(optionalBoundedText(undefined, 10, "Opcional")).toBeUndefined();
    expect(measureInputCharacters(["abc", { ok: true }, null])).toBe(14);
  });

  it("rejects empty text as an invalid payload", () => {
    try {
      requireBoundedText("   ", 10, "Pergunta");
      throw new Error("expected validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ status: 400, code: "INVALID_PAYLOAD" });
    }
  });

  it("rejects questions above 2,000 characters before the model call", () => {
    try {
      requireBoundedText("a".repeat(2_001), AI_INPUT_LIMITS.analyzeQuestion, "Pergunta");
      throw new Error("expected validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ status: 413, code: "PAYLOAD_TOO_LARGE" });
    }
  });
});
