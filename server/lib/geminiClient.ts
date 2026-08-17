import { GoogleGenAI } from "@google/genai";
import type { GeminiPlatformStatus, GeminiProviderState } from "../../src/lib/platformStatus.js";
import { ApiError } from "./apiErrors.js";
import { classifyGeminiError } from "./geminiErrors.js";

export type GeminiOperation = "analytics" | "task_extraction" | "document_chat" | "meeting_summary";

export interface GeminiRuntimeConfig {
  enabled: boolean;
  apiKey?: string;
  healthCacheTtlMs: number;
  healthTimeoutMs: number;
  models: Readonly<Record<GeminiOperation, string>>;
}

interface GeminiProbeClient {
  models: {
    generateContent(params: {
      model: string;
      contents: string;
      config?: { abortSignal?: AbortSignal; httpOptions?: { timeout?: number }; maxOutputTokens?: number };
    }): Promise<unknown>;
  };
}

const DEFAULT_MODEL = "gemini-3.6-flash";
let cachedClient: { apiKey: string; client: GoogleGenAI } | null = null;
let cachedHealth: { expiresAt: number; value: GeminiPlatformStatus } | null = null;

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function enabledByEnvironment(value: string | undefined): boolean {
  if (value === undefined) return true;
  return !["0", "false", "off", "no"].includes(value.trim().toLowerCase());
}

function configuredModel(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

export function getGeminiRuntimeConfig(): GeminiRuntimeConfig {
  const sharedModel = configuredModel(process.env.GEMINI_MODEL, DEFAULT_MODEL);
  return {
    enabled: enabledByEnvironment(process.env.AI_ENABLED),
    apiKey: process.env.GEMINI_API_KEY?.trim() || undefined,
    healthCacheTtlMs: positiveInteger(process.env.AI_HEALTH_CACHE_TTL_MS, 300_000),
    healthTimeoutMs: Math.max(10_000, positiveInteger(process.env.AI_HEALTH_TIMEOUT_MS, 10_000)),
    models: {
      analytics: configuredModel(process.env.GEMINI_MODEL_ANALYTICS, sharedModel),
      task_extraction: configuredModel(process.env.GEMINI_MODEL_TASK_EXTRACTION, sharedModel),
      document_chat: configuredModel(process.env.GEMINI_MODEL_DOCUMENT_CHAT, sharedModel),
      meeting_summary: configuredModel(process.env.GEMINI_MODEL_MEETING_SUMMARY, sharedModel),
    },
  };
}

export function getGeminiModel(operation: GeminiOperation): string {
  return getGeminiRuntimeConfig().models[operation];
}

export function getGeminiClient(): GoogleGenAI | null {
  const config = getGeminiRuntimeConfig();
  if (!config.enabled || !config.apiKey) return null;
  if (!cachedClient || cachedClient.apiKey !== config.apiKey) {
    cachedClient = { apiKey: config.apiKey, client: new GoogleGenAI({ apiKey: config.apiKey }) };
  }
  return cachedClient.client;
}

export function requireGeminiClient(): GoogleGenAI {
  const config = getGeminiRuntimeConfig();
  if (!config.enabled) {
    throw new ApiError(503, "AI_DISABLED", "As funções de IA estão temporariamente desativadas.");
  }
  const client = getGeminiClient();
  if (!client) {
    throw new ApiError(503, "AI_PROVIDER_NOT_CONFIGURED", "A integração com a IA não está configurada no servidor.");
  }
  return client;
}

function staticHealth(
  state: "disabled" | "not_configured",
  config: GeminiRuntimeConfig,
  checkedAt: string,
): GeminiPlatformStatus {
  return {
    enabled: config.enabled,
    configured: Boolean(config.apiKey),
    available: false,
    state,
    model: config.models.analytics,
    checkedAt,
    retryable: false,
  };
}

export async function probeGeminiProvider(
  client: GeminiProbeClient | null = getGeminiClient(),
  config: GeminiRuntimeConfig = getGeminiRuntimeConfig(),
  now = new Date(),
): Promise<GeminiPlatformStatus> {
  const checkedAt = now.toISOString();
  if (!config.enabled) return staticHealth("disabled", config, checkedAt);
  if (!config.apiKey || !client) return staticHealth("not_configured", config, checkedAt);

  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new ApiError(504, "AI_TIMEOUT", "A verificação do provedor excedeu o tempo máximo permitido."));
      }, config.healthTimeoutMs);
    });
    await Promise.race([
      client.models.generateContent({
        model: config.models.analytics,
        contents: "health-check",
        config: {
          abortSignal: controller.signal,
          httpOptions: { timeout: config.healthTimeoutMs },
          maxOutputTokens: 1,
        },
      }),
      timeoutPromise,
    ]);
    return {
      enabled: true,
      configured: true,
      available: true,
      state: "available",
      model: config.models.analytics,
      checkedAt,
      retryable: false,
    };
  } catch (error) {
    const classified = classifyGeminiError(error);
    return {
      enabled: true,
      configured: true,
      available: false,
      state: classified.category as GeminiProviderState,
      model: config.models.analytics,
      checkedAt,
      retryable: classified.retryable,
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function getGeminiProviderHealth(force = false): Promise<GeminiPlatformStatus> {
  const now = Date.now();
  if (!force && cachedHealth && cachedHealth.expiresAt > now) return cachedHealth.value;
  const config = getGeminiRuntimeConfig();
  const value = await probeGeminiProvider(getGeminiClient(), config, new Date(now));
  cachedHealth = { expiresAt: now + config.healthCacheTtlMs, value };
  return value;
}
