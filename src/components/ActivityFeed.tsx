import { useEffect, useState } from "react";
import {
  Activity,
  Loader2,
  ListPlus,
  CheckCircle2,
  ArrowRightLeft,
  Trash2,
  Video,
  FileVideo,
  Upload,
  AlertTriangle,
  RefreshCcw,
  UserPlus,
  UserCog,
  UserCheck,
  UserMinus,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { formatTimeAgo } from "../utils";
import { ActivityActionType } from "../lib/activityLog";
import { ActivityLogRow, mergeActivityEntries } from "../lib/activityFeed";

const FEED_LIMIT = 15;

interface ActivityIconConfig {
  icon: React.ReactNode;
  iconBg: string;
}

/** Mirrors ClientTimeline's getEventConfig — same pattern, different (broader) event vocabulary. */
function getActivityIconConfig(type: string): ActivityIconConfig {
  switch (type as ActivityActionType) {
    case "task_created":
      return {
        icon: <ListPlus className="w-3.5 h-3.5" />,
        iconBg: "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700",
      };
    case "task_completed":
      return {
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
        iconBg: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40",
      };
    case "task_moved":
      return {
        icon: <ArrowRightLeft className="w-3.5 h-3.5" />,
        iconBg: "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/40",
      };
    case "task_deleted":
      return {
        icon: <Trash2 className="w-3.5 h-3.5" />,
        iconBg: "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/40",
      };
    case "meeting_started":
    case "meeting_ended":
      return {
        icon: <Video className="w-3.5 h-3.5" />,
        iconBg: "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900/40",
      };
    case "meeting_recorded":
      return {
        icon: <FileVideo className="w-3.5 h-3.5" />,
        iconBg: "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900/40",
      };
    case "file_uploaded":
      return {
        icon: <Upload className="w-3.5 h-3.5" />,
        iconBg: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40",
      };
    case "client_at_risk":
      return {
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
        iconBg: "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/40",
      };
    case "client_lifecycle_changed":
      return {
        icon: <RefreshCcw className="w-3.5 h-3.5" />,
        iconBg: "bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-900/40",
      };
    case "team_invited":
    case "team_invite_resent":
      return {
        icon: <UserPlus className="w-3.5 h-3.5" />,
        iconBg: "bg-teal-100 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-900/40",
      };
    case "team_role_changed":
      return {
        icon: <UserCog className="w-3.5 h-3.5" />,
        iconBg: "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/40",
      };
    case "team_access_activated":
      return {
        icon: <UserCheck className="w-3.5 h-3.5" />,
        iconBg: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40",
      };
    case "team_access_deactivated":
      return {
        icon: <UserMinus className="w-3.5 h-3.5" />,
        iconBg: "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/40",
      };
    default:
      return {
        icon: <Activity className="w-3.5 h-3.5" />,
        iconBg: "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700",
      };
  }
}

export default function ActivityFeed() {
  const [entries, setEntries] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const { data, error } = await supabase
          .from("activity_log")
          .select("id, description, action_type, created_at")
          .order("created_at", { ascending: false })
          .limit(FEED_LIMIT);
        if (!active) return;
        if (error) {
          console.error("Erro ao carregar feed de atividades:", error);
        } else if (data) {
          // Merge, don't overwrite: a Realtime row may have already arrived
          // (and been added to `entries`) while this query was in flight.
          setEntries((prev) => mergeActivityEntries(prev, data as ActivityLogRow[], FEED_LIMIT));
        }
        setLoading(false);
      } catch (err: unknown) {
        if (!active) return;
        console.error("Erro ao carregar feed de atividades:", err);
        setLoading(false);
      }
    })();

    const channel = supabase
      .channel("activity-log-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_log" },
        (payload) => {
          const row = payload.new as ActivityLogRow;
          setEntries((prev) => mergeActivityEntries(prev, [row], FEED_LIMIT));
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
          {entries.map((entry) => {
            const config = getActivityIconConfig(entry.action_type);
            return (
              <li key={entry.id} className="py-2 flex items-center gap-2.5">
                <span className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 ${config.iconBg}`}>
                  {config.icon}
                </span>
                <span className="flex-1 min-w-0 text-xs text-slate-700 dark:text-zinc-300 truncate">
                  {entry.description}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 shrink-0">
                  {formatTimeAgo(entry.created_at)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
