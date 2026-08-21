import { Sprint } from "../types";

/** Raw shape of a `sprints` table row as returned by Supabase (snake_case columns). */
export interface SprintRow {
  id: string;
  name: string;
  goal: string | null;
  start_date: string;
  end_date: string;
  created_by?: string | null;
  created_at?: string;
}

export function mapSprintRow(row: SprintRow): Sprint {
  return {
    id: row.id,
    name: row.name,
    goal: row.goal,
    startDate: row.start_date,
    endDate: row.end_date,
    createdBy: row.created_by || undefined,
    createdAt: row.created_at,
  };
}
