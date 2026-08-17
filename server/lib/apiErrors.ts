import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export type ApiErrorCode =
  | "AUTH_REQUIRED"
  | "ACCESS_DENIED"
  | "AUTHORIZATION_UNAVAILABLE"
  | "INVALID_PAYLOAD"
  | "PAYLOAD_TOO_LARGE"
  | "AI_RATE_LIMIT_EXCEEDED"
  | "AI_QUOTA_UNAVAILABLE"
  | "AI_TIMEOUT"
  | "AI_PROVIDER_UNAVAILABLE"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function requestContext(req: Request, res: Response, next: NextFunction) {
  const incoming = req.headers["x-request-id"];
  const requestId = typeof incoming === "string" && incoming.trim().length > 0
    ? incoming.trim().slice(0, 128)
    : randomUUID();
  res.locals.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
}

export function sendApiError(res: Response, error: ApiError) {
  if (error.retryAfterSeconds !== undefined) {
    res.setHeader("Retry-After", String(Math.max(1, Math.ceil(error.retryAfterSeconds))));
  }
  return res.status(error.status).json({
    error: {
      code: error.code,
      message: error.message,
      requestId: res.locals.requestId,
    },
  });
}

export function sendUnknownApiError(res: Response) {
  return sendApiError(
    res,
    new ApiError(500, "INTERNAL_ERROR", "Ocorreu um erro interno. Tente novamente em instantes."),
  );
}
