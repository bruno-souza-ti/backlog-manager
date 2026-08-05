import { Client, Task, Profile } from "../types";
import { getCurrentDateStr, isOverdue, isDueToday } from "../utils";

const MAX_TASK_NAMES = 5;

export interface ClientAnalytics {
  name: string;
  overdueTasks: number;
  overdueTaskNames: string[];
  blockedTasks: number;
  blockedTaskNames: string[];
  doingTasks: number;
  todoTasks: number;
  completedTasks: number;
  lastTaskActivityDaysAgo: number | null;
  health: "critical" | "warning" | "stable";
}

export interface TeamMemberAnalytics {
  name: string;
  status: string;
  currentClient: string | null;
  assignedActiveTasks: number;
}

export interface OperationalSummary {
  totalClients: number;
  totalActiveTasks: number;
  totalOverdue: number;
  totalBlocked: number;
  totalDueToday: number;
  clientsAtRisk: number;
}

export interface AnalyticsContext {
  dataDate: string;
  clients: ClientAnalytics[];
  team: TeamMemberAnalytics[];
  summary: OperationalSummary;
}

/**
 * Builds the structured context sent to the /api/analyze endpoint.
 * Pure — no side effects, no I/O. Uses data already loaded in memory.
 */
export function buildAnalyticsContext(
  clients: Client[],
  tasks: Task[],
  profiles: Profile[]
): AnalyticsContext {
  const today = getCurrentDateStr();
  const clientsById = new Map(clients.map((c) => [c.id, c]));

  const tasksByClient = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.clientId) continue;
    const bucket = tasksByClient.get(task.clientId) ?? [];
    bucket.push(task);
    tasksByClient.set(task.clientId, bucket);
  }

  const clientsAnalytics: ClientAnalytics[] = clients.map((client) => {
    const ct = tasksByClient.get(client.id) ?? [];

    const overdueList = ct.filter((t) => t.deadline && isOverdue(t.deadline, t.column));
    const blockedList = ct.filter((t) => t.column === "blocked");

    const activityDates = ct
      .flatMap((t) => [t.columnChangedAt, t.createdAt])
      .filter(Boolean) as string[];
    let lastTaskActivityDaysAgo: number | null = null;
    if (activityDates.length > 0) {
      const last = [...activityDates].sort().pop()!;
      lastTaskActivityDaysAgo = Math.round(
        (new Date(today).getTime() - new Date(last).getTime()) / (1000 * 3600 * 24)
      );
    }

    return {
      name: client.name,
      overdueTasks: overdueList.length,
      overdueTaskNames: overdueList.slice(0, MAX_TASK_NAMES).map((t) => t.title),
      blockedTasks: blockedList.length,
      blockedTaskNames: blockedList.slice(0, MAX_TASK_NAMES).map((t) => t.title),
      doingTasks: ct.filter((t) => t.column === "doing").length,
      todoTasks: ct.filter((t) => t.column === "todo").length,
      completedTasks: ct.filter((t) => t.column === "done").length,
      lastTaskActivityDaysAgo,
      health:
        overdueList.length > 0
          ? "critical"
          : blockedList.length > 0
          ? "warning"
          : "stable",
    };
  });

  const workloadMap = new Map<string, number>();
  for (const task of tasks) {
    if (task.assigneeId && task.column !== "done") {
      workloadMap.set(task.assigneeId, (workloadMap.get(task.assigneeId) ?? 0) + 1);
    }
  }

  const teamAnalytics: TeamMemberAnalytics[] = profiles.map((p) => ({
    name: p.full_name,
    status: p.status,
    currentClient: p.current_client_id
      ? (clientsById.get(p.current_client_id)?.name ?? null)
      : null,
    assignedActiveTasks: workloadMap.get(p.id) ?? 0,
  }));

  const totalOverdue = tasks.filter(
    (t) => t.deadline && isOverdue(t.deadline, t.column)
  ).length;
  const totalBlocked = tasks.filter((t) => t.column === "blocked").length;
  const totalDueToday = tasks.filter(
    (t) => t.deadline && isDueToday(t.deadline) && t.column !== "done"
  ).length;
  const totalActive = tasks.filter((t) => t.column !== "done").length;
  const clientsAtRisk = clientsAnalytics.filter(
    (c) => c.health === "critical" || c.health === "warning"
  ).length;

  return {
    dataDate: today,
    clients: clientsAnalytics,
    team: teamAnalytics,
    summary: {
      totalClients: clients.length,
      totalActiveTasks: totalActive,
      totalOverdue,
      totalBlocked,
      totalDueToday,
      clientsAtRisk,
    },
  };
}
