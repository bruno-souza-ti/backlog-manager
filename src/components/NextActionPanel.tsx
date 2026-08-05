import React from "react";
import {
  AlertTriangle,
  Ban,
  Clock,
  Play,
  CalendarOff,
  ListStart,
  CheckCircle2,
  Zap,
  User,
} from "lucide-react";
import { NextAction, NextActionPriority, NextActionType } from "../lib/nextAction";
import { Profile } from "../types";
import { formatDate } from "../utils";

interface PriorityConfig {
  border: string;
  bg: string;
  badge: string;
  label: string;
  dot: string;
  iconBg: string;
}

function getPriorityConfig(priority: NextActionPriority): PriorityConfig {
  switch (priority) {
    case "critical":
      return {
        border: "border-red-200 dark:border-red-900/40",
        bg: "bg-red-50 dark:bg-red-950/20",
        badge: "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/40",
        iconBg: "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/40",
        label: "Crítico",
        dot: "bg-red-500",
      };
    case "high":
      return {
        border: "border-amber-200 dark:border-amber-900/40",
        bg: "bg-amber-50 dark:bg-amber-950/20",
        badge: "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40",
        iconBg: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40",
        label: "Alta",
        dot: "bg-amber-500",
      };
    case "medium":
      return {
        border: "border-blue-200 dark:border-blue-900/40",
        bg: "bg-blue-50 dark:bg-blue-950/20",
        badge: "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/40",
        iconBg: "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/40",
        label: "Média",
        dot: "bg-blue-500",
      };
    default:
      return {
        border: "border-emerald-200 dark:border-emerald-900/40",
        bg: "bg-emerald-50 dark:bg-emerald-950/20",
        badge: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40",
        iconBg: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40",
        label: "Baixa",
        dot: "bg-emerald-500",
      };
  }
}

function getActionIcon(type: NextActionType): React.ReactNode {
  switch (type) {
    case "overdue":
      return <AlertTriangle className="w-4 h-4" />;
    case "blocked":
      return <Ban className="w-4 h-4" />;
    case "due_today":
      return <Clock className="w-4 h-4" />;
    case "in_progress":
      return <Play className="w-4 h-4" />;
    case "no_activity":
      return <CalendarOff className="w-4 h-4" />;
    case "todo_pending":
      return <ListStart className="w-4 h-4" />;
    case "all_clear":
      return <CheckCircle2 className="w-4 h-4" />;
    default:
      return <Zap className="w-4 h-4" />;
  }
}

interface NextActionPanelProps {
  action: NextAction;
  profiles: Profile[];
}

export default function NextActionPanel({ action, profiles }: NextActionPanelProps) {
  const config = getPriorityConfig(action.priority);
  const assignee = action.assigneeId
    ? profiles.find((p) => p.id === action.assigneeId)
    : null;

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${config.bg} ${config.border}`}>
      <div className="flex items-start gap-3">
        {/* Action type icon */}
        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${config.iconBg}`}>
          {getActionIcon(action.type)}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400">
              Próxima Ação
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${config.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
              {config.label}
            </span>
          </div>

          {/* Action title */}
          <p className="text-sm font-bold text-slate-900 dark:text-zinc-100 leading-snug">
            {action.title}
          </p>

          {/* Action detail (task title, inactivity duration, etc.) */}
          <p className="text-xs text-slate-700 dark:text-zinc-300 mt-0.5 line-clamp-1">
            {action.detail}
          </p>

          {/* Meta row: deadline · assignee · reason */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
            {action.deadline && (
              <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-zinc-400">
                <Clock className="w-3 h-3 shrink-0" />
                <span>Prazo: {formatDate(action.deadline)}</span>
              </span>
            )}

            {assignee ? (
              <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-zinc-400">
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                  style={{ backgroundColor: assignee.avatar_color || "#14b8a6" }}
                >
                  {assignee.full_name.charAt(0).toUpperCase()}
                </div>
                <span>{assignee.full_name}</span>
              </span>
            ) : action.assigneeId ? (
              <span className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-zinc-500">
                <User className="w-3 h-3 shrink-0" />
                <span>Responsável não encontrado</span>
              </span>
            ) : null}

            <span className="text-[11px] italic text-slate-400 dark:text-zinc-500">
              {action.reason}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
