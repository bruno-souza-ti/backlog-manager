import { useMemo } from "react";
import { AlertTriangle, Clock, Filter } from "lucide-react";
import { Client, Task, TaskUpdate, UrgencyLevel } from "../../types";
import { formatDate, getTaskUrgency, getUrgencyBadgeClasses, isDueToday, isOverdue } from "../../utils";

const URGENCY_LEVELS = ["Todas", "Sem Urgência", "Urgente", "Muito Urgente"] as const;
type UrgencyFilterValue = (typeof URGENCY_LEVELS)[number];

interface FocusTasksPanelProps {
  pendingTasks: Task[];
  clientsById: Map<string, Client>;
  urgencyFilter: UrgencyFilterValue;
  setUrgencyFilter: (level: UrgencyFilterValue) => void;
  taskScope: "mine" | "all";
  setTaskScope: (scope: "mine" | "all") => void;
  onToggleTaskDone: (taskId: string, done: boolean) => void;
  onUpdateTask: (taskId: string, updates: TaskUpdate) => Promise<boolean>;
}

function urgencyFilterActiveClasses(level: UrgencyLevel | "Todas"): string {
  if (level === "Muito Urgente") return "bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800/80 font-bold shadow-sm ring-1 ring-red-500/30";
  if (level === "Urgente") return "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800/80 font-bold shadow-sm ring-1 ring-amber-500/30";
  if (level === "Sem Urgência") return "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/80 font-bold shadow-sm ring-1 ring-emerald-500/30";
  return "bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-800/80 font-bold shadow-sm ring-1 ring-teal-500/30";
}

