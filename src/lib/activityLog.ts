import { supabase } from "./supabaseClient";

export type ActivityActionType = "task_created" | "task_moved" | "meeting_started" | "meeting_ended";

interface LogActivityParams {
  userId?: string | null;
  actionType: ActivityActionType;
  description: string;
  clientId?: string | null;
  taskId?: string | null;
}

/**
 * Fire-and-forget activity log entry. Failures are logged but never block
 * the action that triggered them (moving a task shouldn't fail because the
 * activity feed insert failed).
 */
export async function logActivity({ userId, actionType, description, clientId, taskId }: LogActivityParams) {
  if (!userId) return;
  const { error } = await supabase.from("activity_log").insert({
    user_id: userId,
    action_type: actionType,
    description,
    client_id: clientId || null,
    task_id: taskId || null,
  });
  if (error) {
    console.error("Erro ao registrar atividade:", error);
  }
}
