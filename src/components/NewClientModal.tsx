import React, { useState } from "react";
import { X, Sparkles, Loader2 } from "lucide-react";
import type { NewClientInput } from "../types";
import { useModalDialog } from "../hooks/useModalDialog";

interface NewClientModalProps {
  onClose: () => void;
  onAddClient: (client: NewClientInput) => boolean | Promise<boolean>;
}

export default function NewClientModal({ onClose, onAddClient }: NewClientModalProps) {
  const dialogRef = useModalDialog(onClose);
  const [name, setName] = useState("");
  const [colorTemplate, setColorTemplate] = useState("from-violet-500 to-indigo-600");
  const [initialNotes, setInitialNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const colorTemplates = [
    { value: "from-teal-500 to-emerald-600", label: "Menta / Teal", bg: "bg-gradient-to-tr from-teal-500 to-emerald-600" },
    { value: "from-emerald-500 to-teal-600", label: "Verde Esmeralda", bg: "bg-gradient-to-tr from-emerald-500 to-teal-600" },
    { value: "from-amber-500 to-orange-600", label: "Laranja Solar", bg: "bg-gradient-to-tr from-amber-500 to-orange-600" },
    { value: "from-blue-500 to-cyan-600", label: "Azul Elétrico", bg: "bg-gradient-to-tr from-blue-500 to-cyan-600" },
    { value: "from-fuchsia-500 to-pink-600", label: "Rosa Fuschia", bg: "bg-gradient-to-tr from-fuchsia-500 to-pink-600" },
    { value: "from-red-500 to-rose-600", label: "Vermelho Crítico", bg: "bg-gradient-to-tr from-red-500 to-rose-600" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const created = await onAddClient({
        name,
        logoColor: colorTemplate,
        notes: initialNotes || `Novas notas criadas em ${new Date().toLocaleDateString()}. Digite anotações de reuniões para este cliente.`,
      });
      if (created) onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50" role="presentation">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="new-client-title" className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center bg-slate-50 dark:bg-zinc-950">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h3 id="new-client-title" className="font-display font-bold text-base text-slate-900 dark:text-white">
              Adicionar Novo Cliente
            </h3>
          </div>
          <button
            type="button"
            aria-label="Fechar criação de cliente"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 bg-white dark:bg-zinc-900">
          <div>
            <label htmlFor="new-client-name" className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
              Nome da Empresa / Projeto
            </label>
            <input
              type="text"
              id="new-client-name"
              autoFocus
              required
              placeholder="Ex: Weyland-Yutani Corp"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs text-slate-900 dark:text-zinc-200 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
              Identidade Visual (Cor de Destaque)
            </span>
            <div className="grid grid-cols-6 gap-2">
              {colorTemplates.map((template) => (
                <button
                  key={template.value}
                  type="button"
                  aria-label={template.label}
                  aria-pressed={colorTemplate === template.value}
                  onClick={() => setColorTemplate(template.value)}
                  className={`w-9 h-9 rounded-xl ${template.bg} flex items-center justify-center transition-all shadow-sm cursor-pointer ${
                    colorTemplate === template.value
                      ? "ring-2 ring-teal-500 ring-offset-2 ring-offset-slate-100 dark:ring-offset-zinc-900 scale-105"
                      : "opacity-80 hover:opacity-100"
                  }`}
                  title={template.label}
                />
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="new-client-notes" className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
              Anotações de Reunião Iniciais (Opcional)
            </label>
            <textarea
              id="new-client-notes"
              placeholder="Ex: Reunião comercial agendada..."
              value={initialNotes}
              onChange={(e) => setInitialNotes(e.target.value)}
              className="w-full h-20 p-3 text-xs text-slate-900 dark:text-zinc-200 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 resize-none font-sans"
            />
          </div>

          {/* Footer buttons */}
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
              disabled={isSubmitting}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white dark:text-zinc-950 text-xs font-bold rounded-xl transition-colors shadow cursor-pointer flex items-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isSubmitting ? "Criando..." : "Criar Cliente"}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
