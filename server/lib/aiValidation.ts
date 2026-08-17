import { ApiError } from "./apiErrors.js";

export const AI_INPUT_LIMITS = {
  analyzeQuestion: 2_000,
  shortText: 4_000,
  longText: 200_000,
  transcriptItems: 5_000,
} as const;

export function requireBoundedText(value: unknown, maxLength: number, fieldLabel: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiError(400, "INVALID_PAYLOAD", `${fieldLabel} deve ser um texto não vazio.`);
  }
  if (value.length > maxLength) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", `${fieldLabel} excede o limite de ${maxLength.toLocaleString("pt-BR")} caracteres.`);
  }
  return value;
}

export function optionalBoundedText(value: unknown, maxLength: number, fieldLabel: string): string | undefined {
  if (value === undefined) return undefined;
  return requireBoundedText(value, maxLength, fieldLabel);
}

export function measureInputCharacters(values: unknown[]): number {
  return values.reduce<number>((total, value) => {
    if (typeof value === "string") return total + value.length;
    if (value === undefined || value === null) return total;
    try {
      return total + JSON.stringify(value).length;
    } catch {
      throw new ApiError(400, "INVALID_PAYLOAD", "O payload contém dados que não podem ser processados.");
    }
  }, 0);
}
