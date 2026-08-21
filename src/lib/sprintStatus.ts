import type { Sprint } from "../types";

export type SprintStatus = "upcoming" | "active" | "completed";

/**
 * The sprint's status is always derived from its dates, never stored —
 * same rule as computeDisplayStatus (presence.ts) and computeClientHealth
 * (clientHealth.ts): a status that could silently drift from reality if
 * someone forgot to update it isn't trustworthy.
 */
export function computeSprintStatus(
  sprint: Pick<Sprint, "startDate" | "endDate">,
  now: number = Date.now()
): SprintStatus {
  const today = new Date(now).toISOString().slice(0, 10);
  if (today < sprint.startDate) return "upcoming";
  if (today > sprint.endDate) return "completed";
  return "active";
}

export const SPRINT_STATUS_META: Record<SprintStatus, { label: string; classes: string }> = {
  upcoming: { label: "Próximo", classes: "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-400 border-slate-200 dark:border-zinc-700" },
  active: { label: "Ativo", classes: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400 border-teal-200 dark:border-teal-900/40" },
  completed: { label: "Concluído", classes: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40" },
};
