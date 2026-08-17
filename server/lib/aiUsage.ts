import { performance } from "node:perf_hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "./apiErrors.js";
import { toGeminiApiError } from "./geminiErrors.js";
import { getSupabaseAdminClient } from "./supabaseAdmin.js";

export interface AiQuotaResult {
  allowed: boolean;
  retry_after_seconds: number;
  hourly_count: number;
  daily_chars: number;
}

export interface AiAuditRecord {
  request_id: string;
  user_id: string;
  route: string;
  input_chars: number;
  duration_ms: number;
  status_code: number;
  outcome: string;
}

export interface AiUsageStore {
  reserve(args: { userId: string; route: string; inputChars: number; hourlyLimit: number; dailyCharLimit: number }): Promise<AiQuotaResult>;
  audit(record: AiAuditRecord): Promise<void>;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getAiLimits() {
  return {
    hourlyRequests: positiveInteger(process.env.AI_REQUESTS_PER_HOUR, 20),
    dailyInputCharacters: positiveInteger(process.env.AI_INPUT_CHARS_PER_DAY, 500_000),
    timeoutMs: positiveInteger(process.env.AI_TIMEOUT_MS, 30_000),
  };
}

function firstQuotaRow(data: unknown): AiQuotaResult | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const candidate = row as Partial<AiQuotaResult>;
  if (typeof candidate.allowed !== "boolean") return null;
  return {
    allowed: candidate.allowed,
    retry_after_seconds: Number(candidate.retry_after_seconds) || 0,
    hourly_count: Number(candidate.hourly_count) || 0,
    daily_chars: Number(candidate.daily_chars) || 0,
  };
}

export function createSupabaseAiUsageStore(client: SupabaseClient = getSupabaseAdminClient()): AiUsageStore {
  return {
    async reserve(args) {
      const { data, error } = await client.rpc("reserve_ai_quota", {
        p_user_id: args.userId,
        p_route: args.route,
        p_input_chars: args.inputChars,
        p_hourly_limit: args.hourlyLimit,
        p_daily_char_limit: args.dailyCharLimit,
      });
      const row = firstQuotaRow(data);
      if (error || !row) {
        console.error("ai_quota_reservation_failed", { route: args.route, userId: args.userId, reason: error?.code || "invalid_rpc_response" });
        throw new ApiError(503, "AI_QUOTA_UNAVAILABLE", "Não foi possível validar a cota de IA.");
      }
      return row;
    },
    async audit(record) {
      const { error } = await client.from("ai_request_log").insert(record);
      if (error) {
        console.error("ai_audit_write_failed", { requestId: record.request_id, route: record.route, statusCode: record.status_code, reason: error.code });
      }
    },
  };
}

function normalizedOutcome(error: unknown): { apiError: ApiError; outcome: string } {
  if (error instanceof ApiError) return { apiError: error, outcome: error.code };
  const apiError = toGeminiApiError(error);
  return { apiError, outcome: apiError.code };
}

export async function runGuardedAiRequest<T>(args: {
  userId: string;
  route: string;
  requestId: string;
  inputChars: number;
  execute: (signal: AbortSignal, timeoutMs: number) => Promise<T>;
  store?: AiUsageStore;
  limits?: ReturnType<typeof getAiLimits>;
}): Promise<T> {
  const store = args.store ?? createSupabaseAiUsageStore();
  const limits = args.limits ?? getAiLimits();
  const quota = await store.reserve({ userId: args.userId, route: args.route, inputChars: args.inputChars, hourlyLimit: limits.hourlyRequests, dailyCharLimit: limits.dailyInputCharacters });

  if (!quota.allowed) {
    const error = new ApiError(429, "AI_RATE_LIMIT_EXCEEDED", "Limite de análises atingido. Tente novamente após a renovação da cota.", quota.retry_after_seconds);
    await store.audit({ request_id: args.requestId, user_id: args.userId, route: args.route, input_chars: args.inputChars, duration_ms: 0, status_code: error.status, outcome: error.code });
    console.warn("ai_request_rejected", { requestId: args.requestId, userId: args.userId, route: args.route, inputChars: args.inputChars, statusCode: error.status, outcome: error.code });
    throw error;
  }

  const startedAt = performance.now();
  const controller = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        controller.abort();
        reject(new ApiError(504, "AI_TIMEOUT", "A análise excedeu o tempo máximo permitido."));
      }, limits.timeoutMs);
    });
    const result = await Promise.race([args.execute(controller.signal, limits.timeoutMs), timeoutPromise]);
    const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
    await store.audit({ request_id: args.requestId, user_id: args.userId, route: args.route, input_chars: args.inputChars, duration_ms: durationMs, status_code: 200, outcome: "success" });
    console.info("ai_request_completed", { requestId: args.requestId, userId: args.userId, route: args.route, inputChars: args.inputChars, durationMs, statusCode: 200 });
    return result;
  } catch (error) {
    const normalized = normalizedOutcome(error);
    const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
    await store.audit({ request_id: args.requestId, user_id: args.userId, route: args.route, input_chars: args.inputChars, duration_ms: durationMs, status_code: normalized.apiError.status, outcome: normalized.outcome });
    console.warn("ai_request_failed", { requestId: args.requestId, userId: args.userId, route: args.route, inputChars: args.inputChars, durationMs, statusCode: normalized.apiError.status, outcome: normalized.outcome });
    throw normalized.apiError;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}
