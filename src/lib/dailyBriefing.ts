import { Client, Task } from "../types";
import { getCurrentDateStr, getDaysOverdue, isOverdue, isDueToday } from "../utils";

/** Days without task activity before flagging a client as stalled. */
const STALL_THRESHOLD_DAYS = 14;

export type BriefingItemType =
  | "overdue_task"
  | "blocked_task"
  | "due_today"
  | "stalled_client";

export type BriefingPriority = "critical" | "high" | "medium";

export interface BriefingItem {
  id: string;
  priority: BriefingPriority;
  type: BriefingItemType;
  clientId: string;
  clientName: string;
  /** Short action/status label */
  title: string;
  /** Supporting detail (worst task, count, days) */
  detail: string;
}

export interface DailyBriefing {
  items: BriefingItem[];
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  isEmpty: boolean;
}

/**
 * Pure function — builds a prioritized daily briefing from already-loaded data.
 * Zero extra queries: uses tasks (already realtime) + clients (already loaded).
 *
 * Priority chain: overdue → blocked → due today → stalled (no task activity)
 */
export function computeDailyBriefing(
  clients: Client[],
  tasks: Task[]
): DailyBriefing {
  const items: BriefingItem[] = [];
  const today = getCurrentDateStr();
  const clientsById = new Map(clients.map((c) => [c.id, c]));

  // ── Pre-group tasks by clientId ───────────────────────────────────────────
  const tasksByClient = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.clientId) continue;
    const bucket = tasksByClient.get(task.clientId) ?? [];
    bucket.push(task);
    tasksByClient.set(task.clientId, bucket);
  }

  // Track which clients already have a critical/high item — stall check skips them.
  const coveredHighPriority = new Set<string>();

  // ── 1. Overdue tasks — grouped by client (critical) ───────────────────────
  const overdueByClient = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.clientId || !task.deadline || !isOverdue(task.deadline, task.column)) continue;
    const bucket = overdueByClient.get(task.clientId) ?? [];
    bucket.push(task);
    overdueByClient.set(task.clientId, bucket);
  }
  for (const [clientId, overdueTasks] of overdueByClient) {
    const client = clientsById.get(clientId);
    if (!client) continue;
    // Worst = oldest overdue deadline
    const worst = [...overdueTasks].sort((a, b) =>
      (a.deadline ?? "").localeCompare(b.deadline ?? "")
    )[0];
    const days = getDaysOverdue(worst.deadline);
    const extra = overdueTasks.length > 1 ? ` (+${overdueTasks.length - 1} mais)` : "";
    items.push({
      id: `overdue-${clientId}`,
      priority: "critical",
      type: "overdue_task",
      clientId: client.id,
      clientName: client.name,
      title: worst.title + extra,
      detail: `${overdueTasks.length} atrasada${overdueTasks.length !== 1 ? "s" : ""} — mais crítica há ${days} dia${days !== 1 ? "s" : ""}`,
    });
    coveredHighPriority.add(clientId);
  }

  // ── 2. Blocked tasks — grouped by client (high) ───────────────────────────
  const blockedByClient = new Map<string, number>();
  for (const task of tasks) {
    if (task.column !== "blocked" || !task.clientId) continue;
    blockedByClient.set(task.clientId, (blockedByClient.get(task.clientId) ?? 0) + 1);
  }
  for (const [clientId, count] of blockedByClient) {
    const client = clientsById.get(clientId);
    if (!client) continue;
    items.push({
      id: `blocked-${clientId}`,
      priority: "high",
      type: "blocked_task",
      clientId: client.id,
      clientName: client.name,
      title: `${count} tarefa${count !== 1 ? "s" : ""} bloqueada${count !== 1 ? "s" : ""}`,
      detail: "Impedindo progresso — requer ação",
    });
    coveredHighPriority.add(clientId);
  }

  // ── 3. Due today — grouped by client (high) ───────────────────────────────
  const todayByClient = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.clientId || !task.deadline || !isDueToday(task.deadline) || task.column === "done") continue;
    const bucket = todayByClient.get(task.clientId) ?? [];
    bucket.push(task);
    todayByClient.set(task.clientId, bucket);
  }
  for (const [clientId, todayTasks] of todayByClient) {
    const client = clientsById.get(clientId);
    if (!client) continue;
    const first = todayTasks[0];
    const extra = todayTasks.length > 1 ? ` (+${todayTasks.length - 1})` : "";
    items.push({
      id: `today-${clientId}`,
      priority: "high",
      type: "due_today",
      clientId: client.id,
      clientName: client.name,
      title: first.title + extra,
      detail: `${todayTasks.length} entrega${todayTasks.length !== 1 ? "s" : ""} prevista${todayTasks.length !== 1 ? "s" : ""} para hoje`,
    });
    coveredHighPriority.add(clientId);
  }

  // ── 4. Stalled clients — last task activity > threshold (medium) ──────────
  for (const client of clients) {
    if (coveredHighPriority.has(client.id)) continue;
    const clientTasks = tasksByClient.get(client.id) ?? [];
    const activeTasks = clientTasks.filter((t) => t.column !== "done");
    if (activeTasks.length === 0) continue;

    const activityDates = clientTasks
      .flatMap((t) => [t.columnChangedAt, t.createdAt])
      .filter(Boolean) as string[];
    if (activityDates.length === 0) continue;

    const lastActivity = [...activityDates].sort().pop()!;
    const diffDays = Math.round(
      (new Date(today).getTime() - new Date(lastActivity).getTime()) / (1000 * 3600 * 24)
    );
    if (diffDays >= STALL_THRESHOLD_DAYS) {
      items.push({
        id: `stalled-${client.id}`,
        priority: "medium",
        type: "stalled_client",
        clientId: client.id,
        clientName: client.name,
        title: `Sem movimentação há ${diffDays} dia${diffDays !== 1 ? "s" : ""}`,
        detail: `${activeTasks.length} tarefa${activeTasks.length !== 1 ? "s" : ""} pendente${activeTasks.length !== 1 ? "s" : ""}`,
      });
    }
  }

  const criticalCount = items.filter((i) => i.priority === "critical").length;
  const highCount = items.filter((i) => i.priority === "high").length;
  const mediumCount = items.filter((i) => i.priority === "medium").length;

  return { items, criticalCount, highCount, mediumCount, isEmpty: items.length === 0 };
}
