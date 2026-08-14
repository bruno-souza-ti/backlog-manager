import type { ProfileRole } from "../../src/types.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EVENT_KEY_PATTERN = /^[A-Za-z0-9:_-]{8,128}$/;

export class TeamAdminInputError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "TeamAdminInputError";
  }
}
export function normalizeInviteEmail(value: unknown): string {
  if (typeof value !== "string") throw new TeamAdminInputError("Informe um e-mail válido.");
  const normalized = value.trim().toLowerCase();
  if (normalized.length > 254 || !EMAIL_PATTERN.test(normalized)) {
    throw new TeamAdminInputError("Informe um e-mail válido.");
  }
  return normalized;
}

export function normalizeFullName(value: unknown): string {
  if (typeof value !== "string") throw new TeamAdminInputError("Informe o nome do integrante.");
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < 2 || normalized.length > 120) {
    throw new TeamAdminInputError("O nome deve ter entre 2 e 120 caracteres.");
  }
  return normalized;
}

export function parseProfileRole(value: unknown): ProfileRole {
  if (value !== "owner" && value !== "admin" && value !== "member") {
    throw new TeamAdminInputError("Papel de acesso inválido.");
  }
  return value;
}

export function parseEventKey(value: unknown): string {
  if (typeof value !== "string" || !EVENT_KEY_PATTERN.test(value)) {
    throw new TeamAdminInputError("Identificador da operação inválido.");
  }
  return value;
}

export function assertRoleAssignmentAllowed(actorRole: ProfileRole, targetRole: ProfileRole): void {
  if (actorRole === "member") {
    throw new TeamAdminInputError("Seu nível de acesso não permite esta operação.", 403);
  }
  if (actorRole === "admin" && targetRole === "owner") {
    throw new TeamAdminInputError("Administradores não podem atribuir o papel de proprietário.", 403);
  }
}

export function assertTargetManagementAllowed(
  actorId: string,
  actorRole: ProfileRole,
  targetId: string,
  currentTargetRole: ProfileRole,
  requestedRole?: ProfileRole,
): void {
  if (actorId === targetId) {
    throw new TeamAdminInputError("Você não pode alterar o próprio acesso.", 403);
  }
  if (actorRole === "admin" && (currentTargetRole === "owner" || requestedRole === "owner")) {
    throw new TeamAdminInputError("Somente proprietários podem gerenciar outros proprietários.", 403);
  }
}
