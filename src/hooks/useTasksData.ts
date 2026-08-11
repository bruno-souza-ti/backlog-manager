import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Client, Task } from "../types";
import { mapTaskRow } from "../lib/taskMappers";
import { createTaskColumnTransition } from "../lib/taskTransition";
import { useToast } from "../components/common/ToastProvider";
import { isClientReadOnly } from "../lib/clientLifecycle";

/**
 * Owns the `tasks` slice of app state: initial load, the realtime
 * subscription that keeps every view (dashboard, backlog, kanban, reports)
 * in sync across tabs/teammates, and the task CRUD handlers.
 */
export function useTasksData(userId?: string, clients: Client[] = []) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const { showToast } = useToast();
  const clearTasks = useCallback(() => setTasks([]), []);

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
    const taskClient = newTaskData.clientId ? clients.find((client) => client.id === newTaskData.clientId) : undefined;
    if (taskClient && isClientReadOnly(taskClient)) {
      showToast("Este cliente está em modo somente leitura.", "error");
      return;
    }
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
      const mapped = mapTaskRow(data);
      setTasks((prev) => prev.some((task) => task.id === mapped.id) ? prev : [mapped, ...prev]);
    }
  }, [clients, userId, showToast]);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    const removedTask = tasks.find((task) => task.id === taskId);
    if (!removedTask) return;
    const taskClient = removedTask.clientId ? clients.find((client) => client.id === removedTask.clientId) : undefined;
    if (taskClient && isClientReadOnly(taskClient)) {
      showToast("Este cliente está em modo somente leitura.", "error");
      return;
    }

    setTasks((prev) => prev.filter((task) => task.id !== taskId));

    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) {
      console.error("Erro ao excluir tarefa no Supabase:", error);
      showToast("Não foi possível excluir a tarefa.", "error");
      if (removedTask) {
        const taskToRestore = removedTask;
        setTasks((prev) => [taskToRestore, ...prev]);
      }
      return;
    }

  }, [clients, tasks, showToast]);

  const handleUpdateTaskColumn = useCallback(async (taskId: string, column: Task["column"]) => {
    const nowIso = new Date().toISOString();
    const transition = createTaskColumnTransition(tasks, taskId, column, nowIso);
    if (!transition.task || transition.kind === "not_found" || transition.kind === "no_change") return;
    const taskClient = transition.task.clientId ? clients.find((client) => client.id === transition.task?.clientId) : undefined;
    if (taskClient && isClientReadOnly(taskClient)) {
      showToast("Este cliente está em modo somente leitura.", "error");
      return;
    }

    const originalTasks = tasks;
    setTasks(transition.nextTasks);

    const { error } = await supabase
      .from("tasks")
      .update({ column, completed_at: transition.completedAt ?? null, column_changed_at: nowIso })
      .eq("id", taskId);

    if (error) {
      console.error("Erro ao mover tarefa no Supabase:", error);
      showToast("Não foi possível atualizar o status da tarefa.", "error");
      setTasks(originalTasks);
      return;
    }

  }, [clients, tasks, showToast]);

  return {
    tasks,
    tasksLoading,
    fetchTasks,
    handleAddTask,
    handleDeleteTask,
    handleUpdateTaskColumn,
    clearTasks,
  };
}
