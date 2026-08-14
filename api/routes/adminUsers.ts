import { Router, type Response } from "express";
import type { User } from "@supabase/supabase-js";
import { requireActiveUser, requirePermission } from "../middleware/authorization.js";
import { AdminConfigurationError, getSupabaseAdminClient } from "../lib/supabaseAdmin.js";
import {
  TeamAdminInputError,
  assertRoleAssignmentAllowed,
  assertTargetManagementAllowed,
  normalizeFullName,
  normalizeInviteEmail,
  parseEventKey,
  parseProfileRole,
} from "../lib/teamAdminRules.js";
import type { Profile, ProfileRole, TeamMemberAdmin } from "../../src/types";

const router = Router();
const AUTH_PAGE_SIZE = 1_000;
const MAX_AUTH_PAGES = 20;

interface ProfileAdminRow extends Profile {
  invited_at?: string | null;
  invited_by?: string | null;
  access_updated_at?: string | null;
  access_updated_by?: string | null;
}

function sendAdminError(res: Response, error: unknown) {
  if (error instanceof TeamAdminInputError) {
    return res.status(error.status).json({ error: error.message });
  }
  if (error instanceof AdminConfigurationError) {
    return res.status(503).json({ error: error.message });
  }

  const candidate = error as { message?: string; code?: string; status?: number };
  if (candidate.code === "23514") {
    return res.status(409).json({ error: "O último proprietário ativo não pode ser removido, rebaixado ou desativado." });
  }
  if (candidate.code === "42501") {
    return res.status(403).json({ error: candidate.message || "Operação administrativa não autorizada." });
  }
  if (candidate.code === "P0002") {
    return res.status(404).json({ error: "Integrante não encontrado." });
  }

  console.error("Falha na administração da equipe:", candidate.message || "erro desconhecido");
  return res.status(500).json({ error: "Não foi possível concluir a operação. Tente novamente." });
}

async function listAllAuthUsers(): Promise<User[]> {
  const client = getSupabaseAdminClient();
  const users: User[] = [];

  for (let page = 1; page <= MAX_AUTH_PAGES; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: AUTH_PAGE_SIZE });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < AUTH_PAGE_SIZE) return users;
  }

  throw new Error("Limite de paginação da equipe excedido.");
}

async function findAuthUserByEmail(email: string): Promise<User | null> {
  const users = await listAllAuthUsers();
  return users.find((user) => user.email?.toLowerCase() === email) || null;
}

async function getProfile(targetId: string): Promise<ProfileAdminRow> {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("profiles")
    .select("id, full_name, email, avatar_color, role, is_active, status, current_client_id, status_updated_at, created_at, updated_at, invited_at, invited_by, access_updated_at, access_updated_by")
    .eq("id", targetId)
    .single();
  if (error) throw error;
  return data as ProfileAdminRow;
}

function toTeamMember(profile: ProfileAdminRow, authUser?: User): TeamMemberAdmin {
  const invitationPending = Boolean(authUser?.invited_at && !authUser.email_confirmed_at);
  return {
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    role: profile.role,
    isActive: profile.is_active,
    invitationStatus: invitationPending ? "pending" : profile.is_active ? "active" : "inactive",
    invitedAt: profile.invited_at || authUser?.invited_at || null,
    lastSignInAt: authUser?.last_sign_in_at || null,
    emailConfirmedAt: authUser?.email_confirmed_at || null,
  };
}

async function getTeamMembers(): Promise<TeamMemberAdmin[]> {
  const client = getSupabaseAdminClient();
  const [{ data: profiles, error }, authUsers] = await Promise.all([
    client
      .from("profiles")
      .select("id, full_name, email, avatar_color, role, is_active, status, current_client_id, status_updated_at, created_at, updated_at, invited_at, invited_by, access_updated_at, access_updated_by")
      .order("full_name"),
    listAllAuthUsers(),
  ]);
  if (error) throw error;

  const authById = new Map(authUsers.map((user) => [user.id, user]));
  return (profiles as ProfileAdminRow[]).map((profile) => toTeamMember(profile, authById.get(profile.id)));
}

