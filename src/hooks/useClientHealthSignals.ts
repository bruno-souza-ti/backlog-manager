import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/** Window used to count "task_moved" activity as recurring-change churn. */
const CHURN_WINDOW_DAYS = 14;

export interface ClientHealthSignals {
  /** clientId -> ISO timestamp of the most recent meeting on record. */
  lastMeetingAtByClient: Map<string, string>;
  /** clientId -> number of task_moved activity_log entries in the last CHURN_WINDOW_DAYS. */
  recentChangeCountByClient: Map<string, number>;
  loading: boolean;
}

interface MeetingRow {
  client_id: string | null;
  occurred_at: string;
}

interface ActivityRow {
  client_id: string | null;
}

/**
 * Feeds computeClientHealth() the two signals it can't get from already-loaded
 * clients/tasks: meeting cadence and recent task-column churn. Two small
 * aggregate queries, fetched once per session (not per client, not per card) —
 * the same shape as useClientsData/useTasksData's eager session-load pattern.
 */
export function useClientHealthSignals(userId?: string): ClientHealthSignals {
  const [lastMeetingAtByClient, setLastMeetingAtByClient] = useState<Map<string, string>>(new Map());
  const [recentChangeCountByClient, setRecentChangeCountByClient] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setLoading(true);

    const since = new Date(Date.now() - CHURN_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

    Promise.all([
      supabase.from("meetings").select("client_id, occurred_at").order("occurred_at", { ascending: false }),
      supabase.from("activity_log").select("client_id").eq("action_type", "task_moved").gte("created_at", since),
    ]).then(([meetingsRes, activityRes]) => {
      if (!active) return;

      const meetingsMap = new Map<string, string>();
      ((meetingsRes.data as MeetingRow[]) ?? []).forEach((row) => {
        if (!row.client_id) return;
        // Rows arrive ordered by occurred_at desc, so the first hit per client is the latest.
        if (!meetingsMap.has(row.client_id)) meetingsMap.set(row.client_id, row.occurred_at);
      });

      const changeMap = new Map<string, number>();
      ((activityRes.data as ActivityRow[]) ?? []).forEach((row) => {
        if (!row.client_id) return;
        changeMap.set(row.client_id, (changeMap.get(row.client_id) ?? 0) + 1);
      });

      setLastMeetingAtByClient(meetingsMap);
      setRecentChangeCountByClient(changeMap);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [userId]);

  return { lastMeetingAtByClient, recentChangeCountByClient, loading };
}
