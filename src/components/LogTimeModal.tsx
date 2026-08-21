import React, { useState } from "react";
import { Clock, Loader2, X } from "lucide-react";
import type { Client, NewTimeEntryInput, Task } from "../types";
import { useModalDialog } from "../hooks/useModalDialog";
import { isClientReadOnly } from "../lib/clientLifecycle";
import Select from "./common/Select";

interface LogTimeModalProps {
  onClose: () => void;
  onLogTime: (input: NewTimeEntryInput) => boolean | Promise<boolean>;
  /** Set from a Kanban card — the task is already obvious from context, shown as locked text. */
  lockedTask?: Task;
  /** Only needed in picker mode (no lockedTask) — e.g. the Dashboard "Meu Dia" widget, which has no single task in context. */
  tasks?: Task[];
  clients?: Client[];
}

const QUICK_MINUTES = [15, 30, 60, 90];

export default function LogTimeModal({ onClose, onLogTime, lockedTask, tasks = [], clients = [] }: LogTimeModalProps) {
  const dialogRef = useModalDialog(onClose);
  const clientsById = new Map(clients.map((c) => [c.id, c]));
  const pickableTasks = tasks.filter((t) => {
    const client = t.clientId ? clientsById.get(t.clientId) : undefined;
    return t.column !== "done" && !(client && isClientReadOnly(client));
  });

  const [taskId, setTaskId] = useState(lockedTask?.id || "");
  const [minutes, setMinutes] = useState(30);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskId || minutes <= 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const logged = await onLogTime({ taskId, minutes, note: note.trim() || undefined });
      if (logged) onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50" role="presentation">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="log-time-title" className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 w-full max-w-sm rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center bg-slate-50 dark:bg-zinc-950">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h3 id="log-time-title" className="font-display font-bold text-base text-slate-900 dark:text-white">
              Registrar Tempo
            </h3>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 bg-white dark:bg-zinc-900">
          <div>
            <label htmlFor="log-time-task" className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
              Tarefa
            </label>
            {lockedTask ? (
              <div id="log-time-task" className="w-full px-3.5 py-2.5 text-xs text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-950/60 border border-slate-200 dark:border-zinc-800 rounded-xl truncate">
                {lockedTask.title}
              </div>
            ) : (
              <Select
                id="log-time-task"
                value={taskId}
                onChange={setTaskId}
                placeholder="Selecione uma tarefa"
                triggerClassName="px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl"
                options={pickableTasks.map((t) => ({ value: t.id, label: t.title }))}
              />
            )}
          </div>

          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
              Quanto tempo?
            </span>
            <div className="grid grid-cols-4 gap-2">
              {QUICK_MINUTES.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={minutes === value}
                  onClick={() => setMinutes(value)}
                  className={`py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    minutes === value
                      ? "bg-teal-600 text-white"
                      : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  {value < 60 ? `${value}min` : `${value / 60}h`}
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={1440}
                value={minutes}
                onChange={(e) => setMinutes(Math.max(0, Number(e.target.value)))}
                aria-label="Minutos personalizados"
                className="w-24 px-3 py-2 text-xs text-slate-900 dark:text-zinc-200 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
              />
              <span className="text-xs text-slate-500 dark:text-zinc-500">minutos personalizados</span>
            </div>
          </div>

          <div>
            <label htmlFor="log-time-note" className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
              Nota (Opcional)
            </label>
            <input
              type="text"
              id="log-time-note"
              placeholder="Ex: Ajuste no fluxo de resposta automática"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              className="w-full px-3.5 py-2.5 text-xs text-slate-900 dark:text-zinc-200 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !taskId || minutes <= 0}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors shadow cursor-pointer flex items-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isSubmitting ? "Registrando..." : "Registrar"}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
