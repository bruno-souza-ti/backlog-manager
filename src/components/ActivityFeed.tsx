import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { formatTimeAgo } from "../utils";
import { Activity, Loader2 } from "lucide-react";

const FEED_LIMIT = 15;

interface ActivityLogRow {
  id: string;
  description: string;
  action_type: string;
  created_at: string;
}

export default function ActivityFeed() {
  const [entries, setEntries] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase
      .from("activity_log")
      .select("id, description, action_type, created_at")
      .order("created_at", { ascending: false })
      .limit(FEED_LIMIT)
      .then(({ data }) => {
        if (active && data) setEntries(data as ActivityLogRow[]);
        if (active) setLoading(false);
      });

    const channel = supabase
      .channel("activity-log-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_log" },
        (payload) => {
          const row = payload.new as ActivityLogRow;
          setEntries((prev) => [row, ...prev].slice(0, FEED_LIMIT));
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-teal-600 dark:text-teal-400" />
        <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">
          Atividade Recente
        </h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-teal-500" />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-zinc-500 italic py-2">Nenhuma atividade registrada ainda.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-zinc-800/60 max-h-72 overflow-y-auto pr-1">
          {entries.map((entry) => (
            <li key={entry.id} className="py-2 text-xs text-slate-700 dark:text-zinc-300 flex items-center justify-between gap-3">
              <span className="truncate">{entry.description}</span>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 shrink-0">
                {formatTimeAgo(entry.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
