import { Task } from "../types";

export type TaskTransitionKind = "not_found" | "no_change" | "completed" | "moved";

export interface TaskColumnTransition {
  kind: TaskTransitionKind;
  task?: Task;
  nextTasks: Task[];
  completedAt?: string;
}

/**
 * Classifies a Kanban column change before any write happens, so
 * handleUpdateTaskColumn can decide whether there's actually anything to
 * persist or log:
 *   - "not_found": no task with that id in current state — nothing to do.
 *   - "no_change": destination equals the task's current column — nothing to do.
 *   - "completed": destination is "done" (from any other column) — a real completion.
 *   - "moved": any other real transition, including leaving "done".
 *
 * Pure — no I/O, testable without a Supabase call or a React render.
 */
export function classifyColumnTransition(
  fromColumn: Task["column"] | undefined,
  toColumn: Task["column"]
): TaskTransitionKind {
  if (fromColumn === undefined) return "not_found";
  if (fromColumn === toColumn) return "no_change";
  return toColumn === "done" ? "completed" : "moved";
}

/**
 * Builds the complete optimistic state transition synchronously. Keeping the
 * decision outside React's state-updater callback prevents queued/batched
 * setState execution from changing whether the database write happens.
 */
export function createTaskColumnTransition(
  tasks: Task[],
  taskId: string,
  toColumn: Task["column"],
  changedAt: string
): TaskColumnTransition {
  const task = tasks.find((candidate) => candidate.id === taskId);
  const kind = classifyColumnTransition(task?.column, toColumn);
  if (!task || kind === "not_found" || kind === "no_change") {
    return { kind, task, nextTasks: tasks };
  }

  const completedAt = kind === "completed" ? changedAt : undefined;
  return {
    kind,
    task,
    completedAt,
    nextTasks: tasks.map((candidate) => candidate.id === taskId
      ? { ...candidate, column: toColumn, completedAt, columnChangedAt: changedAt }
      : candidate),
  };
}
