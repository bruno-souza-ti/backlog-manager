import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Task } from "../types";
import { mapTaskRow } from "../lib/taskMappers";
import { logActivity } from "../lib/activityLog";
import { useToast } from "../components/common/ToastProvider";

const COLUMN_LABELS: Record<Task["column"], string> = {
  todo: "A Fazer",
  doing: "Fazendo",
  blocked: "Bloqueado",
  done: "Feito",
};

/**
 * Owns the `tasks` slice of app state: initial load, the realtime
 * subscription that keeps every view (dashboard, backlog, kanban, reports)
 * in sync across tabs/teammates, and the task CRUD handlers.
 */
export function useTasksData(userId?: string, userFullName?: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const { showToast } = useToast();

  const fetchTasks = useCallback(async () => {
    setTasksLoading(true);
    const { data, error } = await supabase.from("tasks").select("*");
    if (error) {
      console.error("Erro ao carregar tarefas:", error);
      showToast("Não foi possível carregar as tarefas.", "error");
      setTasksLoading(false);
      return;
    }
    setTasks((data || []).map(mapTaskRow));
    setTasksLoading(false);
  }, [showToast]);

  // Realtime sync for tasks: any change made from another session (another
  // tab, another teammate) must reflect here immediately without a reload,
  // since this is the single source of truth feeding Dashboard, Backlog
  // Geral, client Kanbans, Equipe and Relatórios.
  useEffect(() => {
    const channel = supabase
      .channel("tasks-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldRow = payload.old as { id: string };
            setTasks((prev) => prev.filter((t) => t.id !== oldRow.id));
            return;
          }

          const mapped = mapTaskRow(payload.new as Parameters<typeof mapTaskRow>[0]);
          setTasks((prev) => {
            const exists = prev.some((t) => t.id === mapped.id);
            return exists ? prev.map((t) => (t.id === mapped.id ? mapped : t)) : [mapped, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleAddTask = useCallback(async (newTaskData: Omit<Task, "id">) => {
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        client_id: newTaskData.clientId || null,
        title: newTaskData.title,
        description: newTaskData.description,
        deadline: newTaskData.deadline,
        column: newTaskData.column,
        urgency: newTaskData.urgency,
        assignee_id: newTaskData.assigneeId,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      console.error("Erro ao criar tarefa no Supabase:", error);
      showToast("Não foi possível salvar a tarefa.", "error");
      return;
    }

    if (data) {
      setTasks((prev) => [mapTaskRow(data), ...prev]);
      logActivity({
        userId,
        actionType: "task_created",
        description: `${userFullName || "Alguém"} criou a tarefa "${data.title}"`,
        clientId: data.client_id,
        taskId: data.id,
      });
    }
  }, [userId, userFullName, showToast]);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    let removedTask: Task | undefined;
    setTasks((prev) => {
      removedTask = prev.find((t) => t.id === taskId);
      return prev.filter((t) => t.id !== taskId);
    });

    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) {
      console.error("Erro ao excluir tarefa no Supabase:", error);
      showToast("Não foi possível excluir a tarefa.", "error");
      if (removedTask) {
        const taskToRestore = removedTask;
        setTasks((prev) => [taskToRestore, ...prev]);
      }
    }
  }, [showToast]);

  const handleUpdateTaskColumn = useCallback(async (taskId: string, column: Task["column"]) => {
    let movedTask: Task | undefined;
    let originalTasks: Task[] = [];
    const nowIso = new Date().toISOString();
    const completedAt = column === "done" ? nowIso : undefined;

    setTasks((prev) => {
      originalTasks = prev;
      movedTask = prev.find((t) => t.id === taskId);
      return prev.map((t) => (t.id === taskId ? { ...t, column, completedAt, columnChangedAt: nowIso } : t));
    });

    const { error } = await supabase
      .from("tasks")
      .update({ column, completed_at: completedAt || null, column_changed_at: nowIso })
      .eq("id", taskId);

    if (error) {
      console.error("Erro ao mover tarefa no Supabase:", error);
      showToast("Não foi possível atualizar o status da tarefa.", "error");
      setTasks(originalTasks);
      return;
    }

    if (movedTask) {
      logActivity({
        userId,
        actionType: "task_moved",
        description: `${userFullName || "Alguém"} moveu "${movedTask.title}" para ${COLUMN_LABELS[column]}`,
        clientId: movedTask.clientId,
        taskId,
      });
    }
  }, [userId, userFullName, showToast]);

  return {
    tasks,
    tasksLoading,
    fetchTasks,
    handleAddTask,
    handleDeleteTask,
    handleUpdateTaskColumn,
  };
}
