import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { NewSprintInput, Sprint } from "../types";
import { mapSprintRow } from "../lib/sprintMappers";
import { useToast } from "../components/common/ToastProvider";

/**
 * Owns the `sprints` slice of app state — mirrors useTasksData.ts's shape
 * (fetch, realtime sync, optimistic writes with rollback). Sprint
 * *membership* changes (a task's sprintId) arrive through the existing
 * tasks-realtime channel since sprint_id is just another task column; this
 * hook only needs to hear about the sprints table itself.
 */
export function useSprintsData(userId?: string) {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [sprintsLoading, setSprintsLoading] = useState(true);
  const [sprintsError, setSprintsError] = useState<string | null>(null);
  const { showToast } = useToast();
  const clearSprints = useCallback(() => setSprints([]), []);

  const fetchSprints = useCallback(async () => {
    setSprintsLoading(true);
    setSprintsError(null);
    const { data, error } = await supabase.from("sprints").select("*").order("start_date", { ascending: true });
    if (error) {
      console.error("Erro ao carregar sprints:", error);
      showToast("Não foi possível carregar os sprints.", "error");
      setSprintsError("Não foi possível carregar os sprints.");
      setSprintsLoading(false);
      return;
    }
    setSprints((data || []).map(mapSprintRow));
    setSprintsLoading(false);
  }, [showToast]);

  useEffect(() => {
    const channel = supabase
      .channel("sprints-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sprints" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldRow = payload.old as { id: string };
            setSprints((prev) => prev.filter((s) => s.id !== oldRow.id));
            return;
          }

          const mapped = mapSprintRow(payload.new as Parameters<typeof mapSprintRow>[0]);
          setSprints((prev) => {
            const exists = prev.some((s) => s.id === mapped.id);
            const next = exists ? prev.map((s) => (s.id === mapped.id ? mapped : s)) : [...prev, mapped];
            return next.sort((a, b) => a.startDate.localeCompare(b.startDate));
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleAddSprint = useCallback(async (input: NewSprintInput): Promise<boolean> => {
    const { data, error } = await supabase
      .from("sprints")
      .insert({
        name: input.name,
        goal: input.goal || null,
        start_date: input.startDate,
        end_date: input.endDate,
        created_by: userId,
      })
      .select()
      .single();

    if (error || !data) {
      console.error("Erro ao criar sprint:", error);
      showToast("Não foi possível criar o sprint.", "error");
      return false;
    }
    setSprints((prev) => [...prev, mapSprintRow(data)].sort((a, b) => a.startDate.localeCompare(b.startDate)));
    return true;
  }, [userId, showToast]);

  const handleUpdateSprint = useCallback(async (sprintId: string, updates: Partial<NewSprintInput>): Promise<boolean> => {
    const originalSprints = sprints;
    setSprints((current) => current.map((sprint) => sprint.id === sprintId ? { ...sprint, ...updates } : sprint));

    const databaseUpdates: Record<string, unknown> = {};
    if ("name" in updates) databaseUpdates.name = updates.name;
    if ("goal" in updates) databaseUpdates.goal = updates.goal || null;
    if ("startDate" in updates) databaseUpdates.start_date = updates.startDate;
    if ("endDate" in updates) databaseUpdates.end_date = updates.endDate;

    const { error } = await supabase.from("sprints").update(databaseUpdates).eq("id", sprintId);
    if (error) {
      console.error("Erro ao atualizar sprint:", error);
      showToast("Não foi possível atualizar o sprint.", "error");
      setSprints(originalSprints);
      return false;
    }
    return true;
  }, [sprints, showToast]);

  const handleDeleteSprint = useCallback(async (sprintId: string): Promise<boolean> => {
    const originalSprints = sprints;
    setSprints((current) => current.filter((sprint) => sprint.id !== sprintId));

    const { error } = await supabase.from("sprints").delete().eq("id", sprintId);
    if (error) {
      console.error("Erro ao excluir sprint:", error);
      showToast("Não foi possível excluir o sprint.", "error");
      setSprints(originalSprints);
      return false;
    }
    return true;
  }, [sprints, showToast]);

  return {
    sprints,
    sprintsLoading,
    sprintsError,
    fetchSprints,
    handleAddSprint,
    handleUpdateSprint,
    handleDeleteSprint,
    clearSprints,
  };
}
