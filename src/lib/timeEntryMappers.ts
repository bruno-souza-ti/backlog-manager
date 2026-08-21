import { TimeEntry } from "../types";

/** Raw shape of a `time_entries` table row as returned by Supabase (snake_case columns). */
export interface TimeEntryRow {
  id: string;
  task_id: string;
  user_id: string;
  minutes: number;
  note: string;
  entry_date: string;
  created_at?: string;
  updated_at?: string;
}

export function mapTimeEntryRow(row: TimeEntryRow): TimeEntry {
  return {
    id: row.id,
    taskId: row.task_id,
    userId: row.user_id,
    minutes: row.minutes,
    note: row.note || "",
    entryDate: row.entry_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
