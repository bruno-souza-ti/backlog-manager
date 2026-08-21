import React, { useState } from "react";
import { X, Rocket, Loader2 } from "lucide-react";
import type { NewSprintInput } from "../types";
import { useModalDialog } from "../hooks/useModalDialog";
import { getCurrentDateStr } from "../utils";

interface NewSprintModalProps {
  onClose: () => void;
  onAddSprint: (sprint: NewSprintInput) => boolean | Promise<boolean>;
}

function defaultEndDate(startDate: string): string {
  const start = new Date(`${startDate}T00:00:00`);
  start.setDate(start.getDate() + 13);
  return start.toISOString().slice(0, 10);
}

export default function NewSprintModal({ onClose, onAddSprint }: NewSprintModalProps) {
  const dialogRef = useModalDialog(onClose);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState(getCurrentDateStr());
  const [endDate, setEndDate] = useState(() => defaultEndDate(getCurrentDateStr()));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !startDate || !endDate || endDate < startDate || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const created = await onAddSprint({ name: name.trim(), goal: goal.trim() || null, startDate, endDate });
      if (created) onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50" role="presentation">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="new-sprint-title" className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center bg-slate-50 dark:bg-zinc-950">
          <div className="flex items-center gap-2">
            <Rocket className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h3 id="new-sprint-title" className="font-display font-bold text-base text-slate-900 dark:text-white">
              Novo Sprint
            </h3>
          </div>
          <button
            type="button"
            aria-label="Fechar criação de sprint"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 bg-white dark:bg-zinc-900">
          <div>
            <label htmlFor="new-sprint-name" className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
              Nome
            </label>
            <input
              type="text"
              id="new-sprint-name"
              autoFocus
              required
              placeholder="Ex: Sprint 14"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs text-slate-900 dark:text-zinc-200 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          <div>
            <label htmlFor="new-sprint-goal" className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
              Meta (Opcional)
            </label>
            <textarea
              id="new-sprint-goal"
              placeholder="Ex: Fechar as entregas do onboarding de dois clientes novos."
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full h-20 p-3 text-xs text-slate-900 dark:text-zinc-200 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 resize-none font-sans"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="new-sprint-start" className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                Início
              </label>
              <input
                type="date"
                id="new-sprint-start"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2.5 text-xs text-slate-900 dark:text-zinc-200 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
            <div>
              <label htmlFor="new-sprint-end" className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                Fim
              </label>
              <input
                type="date"
                id="new-sprint-end"
                required
                min={startDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2.5 text-xs text-slate-900 dark:text-zinc-200 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
          </div>
          {endDate < startDate && (
            <p role="alert" className="text-[11px] font-semibold text-red-600 dark:text-red-400">A data de fim não pode ser anterior à data de início.</p>
          )}

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
              disabled={isSubmitting || endDate < startDate}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors shadow cursor-pointer flex items-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isSubmitting ? "Criando..." : "Criar Sprint"}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
