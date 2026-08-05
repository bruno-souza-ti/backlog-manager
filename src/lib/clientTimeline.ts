import { Task, NotesHistoryItem, ClientFile } from "../types";

export type TimelineEventType =
  | "client_created"
  | "note_saved"
  | "task_added"
  | "task_completed"
  | "task_blocked"
  | "meeting_held"
  | "file_uploaded";

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  title: string;
  description: string;
  /** ISO timestamp or YYYY-MM-DD — both handled by Date() at render time */
  date: string;
  clientId: string;
}

export interface MeetingTimelineRow {
  id: string;
  title: string;
  occurred_at: string;
}

interface BuildTimelineParams {
  clientId: string;
  clientCreatedAt: string | null;
  tasks: Task[];
  notesHistory: NotesHistoryItem[];
  files: ClientFile[];
  meetings: MeetingTimelineRow[];
}

export function buildClientTimeline({
  clientId,
  clientCreatedAt,
  tasks,
  notesHistory,
  files,
  meetings,
}: BuildTimelineParams): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  if (clientCreatedAt) {
    events.push({
      id: `created-${clientId}`,
      type: "client_created",
      title: "Cliente cadastrado",
      description: "Cliente adicionado à plataforma.",
      date: clientCreatedAt,
      clientId,
    });
  }

  for (const task of tasks) {
    if (task.createdAt) {
      events.push({
        id: `task-added-${task.id}`,
        type: "task_added",
        title: "Tarefa criada",
        description: task.title,
        date: task.createdAt,
        clientId,
      });
    }
    if (task.completedAt) {
      events.push({
        id: `task-done-${task.id}`,
        type: "task_completed",
        title: "Tarefa concluída",
        description: task.title,
        date: task.completedAt,
        clientId,
      });
    }
    // Only record "blocked" entry when the task is currently blocked — columnChangedAt
    // reflects the last column transition, so if column === "blocked" it marks that moment.
    if (task.column === "blocked" && task.columnChangedAt) {
      events.push({
        id: `task-blocked-${task.id}`,
        type: "task_blocked",
        title: "Tarefa bloqueada",
        description: task.title,
        date: task.columnChangedAt,
        clientId,
      });
    }
  }

  for (const note of notesHistory) {
    events.push({
      id: `note-${note.id}`,
      type: "note_saved",
      title: "Anotação salva",
      description: note.content.slice(0, 120) + (note.content.length > 120 ? "…" : ""),
      date: note.date, // YYYY-MM-DD
      clientId,
    });
  }

  for (const file of files) {
    events.push({
      id: `file-${file.id}`,
      type: "file_uploaded",
      title: "Arquivo enviado",
      description: file.name + (file.size ? ` (${file.size})` : ""),
      date: file.uploadDate, // YYYY-MM-DD
      clientId,
    });
  }

  for (const meeting of meetings) {
    events.push({
      id: `meeting-${meeting.id}`,
      type: "meeting_held",
      title: "Reunião realizada",
      description: meeting.title || "Reunião sem título",
      date: meeting.occurred_at,
      clientId,
    });
  }

  return events.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}