export default function FocusTasksPanel({
  pendingTasks,
  clientsById,
  urgencyFilter,
  setUrgencyFilter,
  taskScope,
  setTaskScope,
  onToggleTaskDone,
  onUpdateTask,
}: FocusTasksPanelProps) {
  const filteredFocusTasks = useMemo(
    () => pendingTasks.filter((t) => urgencyFilter === "Todas" || getTaskUrgency(t) === urgencyFilter),
    [pendingTasks, urgencyFilter]
  );

  const countsByLevel = useMemo(() => {
    const counts: Record<UrgencyFilterValue, number> = {
      Todas: pendingTasks.length,
      "Sem Urgência": 0,
      Urgente: 0,
      "Muito Urgente": 0,
    };
    pendingTasks.forEach((t) => {
      counts[getTaskUrgency(t)] += 1;
    });
    return counts;
  }, [pendingTasks]);

  return (
    <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-5 space-y-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-teal-500" />
          <h2 className="font-display font-bold text-base text-slate-900 dark:text-zinc-100">
            Foco de Hoje & Prazos Próximos
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
            {filteredFocusTasks.length} {filteredFocusTasks.length === 1 ? "tarefa" : "tarefas"}
          </span>
        </div>
      </div>

      {/* Urgency Filter Toggle Buttons */}
      <div className="flex flex-wrap items-center gap-2 pt-1 pb-1 border-y border-slate-100 dark:border-zinc-800/60">
        <div className="inline-flex rounded-xl border border-slate-200 dark:border-zinc-800 p-0.5 bg-slate-100 dark:bg-zinc-950" aria-label="Escopo das tarefas">
          {(["mine", "all"] as const).map((scope) => (
            <button
              key={scope}
              type="button"
              aria-pressed={taskScope === scope}
              onClick={() => setTaskScope(scope)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${taskScope === scope
                ? "bg-white dark:bg-zinc-800 text-teal-700 dark:text-teal-300 shadow-sm"
                : "text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"}`}
            >
              {scope === "mine" ? "Minhas tarefas" : "Geral"}
            </button>
          ))}
        </div>
        <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mr-1 flex items-center gap-1">
          <Filter className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          <span>Filtrar Urgência:</span>
        </span>
        {URGENCY_LEVELS.map((level) => {
          const isActive = urgencyFilter === level;
          const activeClass = isActive
            ? urgencyFilterActiveClasses(level)
            : "bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-800 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800";

          return (
            <button
              key={level}
              onClick={() => setUrgencyFilter(level)}
              className={`px-3 py-1.5 rounded-xl text-xs border transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${activeClass}`}
            >
              {level === "Muito Urgente" && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
              {level === "Urgente" && <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />}
              {level === "Sem Urgência" && <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />}
              <span>{level}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                isActive ? "bg-slate-200 dark:bg-black/40 text-slate-900 dark:text-white" : "bg-slate-200 dark:bg-zinc-800/80 text-slate-700 dark:text-zinc-400"
              }`}>
                {countsByLevel[level]}
              </span>
            </button>
          );
        })}
      </div>

      {filteredFocusTasks.length === 0 ? (
        <div className="py-6 text-center bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-900/30 rounded-xl">
          <p className="text-xs text-slate-500 dark:text-zinc-500 italic">
            {urgencyFilter === "Todas"
              ? "Nenhuma tarefa pendente encontrada. Ótimo trabalho!"
              : `Nenhuma tarefa com o status "${urgencyFilter}" no momento.`}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-zinc-800/60 max-h-72 overflow-y-auto pr-1">
          {filteredFocusTasks.map((task) => {
            const client = task.clientId ? clientsById.get(task.clientId) : undefined;
            const urgency = getTaskUrgency(task);
            const taskOverdue = isOverdue(task.deadline, task.column);
            const taskDueToday = isDueToday(task.deadline) && task.column !== "done";

            return (
              <div
                key={task.id}
                className={`flex items-center justify-between py-3 px-2 rounded-xl transition-colors duration-150 gap-4 group ${
                  taskOverdue
                    ? "bg-red-50 dark:bg-red-950/10 hover:bg-red-100 dark:hover:bg-red-950/20 border-l-2 border-l-red-500"
                    : taskDueToday
                    ? "bg-amber-50 dark:bg-amber-950/10 hover:bg-amber-100 dark:hover:bg-amber-950/20 border-l-2 border-l-amber-500"
                    : "hover:bg-slate-100 dark:hover:bg-zinc-900/40"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={task.column === "done"}
                    onChange={(e) => onToggleTaskDone(task.id, e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-teal-600 focus:ring-teal-500 cursor-pointer accent-teal-600"
                  />
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800 dark:text-zinc-200 line-clamp-1 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                      {task.title}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  {client && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded border text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-900/30">
                      {client.name}
                    </span>
                  )}
                  <select
                    aria-label={`Urgência da tarefa ${task.title}`}
                    value={task.urgency ?? "automatic"}
                    onChange={(event) => onUpdateTask(task.id, {
                      urgency: event.target.value === "automatic" ? null : event.target.value as UrgencyLevel,
                    })}
                    className={`max-w-full text-[10px] font-semibold px-2 py-1 rounded border outline-none cursor-pointer ${getUrgencyBadgeClasses(urgency)}`}
                  >
                    <option value="automatic">Automática · {urgency}</option>
                    <option value="Sem Urgência">Sem Urgência</option>
                    <option value="Urgente">Urgente</option>
                    <option value="Muito Urgente">Muito Urgente</option>
                  </select>

                  {taskOverdue ? (
                    <span
                      className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800/80 flex items-center gap-1 shadow-sm ring-1 ring-red-500/30"
                      title={`Atrasada (Venceu em ${formatDate(task.deadline)})`}
                    >
                      <AlertTriangle className="w-3 h-3 text-red-500 dark:text-red-400 shrink-0" />
                      <span>Atrasada ({formatDate(task.deadline)})</span>
                    </span>
                  ) : taskDueToday ? (
                    <span
                      className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800/80 flex items-center gap-1 shadow-sm ring-1 ring-amber-500/30"
                      title={`Vence Hoje (${formatDate(task.deadline)})`}
                    >
                      <Clock className="w-3 h-3 text-amber-500 dark:text-amber-400 shrink-0" />
                      <span>Hoje ({formatDate(task.deadline)})</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono font-medium text-slate-500 dark:text-zinc-400 hidden sm:inline-flex items-center gap-1 bg-slate-100 dark:bg-zinc-950/50 px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-800/60">
                      <Clock className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
                      <span>{formatDate(task.deadline)}</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
