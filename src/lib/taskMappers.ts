import { AIExtractedTaskDTO, Task } from "../types";
import { getCurrentDateStr } from "../utils";

/** Raw shape of a `tasks` table row as returned by Supabase (snake_case columns). */
export interface TaskRow {
  id: string;
  title: string;
  description: string;
  deadline: string;
  column: Task["column"];
  urgency?: Task["urgency"] | null;
  client_id?: string | null;
  assignee_id?: string | null;
  created_at?: string;
  completed_at?: string | null;
  column_changed_at?: string;
}

export function mapTaskRow(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    deadline: row.deadline,
    column: row.column,
    urgency: row.urgency || undefined,
    clientId: row.client_id || undefined,
    assigneeId: row.assignee_id || undefined,
    createdAt: row.created_at,
    completedAt: row.completed_at || undefined,
    columnChangedAt: row.column_changed_at,
  };
}

interface BuildTaskFromAIResultOptions {
  clientId?: string;
  defaultColumn?: Task["column"];
  defaultDescription?: string;
  defaultUrgency?: Task["urgency"];
  defaultTitle?: string;
}

/**
 * Maps one AI-extracted task result (from /api/extract-tasks or
 * /api/meet/summarize-transcript) into a persistable Task payload.
 * Centralizes a mapping that used to be copy-pasted in ClientDetails and
 * MeetBotModal with slightly different defaults per call site.
 */
export function buildTaskFromAIResult(
  dto: AIExtractedTaskDTO,
  options: BuildTaskFromAIResultOptions = {}
): Omit<Task, "id"> {
  return {
    clientId: options.clientId,
    title: dto.title?.trim() || options.defaultTitle || "Tarefa da Reunião",
    description: dto.description?.trim() || options.defaultDescription || "",
    deadline: dto.deadline || getCurrentDateStr(),
    column: dto.column || options.defaultColumn || "todo",
    urgency: dto.urgency || options.defaultUrgency,
  };
}
