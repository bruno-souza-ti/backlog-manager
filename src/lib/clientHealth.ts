import { Task } from "../types";
import { daysSince, getCurrentDateStr, isDueToday, isOverdue } from "../utils";

export type HealthLevel = "critical" | "warning" | "stable";

/** Days without any task activity before flagging staleness (escalates further past 30). */
const STALE_ACTIVITY_DAYS = 14;
const STALE_ACTIVITY_DAYS_SEVERE = 30;
/** Days without a meeting before flagging client neglect. */
const NO_MEETING_DAYS = 30;
/** Deadline window (days out) that counts as "approaching", short of due-today. */
const DEADLINE_PROXIMITY_DAYS = 3;
/** task_moved activity_log entries in the recent window that count as churn/instability. */
const CHURN_THRESHOLD = 6;

const CRITICAL_SCORE = 50;
const WARNING_SCORE = 20;

export interface ClientHealthInput {
  /** Tasks already scoped to this client. */
  tasks: Task[];
  /** ISO timestamp of the most recent meeting, if any is known. */
  lastMeetingAt?: string | null;
  /** Count of "task_moved" activity_log entries for this client in the recent window (see useClientHealthSignals). */
  recentChangeCount?: number;
}

export interface ClientHealthResult {
  level: HealthLevel;
  /** Internal weighted score — higher is worse. Exposed for debugging/tuning, not for display. */
  score: number;
  /** Human-readable factors that contributed to the score, most significant first. */
  reasons: string[];
}

/**
 * Single source of truth for "is this client healthy" — considers overdue
 * tasks, blocked tasks, staleness (no task movement), deadline proximity,
 * recurring changes (churn), and meeting cadence. Pure function: takes
 * already-loaded data, does no I/O, so it's cheap to call per-card in a grid.
 */
export function computeClientHealth({
  tasks,
  lastMeetingAt,
  recentChangeCount = 0,
}: ClientHealthInput): ClientHealthResult {
  const activeTasks = tasks.filter((t) => t.column !== "done");
  const reasons: string[] = [];
  let score = 0;

  // ── 1. Overdue tasks ───────────────────────────────────────────────────────
  const overdueTasks = activeTasks.filter((t) => t.deadline && isOverdue(t.deadline, t.column));
  if (overdueTasks.length > 0) {
    score += Math.min(overdueTasks.length, 3) * 25;
    reasons.push(`${overdueTasks.length} tarefa${overdueTasks.length !== 1 ? "s" : ""} atrasada${overdueTasks.length !== 1 ? "s" : ""}`);
  }

  // ── 2. Blocked tasks ───────────────────────────────────────────────────────
  const blockedTasks = activeTasks.filter((t) => t.column === "blocked");
  if (blockedTasks.length > 0) {
    score += Math.min(blockedTasks.length, 3) * 15;
    reasons.push(`${blockedTasks.length} tarefa${blockedTasks.length !== 1 ? "s" : ""} bloqueada${blockedTasks.length !== 1 ? "s" : ""}`);
  }

  // ── 3. Time without movement ───────────────────────────────────────────────
  const activityDates = tasks.flatMap((t) => [t.columnChangedAt, t.createdAt]).filter(Boolean) as string[];
  if (activeTasks.length > 0 && activityDates.length > 0) {
    const lastActivity = [...activityDates].sort().pop()!;
    const idleDays = daysSince(lastActivity);
    if (idleDays >= STALE_ACTIVITY_DAYS_SEVERE) {
      score += 35;
      reasons.push(`Sem movimentação há ${idleDays} dias`);
    } else if (idleDays >= STALE_ACTIVITY_DAYS) {
      score += 20;
      reasons.push(`Sem movimentação há ${idleDays} dias`);
    }
  }

  // ── 4. Deadline proximity ──────────────────────────────────────────────────
  const dueTodayTasks = activeTasks.filter((t) => t.deadline && isDueToday(t.deadline));
  if (dueTodayTasks.length > 0) {
    score += Math.min(dueTodayTasks.length, 3) * 12;
    reasons.push(`${dueTodayTasks.length} tarefa${dueTodayTasks.length !== 1 ? "s" : ""} vencendo hoje`);
  } else {
    const today = getCurrentDateStr();
    const soonDueTasks = activeTasks.filter((t) => {
      if (!t.deadline || isOverdue(t.deadline, t.column)) return false;
      const diffDays = Math.round((new Date(t.deadline).getTime() - new Date(today).getTime()) / (1000 * 3600 * 24));
      return diffDays > 0 && diffDays <= DEADLINE_PROXIMITY_DAYS;
    });
    if (soonDueTasks.length > 0) {
      score += Math.min(soonDueTasks.length, 3) * 6;
      reasons.push(`${soonDueTasks.length} tarefa${soonDueTasks.length !== 1 ? "s" : ""} com prazo próximo`);
    }
  }

  // ── 5. Recurring changes (churn) ───────────────────────────────────────────
  if (recentChangeCount >= CHURN_THRESHOLD) {
    score += 15;
    reasons.push(`${recentChangeCount} alterações de status nos últimos 14 dias`);
  }

  // ── 6. Absence of recent meetings ──────────────────────────────────────────
  // Only penalizes staleness relative to an established meeting cadence — a
  // brand-new client with zero meeting history yet isn't flagged as at-risk.
  if (lastMeetingAt) {
    const idleMeetingDays = daysSince(lastMeetingAt);
    if (idleMeetingDays >= NO_MEETING_DAYS) {
      score += 10;
      reasons.push(`Sem reunião há ${idleMeetingDays} dias`);
    }
  }

  const level: HealthLevel = score >= CRITICAL_SCORE ? "critical" : score >= WARNING_SCORE ? "warning" : "stable";
  if (reasons.length === 0) reasons.push("Nenhum sinal de risco identificado");

  return { level, score, reasons };
}

/** Ordinal severity used to compare two health levels — higher is worse. */
export const HEALTH_SEVERITY: Record<HealthLevel, number> = { stable: 0, warning: 1, critical: 2 };

/**
 * True only for a real worsening transition (e.g. stable -> warning,
 * warning -> critical) — never for a tie or an improvement. Used by
 * Mirrors the strict transition rule enforced by the persisted backend state.
 */
export function isHealthWorsening(previous: HealthLevel, next: HealthLevel): boolean {
  return HEALTH_SEVERITY[next] > HEALTH_SEVERITY[previous];
}

interface HealthMeta {
  emoji: string;
  label: string;
  badgeClasses: string;
  dotClasses: string;
}

/** Shared health badge metadata — mirrors utils.ts's getStatusMeta shape/convention. */
export function getHealthMeta(level: HealthLevel): HealthMeta {
  switch (level) {
    case "critical":
      return {
        emoji: "🔴",
        label: "Crítico",
        badgeClasses: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/40",
        dotClasses: "bg-red-500",
      };
    case "warning":
      return {
        emoji: "🟡",
        label: "Atenção",
        badgeClasses: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40",
        dotClasses: "bg-amber-500",
      };
    default:
      return {
        emoji: "🟢",
        label: "Saudável",
        badgeClasses: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40",
        dotClasses: "bg-emerald-500",
      };
  }
}
