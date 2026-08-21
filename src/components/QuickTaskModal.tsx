import React, { useState } from "react";
import { Client, Task, UrgencyLevel } from "../types";
import { X, ListTodo, Loader2 } from "lucide-react";
import { useTeamProfiles } from "../hooks/useTeamProfiles";
import { useModalDialog } from "../hooks/useModalDialog";
import { isClientReadOnly } from "../lib/clientLifecycle";

interface QuickTaskModalProps {
  clients: Client[];
  onClose: () => void;
  onAddTask: (task: Omit<Task, "id">) => boolean | Promise<boolean>;
  initialClientId?: string;
  lockClient?: boolean;
}

const NO_CLIENT_VALUE = "";

export default function QuickTaskModal({
  clients,
  onClose,
  onAddTask,
  initialClientId,
  lockClient = false,
}: QuickTaskModalProps) {
  const dialogRef = useModalDialog(onClose);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState<string>(initialClientId || NO_CLIENT_VALUE);
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [deadline, setDeadline] = useState("");
  const [urgency, setUrgency] = useState<"automatic" | UrgencyLevel>("automatic");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { profiles, loading: profilesLoading } = useTeamProfiles();

  const lockedClientName = lockClient
    ? clients.find((c) => c.id === initialClientId)?.name || "Sem Cliente / Backlog Geral"
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const created = await onAddTask({
        clientId: clientId || undefined,
        title: title.trim(),
        description: description.trim(),
        deadline,
        column: "todo",
        urgency: urgency === "automatic" ? null : urgency,
        assigneeId: assigneeId || undefined,
      });
      if (created) onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50" role="presentation">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="quick-task-title" className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">

        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center bg-slate-50 dark:bg-zinc-950 shrink-0">
          <div className="flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h3 id="quick-task-title" className="font-display font-bold text-base text-slate-900 dark:text-white">
              Nova Tarefa
            </h3>
          </div>
          <button
            type="button"
            aria-label="Fechar criação de tarefa"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 bg-white dark:bg-zinc-900 overflow-y-auto">
          <div>
            <label htmlFor="quick-task-title-input" className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
              Título da Tarefa
            </label>
            <input
              type="text"
              id="quick-task-title-input"
              required
              autoFocus
              placeholder="Ex: Resetar senha do usuário no ERP"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs text-slate-900 dark:text-zinc-200 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          <div>
            <label htmlFor="quick-task-description" className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
              Descrição
            </label>
            <textarea
              id="quick-task-description"
              placeholder="Detalhamento da tarefa..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-20 p-3 text-xs text-slate-900 dark:text-zinc-200 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 resize-none font-sans"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="quick-task-client" className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                Cliente
              </label>
              {lockClient ? (
                <div id="quick-task-client" className="w-full px-3.5 py-2.5 text-xs text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-950/60 border border-slate-200 dark:border-zinc-800 rounded-xl truncate">
                  {lockedClientName}
                </div>
              ) : (
                <select
                  id="quick-task-client"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs text-slate-900 dark:text-zinc-200 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:border-teal-500"
                >
                  <option value={NO_CLIENT_VALUE}>Sem Cliente / Backlog Geral</option>
                  {clients.filter((client) => !isClientReadOnly(client)).map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label htmlFor="quick-task-assignee" className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                Responsável
              </label>
              <select
                id="quick-task-assignee"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                disabled={profilesLoading}
                className="w-full px-3 py-2.5 text-xs text-slate-900 dark:text-zinc-200 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:border-teal-500 disabled:opacity-60"
              >
                <option value="">{profilesLoading ? "Carregando..." : "Sem responsável"}</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="quick-task-deadline" className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                Prazo
              </label>
              <input
                id="quick-task-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3 py-2.5 text-xs text-slate-900 dark:text-zinc-200 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label htmlFor="quick-task-urgency" className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                Urgência
              </label>
              <select
                id="quick-task-urgency"
                value={urgency}
                onChange={(event) => setUrgency(event.target.value as "automatic" | UrgencyLevel)}
                className="w-full px-3 py-2.5 text-xs text-slate-900 dark:text-zinc-200 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:border-teal-500"
              >
                <option value="automatic">Automática pelo prazo</option>
                <option value="Sem Urgência">Sem Urgência</option>
                <option value="Urgente">Urgente</option>
                <option value="Muito Urgente">Muito Urgente</option>
              </select>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-zinc-500 -mt-1">
            No modo automático, a prioridade acompanha o prazo e não é gravada como valor fixo.
          </p>

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
              <span>{isSubmitting ? "Criando..." : "Criar Tarefa"}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
