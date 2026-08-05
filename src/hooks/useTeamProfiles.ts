import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Profile } from "../types";

const PROFILE_COLUMNS = "id, full_name, email, avatar_color, role, status, current_client_id, status_updated_at";

/**
 * Loads team profiles once and keeps them live via Supabase Realtime
 * (status, current_client_id, status_updated_at change on other people's
 * sessions all the time, and the UI needs to reflect that without a reload).
 *
 * This is the single source of truth for team profiles — components should
 * consume this hook instead of querying the `profiles` table themselves.
 */
export function useTeamProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    supabase.from("profiles").select(PROFILE_COLUMNS).order("full_name").then(({ data, error: fetchError }) => {
      if (!active) return;
      if (fetchError) {
        console.error("Erro ao carregar perfis da equipe:", fetchError);
        setError("Não foi possível carregar os perfis da equipe.");
      } else if (data) {
        setProfiles(data as Profile[]);
      }
      setLoading(false);
    });

    const channel = supabase
      .channel(`profiles-realtime-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (payload) => {
          setProfiles((prev) => {
            if (payload.eventType === "DELETE") {
              const oldRow = payload.old as Partial<Profile>;
              return prev.filter((p) => p.id !== oldRow.id);
            }
            const updated = payload.new as Profile;
            const exists = prev.some((p) => p.id === updated.id);
            const next = exists
              ? prev.map((p) => (p.id === updated.id ? updated : p))
              : [...prev, updated];
            return [...next].sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
          });
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { profiles, loading, error };
}
