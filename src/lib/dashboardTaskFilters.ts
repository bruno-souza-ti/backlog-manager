import type { Task, UrgencyLevel } from "../types";
import { getTaskUrgency } from "../utils";

export type DashboardTaskScope = "mine" | "all";
export type DashboardUrgencyFilter = "Todas" | UrgencyLevel;

export function filterDashboardTasks(
  tasks: Task[],
  userId: string,
  scope: DashboardTaskScope,
  urgency: DashboardUrgencyFilter = "Todas"
): Task[] {
  return tasks.filter((task) => {
    if (scope === "mine" && task.assigneeId !== userId) return false;
    return urgency === "Todas" || getTaskUrgency(task) === urgency;
  });
}
