import React, { useState } from "react";
import {
  UserPlus,
  PenLine,
  Pencil,
  ListPlus,
  CheckCircle2,
  Ban,
  Video,
  Upload,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
  History,
} from "lucide-react";
import { TimelineEvent, TimelineEventType } from "../lib/clientTimeline";

const INITIAL_SHOW = 8;

interface EventConfig {
  icon: React.ReactNode;
  iconBg: string;
}

function getEventConfig(type: TimelineEventType): EventConfig {
  switch (type) {
    case "client_created":
      return {
        icon: <UserPlus className="w-3.5 h-3.5" />,
        iconBg:
          "bg-teal-100 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-900/40",
      };
    case "note_saved":
      return {
        icon: <PenLine className="w-3.5 h-3.5" />,
        iconBg:
          "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/40",
      };
    case "note_edited":
      return {
        icon: <Pencil className="w-3.5 h-3.5" />,
        iconBg:
          "bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-900/40",
      };
    case "task_added":
      return {
        icon: <ListPlus className="w-3.5 h-3.5" />,
        iconBg:
          "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700",
      };
    case "task_completed":
      return {
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
        iconBg:
          "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40",
      };
    case "task_blocked":
      return {
        icon: <Ban className="w-3.5 h-3.5" />,
        iconBg:
          "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/40",
      };
    case "meeting_held":
      return {
        icon: <Video className="w-3.5 h-3.5" />,
        iconBg:
          "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900/40",
      };
    case "file_uploaded":
      return {
        icon: <Upload className="w-3.5 h-3.5" />,
        iconBg:
          "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40",
      };
    default:
      return {
        icon: <Clock className="w-3.5 h-3.5" />,
        iconBg:
          "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700",
      };
  }
}

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface ClientTimelineProps {
  events: TimelineEvent[];
  loading: boolean;
}

export default function ClientTimeline({ events, loading }: ClientTimelineProps) {
  const [expanded, setExpanded] = useState(false);

  const displayed = expanded ? events : events.slice(0, INITIAL_SHOW);
  const hiddenCount = events.length - INITIAL_SHOW;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-7 h-7 rounded-lg bg-teal-100 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900/40 flex items-center justify-center shrink-0">
          <History className="w-4 h-4 text-teal-600 dark:text-teal-400" />
        </div>
        <h3 className="font-display font-bold text-base text-slate-900 dark:text-zinc-100">
          Timeline do Cliente
        </h3>
        {!loading && (
          <span className="ml-auto text-[11px] font-mono text-slate-400 dark:text-zinc-500 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-zinc-700">
            {events.length} evento{events.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-teal-500" />
        </div>
      ) : events.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-zinc-500 italic text-center py-6">
          Nenhum evento registrado ainda.
        </p>
      ) : (
        <div>
          <div className="space-y-0">
            {displayed.map((event, index) => {
              const config = getEventConfig(event.type);
              const isLast = index === displayed.length - 1;

              return (
                <div key={event.id} className="flex items-start gap-3">
                  {/* Icon + vertical connector */}
                  <div className="flex flex-col items-center shrink-0">
                    <div
                      className={`w-8 h-8 rounded-xl border flex items-center justify-center z-10 ${config.iconBg}`}
                    >
                      {config.icon}
                    </div>
                    {!isLast && (
                      <div className="w-px flex-1 min-h-[20px] bg-slate-200 dark:bg-zinc-800 my-1" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200 leading-snug">
                          {event.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 line-clamp-2 leading-relaxed">
                          {event.description}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 shrink-0 font-mono mt-0.5">
                        {formatEventDate(event.date)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {hiddenCount > 0 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 py-2.5 rounded-xl hover:bg-teal-50 dark:hover:bg-teal-950/20 border border-transparent hover:border-teal-200 dark:hover:border-teal-900/40 transition-all duration-150 cursor-pointer"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  <span>Mostrar menos</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  <span>Ver {hiddenCount} evento{hiddenCount !== 1 ? "s" : ""} anteriores</span>
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
