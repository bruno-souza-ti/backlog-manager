import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Task, NotesHistoryItem, ClientFile } from "../types";
import {
  buildClientTimeline,
  MeetingTimelineRow,
  TimelineEvent,
} from "../lib/clientTimeline";

export function useClientTimeline(
  clientId: string,
  /** Already filtered to this client */
  clientTasks: Task[],
  notesHistory: NotesHistoryItem[],
  files: ClientFile[],
  /** While true, notesHistory/files are still loading — defer timeline build */
  detailsLoading: boolean
): { events: TimelineEvent[]; timelineLoading: boolean } {
  const [meetings, setMeetings] = useState<MeetingTimelineRow[]>([]);
  const [clientCreatedAt, setClientCreatedAt] = useState<string | null>(null);
  const [fetchLoading, setFetchLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    let active = true;
    setFetchLoading(true);

    Promise.all([
      supabase
        .from("meetings")
        .select("id, title, occurred_at")
        .eq("client_id", clientId)
        .order("occurred_at", { ascending: false }),
      supabase
        .from("clients")
        .select("created_at")
        .eq("id", clientId)
        .single(),
    ]).then(([meetingsRes, clientRes]) => {
      if (!active) return;
      setMeetings((meetingsRes.data as MeetingTimelineRow[]) ?? []);
      setClientCreatedAt(
        (clientRes.data as { created_at: string } | null)?.created_at ?? null
      );
      setFetchLoading(false);
    });

    return () => {
      active = false;
    };
  }, [clientId]);

  const events = useMemo<TimelineEvent[]>(() => {
    if (fetchLoading || detailsLoading) return [];
    return buildClientTimeline({
      clientId,
      clientCreatedAt,
      tasks: clientTasks,
      notesHistory,
      files,
      meetings,
    });
  }, [
    fetchLoading,
    detailsLoading,
    clientId,
    clientCreatedAt,
    clientTasks,
    notesHistory,
    files,
    meetings,
  ]);

  return { events, timelineLoading: fetchLoading || detailsLoading, meetings };
}
