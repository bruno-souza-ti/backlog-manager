import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Client, Task, TaskUpdate } from "../types";
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
  const [tasksError, setTasksError] = useState<string | null>(null);
  const { showToast } = useToast();
  const clearTasks = useCallback(() => setTasks([]), []);

  const fetchTasks = useCallback(async () => {
    setTasksLoading(true);
    setTasksError(null);
    const { data, error } = await supabase.from("tasks").select("*");
    if (error) {
      console.error("Erro ao carregar tarefas:", error);
      showToast("Não foi possível carregar as tarefas.", "error");
      setTasksError("Não foi possível carregar as tarefas.");
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

  const handleAddTask = useCallback(async (newTaskData: Omit<Task, "id">): Promise<boolean> => {
    const taskClient = newTaskData.clientId ? clients.find((client) => client.id === newTaskData.clientId) : undefined;
    if (taskClient && isClientReadOnly(taskClient)) {
      showToast("Este cliente está em modo somente leitura.", "error");
      return false;
    }
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        client_id: newTaskData.clientId || null,
        title: newTaskData.title,
        description: newTaskData.description,
        deadline: newTaskData.deadline || null,
        column: newTaskData.column,
        urgency: newTaskData.urgency ?? null,
        assignee_id: newTaskData.assigneeId || null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      console.error("Erro ao criar tarefa no Supabase:", error);
      showToast("Não foi possível salvar a tarefa.", "error");
      return false;
    }

    if (data) {
      const mapped = mapTaskRow(data);
      setTasks((prev) => prev.some((task) => task.id === mapped.id) ? prev : [mapped, ...prev]);
    }
    return true;
  }, [clients, userId, showToast]);

  const handleUpdateTask = useCallback(async (taskId: string, updates: TaskUpdate): Promise<boolean> => {
    const currentTask = tasks.find((task) => task.id === taskId);
    if (!currentTask) return false;
    const nextClientId = Object.prototype.hasOwnProperty.call(updates, "clientId") ? updates.clientId : currentTask.clientId;
    const taskClient = nextClientId ? clients.find((client) => client.id === nextClientId) : undefined;
    if (taskClient && isClientReadOnly(taskClient)) {
      showToast("Este cliente está em modo somente leitura.", "error");
      return false;
    }

    const originalTasks = tasks;
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, ...updates } : task));

    const databaseUpdates: Record<string, unknown> = {};
    if ("clientId" in updates) databaseUpdates.client_id = updates.clientId || null;
    if ("title" in updates) databaseUpdates.title = updates.title;
    if ("description" in updates) databaseUpdates.description = updates.description;
    if ("deadline" in updates) databaseUpdates.deadline = updates.deadline || null;
    if ("urgency" in updates) databaseUpdates.urgency = updates.urgency ?? null;
    if ("assigneeId" in updates) databaseUpdates.assignee_id = updates.assigneeId || null;
    if ("sprintId" in updates) databaseUpdates.sprint_id = updates.sprintId || null;
    if ("column" in updates) {
      databaseUpdates.column = updates.column;
      databaseUpdates.column_changed_at = new Date().toISOString();
      databaseUpdates.completed_at = updates.column === "done" ? new Date().toISOString() : null;
    }

    const { error } = await supabase.from("tasks").update(databaseUpdates).eq("id", taskId);
    if (error) {
      console.error("Erro ao atualizar tarefa no Supabase:", error);
      showToast("Não foi possível atualizar a tarefa.", "error");
      setTasks(originalTasks);
      return false;
    }
    return true;
  }, [clients, tasks, showToast]);

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
    tasksError,
    fetchTasks,
    handleAddTask,
    handleDeleteTask,
    handleUpdateTask,
    handleUpdateTaskColumn,
    clearTasks,
  };
}
