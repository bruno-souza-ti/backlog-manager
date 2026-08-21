import { memo } from "react";
import { CheckCircle2, Rocket } from "lucide-react";
import { Sprint, Task } from "../types";
import { formatDate } from "../utils";
import { computeSprintStatus, SPRINT_STATUS_META } from "../lib/sprintStatus";

interface SprintCardProps {
  sprint: Sprint;
  /** Tasks already scoped to this sprint (grouped once by the parent, not filtered per-card). */
  tasks: Task[];
  onClick: () => void;
}

function SprintCard({ sprint, tasks, onClick }: SprintCardProps) {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.column === "done").length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const status = computeSprintStatus(sprint);
  const statusMeta = SPRINT_STATUS_META[status];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Abrir sprint ${sprint.name}. Status ${statusMeta.label}.`}
      className="group w-full text-left bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 hover:shadow-xl hover:border-teal-500/50 dark:hover:border-teal-500/30 transition-all duration-300 cursor-pointer flex flex-col justify-between"
    >
      <div>
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-600 flex items-center justify-center text-white shrink-0">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-slate-900 dark:text-zinc-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors duration-200">
                {sprint.name}
              </h3>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-500 uppercase">
                {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}
              </span>
            </div>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border shrink-0 ${statusMeta.classes}`}>
            {statusMeta.label}
          </span>
        </div>

        {sprint.goal && (
          <p className="text-xs text-slate-600 dark:text-zinc-400 line-clamp-2 mb-6">
            {sprint.goal}
          </p>
        )}
      </div>

      <div>
        <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1.5">
          <span>Progresso</span>
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
    </button>
  );
}

export default memo(SprintCard);
