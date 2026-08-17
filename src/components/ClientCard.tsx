import { memo } from "react";
import { Client, Task } from "../types";
import { ArrowRight, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { isOverdue, isDueToday, formatDate } from "../utils";
import { computeClientHealth, getHealthMeta } from "../lib/clientHealth";
import { CLIENT_LIFECYCLE_META, getClientLifecycleKey } from "../lib/clientLifecycle";

interface ClientCardProps {
  client: Client;
  /** Tasks already scoped to this client (grouped once by the parent, not filtered per-card). */
  tasks: Task[];
  /** ISO timestamp of the client's most recent meeting, if known (see useClientHealthSignals). */
  lastMeetingAt?: string;
  /** task_moved activity_log entries for this client in the last 14 days (see useClientHealthSignals). */
  recentChangeCount?: number;
  onClick: () => void;
}

function ClientCard({ client, tasks, lastMeetingAt, recentChangeCount, onClick }: ClientCardProps) {
  const clientTasks = tasks;
  const totalTasks = clientTasks.length;
  const completedTasks = clientTasks.filter((t) => t.column === "done").length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Compute overdue and due today counts (still shown as their own badges below)
  const overdueTasksCount = clientTasks.filter((t) => isOverdue(t.deadline, t.column)).length;
  const upcomingTasksCount = clientTasks.filter((t) => !isOverdue(t.deadline, t.column) && isDueToday(t.deadline) && t.column !== "done").length;

  const health = computeClientHealth({ tasks: clientTasks, lastMeetingAt, recentChangeCount });
  const healthMeta = getHealthMeta(health.level);
  const lifecycleMeta = CLIENT_LIFECYCLE_META[getClientLifecycleKey(client)];

  // Latest interaction date based on history
  const latestInteraction = client.notesHistory && client.notesHistory.length > 0 
    ? client.notesHistory[0].date 
    : null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Abrir detalhes de ${client.name}. Saúde ${healthMeta.label}.`}
      className="group w-full text-left bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 hover:shadow-xl hover:border-teal-500/50 dark:hover:border-teal-500/30 transition-all duration-300 cursor-pointer flex flex-col justify-between relative overflow-hidden"
    >
      {/* Visual background indicator if critical alerts are present */}
      {overdueTasksCount > 0 && (
        <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl pointer-events-none" />
      )}

      <div>
        {/* Card Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${client.logoColor} flex items-center justify-center text-white font-bold relative shrink-0`}>
              {client.name.substring(0, 2).toUpperCase()}
              {overdueTasksCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-zinc-900">
                  {overdueTasksCount}
                </span>
              )}
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-slate-900 dark:text-zinc-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors duration-200">
                {client.name}
              </h3>
              <span className={`inline-flex mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${lifecycleMeta.badgeClasses}`}>
                {lifecycleMeta.label}
              </span>
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                {latestInteraction ? (
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-500 uppercase">
                    Atualizado {formatDate(latestInteraction)}
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-600 uppercase">
                    Sem interações
                  </span>
                )}
                {overdueTasksCount > 0 && (
                  <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/40" title="Tarefas atrasadas">
                    <AlertTriangle className="w-2.5 h-2.5 text-red-500 dark:text-red-400" />
                    <span>{overdueTasksCount} Vencida{overdueTasksCount > 1 ? "s" : ""}</span>
                  </span>
                )}
                {upcomingTasksCount > 0 && (
                  <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40" title="Tarefas vencendo hoje">
                    <Clock className="w-2.5 h-2.5 text-amber-500 dark:text-amber-400" />
                    <span>{upcomingTasksCount} Hoje</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold border shrink-0 ${healthMeta.badgeClasses}`}
            title={health.reasons.join(" • ")}
          >
            {healthMeta.emoji} {healthMeta.label}
          </span>
        </div>

        {/* Notes preview snippet */}
        <p className="text-xs text-slate-600 dark:text-zinc-400 line-clamp-2 mb-6">
          {client.notes || "Sem anotações no momento."}
        </p>
      </div>

      {/* Progress & Bottom Actions */}
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1.5">
            <span>Progresso Geral</span>
            <span className="text-slate-900 dark:text-zinc-200">{progressPercent}%</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-zinc-950 h-2 rounded-full overflow-hidden border border-slate-200 dark:border-zinc-800/50">
            <div
              className="bg-gradient-to-r from-teal-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] font-medium text-slate-500 dark:text-zinc-500 mt-1.5">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              {completedTasks} de {totalTasks} tarefas feitas
            </span>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex justify-end items-center">
          <span className="text-xs font-semibold text-slate-600 dark:text-zinc-400 group-hover:text-slate-900 dark:group-hover:text-zinc-200 flex items-center gap-1 transition-colors duration-200">
            Acessar Detalhes
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-200" />
          </span>
        </div>
      </div>
    </button>
  );
}

export default memo(ClientCard);
