import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Client, NewTimeEntryInput, Task, TimeEntry, TimeEntryUpdate } from "../types";
import { mapTimeEntryRow } from "../lib/timeEntryMappers";
import { useToast } from "../components/common/ToastProvider";
import { isClientReadOnly } from "../lib/clientLifecycle";
import { getCurrentDateStr } from "../utils";

/**
 * Owns today's `time_entries` — mirrors useTasksData.ts's shape (fetch,
 * realtime sync, optimistic writes with rollback). Scoped to entry_date =
 * today for every user (not just the caller), since both the personal
 * "Meu Dia" widget and TeamDashboard's per-person stat need it. v1 has no
 * date picker or history browser — entries always count toward today.
 */
export function useTimeEntriesData(userId?: string, tasks: Task[] = [], clients: Client[] = []) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const { showToast } = useToast();
  const clearEntries = useCallback(() => setEntries([]), []);

  const fetchTodayEntries = useCallback(async () => {
    setEntriesLoading(true);
    setEntriesError(null);
    const { data, error } = await supabase.from("time_entries").select("*").eq("entry_date", getCurrentDateStr());
    if (error) {
      console.error("Erro ao carregar registros de tempo:", error);
      showToast("Não foi possível carregar os registros de tempo.", "error");
      setEntriesError("Não foi possível carregar os registros de tempo.");
      setEntriesLoading(false);
      return;
    }
    setEntries((data || []).map(mapTimeEntryRow));
    setEntriesLoading(false);
  }, [showToast]);

  useEffect(() => {
    const today = getCurrentDateStr();
    const channel = supabase
      .channel("time-entries-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "time_entries", filter: `entry_date=eq.${today}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldRow = payload.old as { id: string };
            setEntries((prev) => prev.filter((e) => e.id !== oldRow.id));
            return;
          }

          const mapped = mapTimeEntryRow(payload.new as Parameters<typeof mapTimeEntryRow>[0]);
          setEntries((prev) => {
            const exists = prev.some((e) => e.id === mapped.id);
            return exists ? prev.map((e) => (e.id === mapped.id ? mapped : e)) : [...prev, mapped];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleAddTimeEntry = useCallback(async (input: NewTimeEntryInput): Promise<boolean> => {
    const task = tasks.find((t) => t.id === input.taskId);
    const taskClient = task?.clientId ? clients.find((c) => c.id === task.clientId) : undefined;
    if (taskClient && isClientReadOnly(taskClient)) {
      showToast("Este cliente está em modo somente leitura.", "error");
      return false;
    }

    const { data, error } = await supabase
      .from("time_entries")
      .insert({
        task_id: input.taskId,
        user_id: userId,
        minutes: input.minutes,
        note: input.note?.trim() || "",
      })
      .select()
      .single();

    if (error || !data) {
      console.error("Erro ao registrar tempo:", error);
      showToast("Não foi possível registrar o tempo.", "error");
      return false;
    }

    const mapped = mapTimeEntryRow(data);
    setEntries((prev) => (prev.some((e) => e.id === mapped.id) ? prev : [...prev, mapped]));
    return true;
  }, [tasks, clients, userId, showToast]);

  const handleUpdateTimeEntry = useCallback(async (entryId: string, updates: TimeEntryUpdate): Promise<boolean> => {
    const originalEntries = entries;
    setEntries((current) => current.map((e) => (e.id === entryId ? { ...e, ...updates } : e)));

    const databaseUpdates: Record<string, unknown> = {};
    if ("minutes" in updates) databaseUpdates.minutes = updates.minutes;
    if ("note" in updates) databaseUpdates.note = updates.note?.trim() || "";

    const { error } = await supabase.from("time_entries").update(databaseUpdates).eq("id", entryId);
    if (error) {
      console.error("Erro ao atualizar registro de tempo:", error);
      showToast("Não foi possível atualizar o registro de tempo.", "error");
      setEntries(originalEntries);
      return false;
    }
    return true;
  }, [entries, showToast]);

  const handleDeleteTimeEntry = useCallback(async (entryId: string): Promise<boolean> => {
    const originalEntries = entries;
    setEntries((current) => current.filter((e) => e.id !== entryId));

    const { error } = await supabase.from("time_entries").delete().eq("id", entryId);
    if (error) {
      console.error("Erro ao excluir registro de tempo:", error);
      showToast("Não foi possível excluir o registro de tempo.", "error");
      setEntries(originalEntries);
      return false;
    }
    return true;
  }, [entries, showToast]);

  return {
    entries,
    entriesLoading,
    entriesError,
    fetchTodayEntries,
    handleAddTimeEntry,
    handleUpdateTimeEntry,
    handleDeleteTimeEntry,
    clearEntries,
  };
}
