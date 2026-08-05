import { Task, NotesHistoryItem } from "../types";
import { MeetingTimelineRow } from "./clientTimeline";
import { getDaysOverdue, isOverdue, isDueToday, daysSince } from "../utils";

/** Days without any note or meeting before suggesting a follow-up. */
const INACTIVITY_THRESHOLD_DAYS = 14;

export type NextActionType =
  | "overdue"
  | "blocked"
  | "due_today"
  | "in_progress"
  | "no_activity"
  | "todo_pending"
  | "all_clear";

export type NextActionPriority = "critical" | "high" | "medium" | "low";

export interface NextAction {
  type: NextActionType;
  title: string;
  /** Short label: task title, inactivity duration, etc. */
  detail: string;
  /** Human-readable explanation of why this was recommended. */
  reason: string;
  priority: NextActionPriority;
  deadline?: string;
  assigneeId?: string;
  taskId?: string;
}

/**
 * Pure function — determines the single most important action the user should
 * take for a client right now. Priority chain:
 *   overdue → blocked → due today → in progress → inactivity → todo pending → all clear
 */
export function computeNextAction(
  clientTasks: Task[],
  notesHistory: NotesHistoryItem[],
  meetings: MeetingTimelineRow[]
): NextAction {
  const activeTasks = clientTasks.filter((t) => t.column !== "done");

  // ── 1. Overdue (critical) ─────────────────────────────────────────────────
  const overdueTasks = activeTasks
    .filter((t) => t.deadline && isOverdue(t.deadline, t.column))
    .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""));

  if (overdueTasks.length > 0) {
    const worst = overdueTasks[0];
    const days = worst.deadline ? getDaysOverdue(worst.deadline) : 0;
    return {
      type: "overdue",
      title: "Resolver tarefa atrasada",
      detail: worst.title,
      reason: `Prazo vencido há ${days} dia${days !== 1 ? "s" : ""}.`,
      priority: "critical",
      deadline: worst.deadline,
      assigneeId: worst.assigneeId,
      taskId: worst.id,
    };
  }

  // ── 2. Blocked (high) ─────────────────────────────────────────────────────
  const blockedTasks = activeTasks.filter((t) => t.column === "blocked");
  if (blockedTasks.length > 0) {
    const first = blockedTasks[0];
    return {
      type: "blocked",
      title: "Desbloquear tarefa",
      detail: first.title,
      reason: `${blockedTasks.length} tarefa${blockedTasks.length !== 1 ? "s" : ""} bloqueada${blockedTasks.length !== 1 ? "s" : ""} impedindo o progresso.`,
      priority: "high",
      deadline: first.deadline,
      assigneeId: first.assigneeId,
      taskId: first.id,
    };
  }

  // ── 3. Due today (high) ───────────────────────────────────────────────────
  const todayTasks = activeTasks.filter((t) => t.deadline && isDueToday(t.deadline));
  if (todayTasks.length > 0) {
    const first = todayTasks[0];
    return {
      type: "due_today",
      title: "Entregar hoje",
      detail: first.title,
      reason: `${todayTasks.length} tarefa${todayTasks.length !== 1 ? "s" : ""} com prazo hoje.`,
      priority: "high",
      deadline: first.deadline,
      assigneeId: first.assigneeId,
      taskId: first.id,
    };
  }

  // ── 4. In progress (medium) ───────────────────────────────────────────────
  const doingTasks = activeTasks.filter((t) => t.column === "doing");
  if (doingTasks.length > 0) {
    const first = doingTasks[0];
    return {
      type: "in_progress",
      title: "Continuar tarefa em andamento",
      detail: first.title,
      reason: `${doingTasks.length} tarefa${doingTasks.length !== 1 ? "s" : ""} em progresso.`,
      priority: "medium",
      deadline: first.deadline,
      assigneeId: first.assigneeId,
      taskId: first.id,
    };
  }

  // ── 5. Inactivity check (medium) ─────────────────────────────────────────
  const candidates: string[] = [];
  if (notesHistory.length > 0) candidates.push(notesHistory[0].date);
  if (meetings.length > 0) candidates.push(meetings[0].occurred_at.slice(0, 10));

  if (candidates.length > 0) {
    const latestDate = [...candidates].sort().pop()!;
    const diffDays = daysSince(latestDate);
    if (diffDays >= INACTIVITY_THRESHOLD_DAYS) {
      return {
        type: "no_activity",
        title: "Agendar acompanhamento",
        detail: `Última interação há ${diffDays} dia${diffDays !== 1 ? "s" : ""}`,
        reason: `Nenhuma reunião ou anotação registrada nos últimos ${diffDays} dias.`,
        priority: "medium",
      };
    }
  }

  // ── 6. Pending todo tasks (low) ───────────────────────────────────────────
  const todoTasks = activeTasks.filter((t) => t.column === "todo");
  if (todoTasks.length > 0) {
    const first = todoTasks[0];
    return {
      type: "todo_pending",
      title: "Iniciar próxima tarefa",
      detail: first.title,
      reason: `${todoTasks.length} tarefa${todoTasks.length !== 1 ? "s" : ""} aguardando início.`,
      priority: "low",
      deadline: first.deadline,
      assigneeId: first.assigneeId,
      taskId: first.id,
    };
  }

  // ── 7. No activity at all — brand new client ──────────────────────────────
  if (clientTasks.length === 0 && notesHistory.length === 0 && meetings.length === 0) {
    return {
      type: "no_activity",
      title: "Iniciar projeto",
      detail: "Nenhuma atividade registrada",
      reason: "Cliente sem tarefas ou anotações. Registre o kickoff e crie o primeiro backlog.",
      priority: "high",
    };
  }

  // ── 8. All clear ─────────────────────────────────────────────────────────
  return {
    type: "all_clear",
    title: "Projeto em dia",
    detail: "Nenhuma ação imediata necessária",
    reason: "Todas as tarefas estão concluídas ou em andamento sem atrasos.",
    priority: "low",
  };
}
