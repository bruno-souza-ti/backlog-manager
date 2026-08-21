import { useMemo, useState } from "react";
import { CheckCircle2, Plus, Timer, Trash2 } from "lucide-react";
import type { Client, NewTimeEntryInput, Task, TimeEntry } from "../../types";
import LogTimeModal from "../LogTimeModal";

interface MyDayHoursPanelProps {
  entries: TimeEntry[];
  tasks: Task[];
  clients: Client[];
  currentUserId: string;
  expectedDailyMinutes: number;
  onLogTime: (input: NewTimeEntryInput) => boolean | Promise<boolean>;
  onDeleteTimeEntry: (entryId: string) => boolean | Promise<boolean>;
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h${String(mins).padStart(2, "0")}`;
}

export default function MyDayHoursPanel({
  entries,
  tasks,
  clients,
  currentUserId,
  expectedDailyMinutes,
  onLogTime,
  onDeleteTimeEntry,
}: MyDayHoursPanelProps) {
  const [showLogModal, setShowLogModal] = useState(false);
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const myEntries = useMemo(
    () => entries.filter((e) => e.userId === currentUserId).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
    [entries, currentUserId]
  );
  const totalMinutes = useMemo(() => myEntries.reduce((sum, e) => sum + e.minutes, 0), [myEntries]);
  const progressPercent = Math.min(100, Math.round((totalMinutes / expectedDailyMinutes) * 100));
  const metGoal = totalMinutes >= expectedDailyMinutes;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <h2 className="font-display font-bold text-base text-slate-900 dark:text-zinc-100">
            Meu Dia — Horas
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setShowLogModal(true)}
          className="px-2.5 py-1.5 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-teal-200 dark:border-teal-900/40 hover:bg-teal-100 dark:hover:bg-teal-950/60 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Registrar tempo</span>
        </button>
      </div>

      <div>
        <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1.5">
          <span>{formatMinutes(totalMinutes)} de {formatMinutes(expectedDailyMinutes)} hoje</span>
          <span className="text-slate-900 dark:text-zinc-200">{progressPercent}%</span>
        </div>
        <div className="w-full bg-slate-100 dark:bg-zinc-950 h-2 rounded-full overflow-hidden border border-slate-200 dark:border-zinc-800/50">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${metGoal ? "bg-gradient-to-r from-emerald-500 to-teal-500" : "bg-gradient-to-r from-teal-500 to-emerald-500"}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {myEntries.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-zinc-500 italic">Nenhum registro de tempo hoje ainda.</p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {myEntries.map((entry) => {
            const task = tasksById.get(entry.taskId);
            return (
              <div key={entry.id} className="group flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate">{task?.title || "Tarefa removida"}</p>
                  {entry.note && <p className="text-[10px] text-slate-500 dark:text-zinc-500 truncate">{entry.note}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400">
                    {formatMinutes(entry.minutes)}
                  </span>
                  <button
                    type="button"
                    aria-label="Excluir registro"
                    onClick={() => void onDeleteTimeEntry(entry.id)}
                    className="text-slate-400 opacity-0 transition-all hover:text-red-600 group-hover:opacity-100 dark:hover:text-red-400 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {metGoal && (
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Meta do dia batida!
        </p>
      )}

      {showLogModal && (
        <LogTimeModal
          tasks={tasks}
          clients={clients}
          onLogTime={onLogTime}
          onClose={() => setShowLogModal(false)}
        />
      )}
    </div>
  );
}
