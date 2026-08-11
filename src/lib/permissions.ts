import type { ProfileRole } from "../types";

export type AppView = "dashboard" | "backlog" | "team" | "reports" | "settings";

export type AppPermission =
  | "view.dashboard"
  | "view.backlog"
  | "view.team"
  | "view.reports.global"
  | "view.settings.self"
  | "clients.create"
  | "clients.manage_lifecycle"
  | "analytics.global"
  | "platform.status"
  | "team.manage"
  | "ai.extract_tasks"
  | "ai.document_chat"
  | "ai.meeting_summary"
  | "calendar.read_self";

const MEMBER_PERMISSIONS = [
  "view.dashboard",
  "view.backlog",
  "view.team",
  "view.settings.self",
  "ai.extract_tasks",
  "ai.document_chat",
  "ai.meeting_summary",
  "calendar.read_self",
] as const satisfies readonly AppPermission[];

const ADMIN_PERMISSIONS = [
  ...MEMBER_PERMISSIONS,
  "view.reports.global",
  "clients.create",
  "clients.manage_lifecycle",
  "analytics.global",
  "platform.status",
  "team.manage",
] as const satisfies readonly AppPermission[];

export const ROLE_PERMISSIONS: Readonly<Record<ProfileRole, ReadonlySet<AppPermission>>> = {
  member: new Set(MEMBER_PERMISSIONS),
  admin: new Set(ADMIN_PERMISSIONS),
  owner: new Set(ADMIN_PERMISSIONS),
};

export const VIEW_PERMISSIONS: Readonly<Record<AppView, AppPermission>> = {
  dashboard: "view.dashboard",
  backlog: "view.backlog",
  team: "view.team",
  reports: "view.reports.global",
  settings: "view.settings.self",
};

export const ROLE_LABELS: Readonly<Record<ProfileRole, string>> = {
  owner: "Proprietário",
  admin: "Administrador",
  member: "Membro",
};

export function hasPermission(role: ProfileRole | null | undefined, permission: AppPermission): boolean {
  return role ? ROLE_PERMISSIONS[role]?.has(permission) === true : false;
}

export function canAccessView(role: ProfileRole | null | undefined, view: AppView): boolean {
  return hasPermission(role, VIEW_PERMISSIONS[view]);
}

export function getAllowedViews(role: ProfileRole | null | undefined): AppView[] {
  if (!role) return [];
  return (Object.keys(VIEW_PERMISSIONS) as AppView[]).filter((view) => canAccessView(role, view));
}