async function hasCompletedEvent(eventKey: string): Promise<boolean> {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("activity_log")
    .select("id")
    .eq("event_key", `team-admin:${eventKey}`)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

router.use(requireActiveUser, requirePermission("team.manage"));

router.get("/users", async (_req, res) => {
  try {
    return res.json({ users: await getTeamMembers() });
  } catch (error) {
    return sendAdminError(res, error);
  }
});

router.post("/users/invite", async (req, res) => {
  try {
    const actorId = res.locals.authUserId as string;
    const actorRole = res.locals.authRole as ProfileRole;
    const email = normalizeInviteEmail(req.body?.email);
    const fullName = normalizeFullName(req.body?.fullName);
    const role = parseProfileRole(req.body?.role);
    const eventKey = parseEventKey(req.body?.eventKey);
    assertRoleAssignmentAllowed(actorRole, role);

    if (await hasCompletedEvent(eventKey)) {
      const existingProfile = (await getTeamMembers()).find((user) => user.email === email);
      return res.json({ user: existingProfile, replayed: true });
    }

    const client = getSupabaseAdminClient();
    const existingAuthUser = await findAuthUserByEmail(email);
    if (existingAuthUser?.email_confirmed_at) {
      throw new TeamAdminInputError("Já existe uma conta confirmada com este e-mail.", 409);
    }

    const redirectTo = process.env.AUTH_INVITE_REDIRECT_URL;
    const { data, error } = await client.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      ...(redirectTo ? { redirectTo } : {}),
    });
    if (error) throw error;

    const { data: profileRows, error: profileError } = await client.rpc("register_team_invitation", {
      p_actor_id: actorId,
      p_user_id: data.user.id,
      p_email: email,
      p_full_name: fullName,
      p_role: role,
      p_event_key: eventKey,
      p_is_resend: Boolean(existingAuthUser),
    });
    if (profileError) throw profileError;

    return res.status(existingAuthUser ? 200 : 201).json({
      user: toTeamMember((profileRows as ProfileAdminRow[])[0], data.user),
      resent: Boolean(existingAuthUser),
    });
  } catch (error) {
    return sendAdminError(res, error);
  }
});

router.post("/users/:id/resend", async (req, res) => {
  try {
    const actorId = res.locals.authUserId as string;
    const actorRole = res.locals.authRole as ProfileRole;
    const targetId = req.params.id;
    const eventKey = parseEventKey(req.body?.eventKey);
    const profile = await getProfile(targetId);
    assertTargetManagementAllowed(actorId, actorRole, targetId, profile.role);

    const client = getSupabaseAdminClient();
    const { data: authData, error: authError } = await client.auth.admin.getUserById(targetId);
    if (authError) throw authError;

    if (await hasCompletedEvent(eventKey)) {
      return res.json({ user: toTeamMember(profile, authData.user), replayed: true });
    }

    if (authData.user.email_confirmed_at) {
      throw new TeamAdminInputError("Este integrante já aceitou o convite.", 409);
    }

    const redirectTo = process.env.AUTH_INVITE_REDIRECT_URL;
    const { data, error } = await client.auth.admin.inviteUserByEmail(profile.email, {
      data: { full_name: profile.full_name },
      ...(redirectTo ? { redirectTo } : {}),
    });
    if (error) throw error;

    const { data: profileRows, error: profileError } = await client.rpc("register_team_invitation", {
      p_actor_id: actorId,
      p_user_id: targetId,
      p_email: profile.email,
      p_full_name: profile.full_name,
      p_role: profile.role,
      p_event_key: eventKey,
      p_is_resend: true,
    });
    if (profileError) throw profileError;

    return res.json({ user: toTeamMember((profileRows as ProfileAdminRow[])[0], data.user), resent: true });
  } catch (error) {
    return sendAdminError(res, error);
  }
});

router.patch("/users/:id", async (req, res) => {
  try {
    const actorId = res.locals.authUserId as string;
    const actorRole = res.locals.authRole as ProfileRole;
    const targetId = req.params.id;
    const eventKey = parseEventKey(req.body?.eventKey);
    const action = req.body?.action;
    if (action !== "role" && action !== "activate" && action !== "deactivate") {
      throw new TeamAdminInputError("Ação administrativa inválida.");
    }

    const profile = await getProfile(targetId);
    const requestedRole = action === "role" ? parseProfileRole(req.body?.role) : undefined;
    assertTargetManagementAllowed(actorId, actorRole, targetId, profile.role, requestedRole);
    if (requestedRole) assertRoleAssignmentAllowed(actorRole, requestedRole);

    if (await hasCompletedEvent(eventKey)) {
      const client = getSupabaseAdminClient();
      const { data: authData } = await client.auth.admin.getUserById(targetId);
      return res.json({ user: toTeamMember(profile, authData?.user || undefined), replayed: true });
    }

    const client = getSupabaseAdminClient();
    const { data: rows, error } = await client.rpc("manage_team_member", {
      p_actor_id: actorId,
      p_target_id: targetId,
      p_action: action,
      p_role: requestedRole || null,
      p_event_key: eventKey,
    });
    if (error) throw error;

    const { data: authData } = await client.auth.admin.getUserById(targetId);
    return res.json({ user: toTeamMember((rows as ProfileAdminRow[])[0], authData?.user || undefined) });
  } catch (error) {
    return sendAdminError(res, error);
  }
});

export default router;
