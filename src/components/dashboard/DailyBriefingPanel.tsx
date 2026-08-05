import { useMemo } from "react";
import {
  AlertTriangle,
  Ban,
  Clock,
  Timer,
  CheckCircle2,
  ChevronRight,
  Zap,
} from "lucide-react";
import { Client, Task } from "../../types";
import {
  BriefingItem,
  BriefingItemType,
  BriefingPriority,
  computeDailyBriefing,
} from "../../lib/dailyBriefing";

// ── Style helpers ─────────────────────────────────────────────────────────────

interface PriorityStyle {
  dot: string;
  text: string;
  itemBg: string;
  badge: string;
  sectionLabel: string;
  sectionEmoji: string;
}

function getPriorityStyle(priority: BriefingPriority): PriorityStyle {
  switch (priority) {
    case "critical":
      return {
        dot: "bg-red-500",
        text: "text-red-600 dark:text-red-400",
        itemBg:
          "bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 hover:bg-red-100 dark:hover:bg-red-950/30",
        badge:
          "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/40",
        sectionLabel: "Ação Imediata",
        sectionEmoji: "🔴",
      };
    case "high":
      return {
        dot: "bg-amber-500",
        text: "text-amber-600 dark:text-amber-400",
        itemBg:
          "bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-950/30",
        badge:
          "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40",
        sectionLabel: "Atenção",
        sectionEmoji: "🟡",
      };
    default:
      return {
        dot: "bg-blue-500",
        text: "text-blue-600 dark:text-blue-400",
        itemBg:
          "bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-950/30",
        badge:
          "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40",
        sectionLabel: "Acompanhar",
        sectionEmoji: "🔵",
      };
  }
}

function getItemIcon(type: BriefingItemType) {
  switch (type) {
    case "overdue_task":
      return <AlertTriangle className="w-3.5 h-3.5" />;
    case "blocked_task":
      return <Ban className="w-3.5 h-3.5" />;
    case "due_today":
      return <Clock className="w-3.5 h-3.5" />;
    case "stalled_client":
      return <Timer className="w-3.5 h-3.5" />;
    default:
      return <Zap className="w-3.5 h-3.5" />;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface DailyBriefingPanelProps {
  clients: Client[];
  tasks: Task[];
  onSelectClient: (clientId: string) => void;
}

const SECTIONS: { priority: BriefingPriority }[] = [
  { priority: "critical" },
  { priority: "high" },
  { priority: "medium" },
];

export default function DailyBriefingPanel({
  clients,
  tasks,
  onSelectClient,
}: DailyBriefingPanelProps) {
  const briefing = useMemo(() => computeDailyBriefing(clients, tasks), [clients, tasks]);

  // ── All clear state ────────────────────────────────────────────────────────
  if (briefing.isEmpty) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-zinc-100">
            Operação em dia!
          </p>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Nenhuma tarefa atrasada, bloqueada ou cliente sem movimentação.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-teal-500 animate-pulse shrink-0" />
          <h2 className="font-display font-bold text-base text-slate-900 dark:text-zinc-100">
            Minha Prioridade Hoje
          </h2>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {briefing.criticalCount > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/40">
              {briefing.criticalCount} crítico{briefing.criticalCount !== 1 ? "s" : ""}
            </span>
          )}
          {briefing.highCount > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40">
              {briefing.highCount} urgente{briefing.highCount !== 1 ? "s" : ""}
            </span>
          )}
          {briefing.mediumCount > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40">
              {briefing.mediumCount} atenção
            </span>
          )}
        </div>
      </div>

      {/* ── Sections ───────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        {SECTIONS.map(({ priority }) => {
          const sectionItems = briefing.items.filter((i) => i.priority === priority);
          if (sectionItems.length === 0) return null;
          const style = getPriorityStyle(priority);

          return (
            <div key={priority}>
              {/* Section label */}
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[11px]">{style.sectionEmoji}</span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  {style.sectionLabel}
                </span>
                <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                  ({sectionItems.length})
                </span>
              </div>

              {/* Items */}
              <div className="space-y-1.5">
                {sectionItems.map((item: BriefingItem) => (
                  <button
                    key={item.id}
                    onClick={() => onSelectClient(item.clientId)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 cursor-pointer ${style.itemBg}`}
                  >
                    {/* Type icon */}
                    <span className={`shrink-0 ${style.text}`}>
                      {getItemIcon(item.type)}
                    </span>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate leading-snug">
                        {item.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${style.badge}`}>
                          {item.clientName}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                          {item.detail}
                        </span>
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
