import type { NextFunction, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { hasPermission, type AppPermission } from "../../src/lib/permissions.js";
import type { ProfileRole } from "../../src/types.js";
import { ApiError, sendApiError } from "../lib/apiErrors.js";

let cachedAuthClient: ReturnType<typeof createClient> | null = null;

function getAuthClient(url: string, anonKey: string) {
  if (!cachedAuthClient) {
    cachedAuthClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedAuthClient;
}

export async function requireActiveUser(req: Request, res: Response, next: NextFunction) {
  // Calendar requests already use Authorization for the Google provider token.
  // X-Supabase-Authorization carries the platform JWT in that one case.
  const alternateAuthHeader = req.headers["x-supabase-authorization"];
  const authHeader = typeof alternateAuthHeader === "string" ? alternateAuthHeader : req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return sendApiError(res, new ApiError(401, "AUTH_REQUIRED", "Autenticação necessária."));
  }

  const supabaseAuthClient = getAuthClient(supabaseUrl, supabaseAnonKey);

  const { data, error } = await supabaseAuthClient.auth.getUser(token);
  if (error || !data.user) {
    return sendApiError(res, new ApiError(401, "AUTH_REQUIRED", "Sessão inválida ou expirada. Faça login novamente."));
  }

  const requestClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: canAccess, error: accessError } = await requestClient.rpc("can_access_app");
  if (accessError) {
    console.error("Falha ao validar autorização do usuário:", accessError.message);
    return sendApiError(res, new ApiError(503, "AUTHORIZATION_UNAVAILABLE", "Não foi possível validar sua autorização."));
  }
  if (canAccess !== true) {
    return sendApiError(res, new ApiError(403, "ACCESS_DENIED", "Usuário sem acesso ativo à plataforma."));
  }

  // Read the role from the authoritative profile row on every protected API
  // request. Do not trust user_metadata or a role supplied by the browser.
  const { data: profile, error: profileError } = await requestClient
    .from("profiles")
    .select("role, is_active")
    .eq("id", data.user.id)
    .single();

  if (profileError || profile?.is_active !== true) {
    return sendApiError(res, new ApiError(403, "ACCESS_DENIED", "Usuário sem perfil ativo na plataforma."));
  }

  res.locals.authUserId = data.user.id;
  res.locals.authRole = profile.role as ProfileRole;
  next();
}

export function requirePermission(permission: AppPermission) {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (!hasPermission(res.locals.authRole as ProfileRole | undefined, permission)) {
      return sendApiError(res, new ApiError(403, "ACCESS_DENIED", "Seu nível de acesso não permite esta operação."));
    }
    next();
  };
}
