import { ApiError as GoogleGenAIApiError } from "@google/genai";
import { ApiError } from "./apiErrors.js";

export type GeminiFailureCategory =
  | "authentication_failed"
  | "permission_denied"
  | "quota_exceeded"
  | "model_unavailable"
  | "request_rejected"
  | "timeout"
  | "unavailable";

export interface ClassifiedGeminiError {
  category: GeminiFailureCategory;
  retryable: boolean;
  providerStatus?: number;
  apiError: ApiError;
}

function providerStatus(error: unknown): number | undefined {
  if (error instanceof GoogleGenAIApiError) return error.status;
  if (!error || typeof error !== "object" || !("status" in error)) return undefined;
  const status = Number((error as { status?: unknown }).status);
  return Number.isInteger(status) ? status : undefined;
}

function isTimeout(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "AbortError" || /timeout|timed out|deadline exceeded/i.test(error.message);
}

export function classifyGeminiError(error: unknown): ClassifiedGeminiError {
  if (error instanceof ApiError) {
    const category: GeminiFailureCategory = error.code === "AI_TIMEOUT" ? "timeout" : "unavailable";
    return { category, retryable: category === "timeout", apiError: error };
  }

  if (isTimeout(error)) {
    return {
      category: "timeout",
      retryable: true,
      apiError: new ApiError(504, "AI_TIMEOUT", "A análise excedeu o tempo máximo permitido."),
    };
  }

  const status = providerStatus(error);
  switch (status) {
    case 400:
      return {
        category: "request_rejected",
        retryable: false,
        providerStatus: status,
        apiError: new ApiError(502, "AI_PROVIDER_REQUEST_REJECTED", "O provedor rejeitou a configuração da análise."),
      };
    case 401:
      return {
        category: "authentication_failed",
        retryable: false,
        providerStatus: status,
        apiError: new ApiError(503, "AI_PROVIDER_AUTHENTICATION_FAILED", "A autenticação do provedor de IA precisa ser revisada."),
      };
    case 403:
      return {
        category: "permission_denied",
        retryable: false,
        providerStatus: status,
        apiError: new ApiError(503, "AI_PROVIDER_PERMISSION_DENIED", "O provedor de IA não autorizou esta operação."),
      };
    case 404:
      return {
        category: "model_unavailable",
        retryable: false,
        providerStatus: status,
        apiError: new ApiError(503, "AI_MODEL_UNAVAILABLE", "O modelo de IA configurado não está disponível."),
      };
    case 429:
      return {
        category: "quota_exceeded",
        retryable: true,
        providerStatus: status,
        apiError: new ApiError(503, "AI_PROVIDER_QUOTA_EXCEEDED", "A cota do provedor de IA está temporariamente indisponível."),
      };
    default:
      return {
        category: "unavailable",
        retryable: status === undefined || status >= 500,
        providerStatus: status,
        apiError: new ApiError(502, "AI_PROVIDER_UNAVAILABLE", "O provedor de IA está temporariamente indisponível."),
      };
  }
}

export function toGeminiApiError(error: unknown): ApiError {
  return classifyGeminiError(error).apiError;
}
