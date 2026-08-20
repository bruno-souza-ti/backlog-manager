import { useMemo, useState } from "react";
import { Briefcase, ListTodo, Search, X } from "lucide-react";
import { Client, Task } from "../types";
import { useModalDialog } from "../hooks/useModalDialog";

const MAX_RESULTS_PER_GROUP = 6;

interface GlobalSearchProps {
  clients: Client[];
  tasks: Task[];
  onClose: () => void;
  onSelectClient: (clientId: string) => void;
  onSelectBacklog: () => void;
}

/** Cmd/Ctrl+K palette — searches client names and task titles across the whole app, not just within whichever view happens to have its own search field. */
export default function GlobalSearch({ clients, tasks, onClose, onSelectClient, onSelectBacklog }: GlobalSearchProps) {
  const dialogRef = useModalDialog(onClose);
  const [query, setQuery] = useState("");

  const clientsById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const { matchedClients, matchedTasks } = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { matchedClients: [], matchedTasks: [] };
    return {
      matchedClients: clients.filter((c) => c.name.toLowerCase().includes(q)).slice(0, MAX_RESULTS_PER_GROUP),
      matchedTasks: tasks.filter((t) => t.title.toLowerCase().includes(q)).slice(0, MAX_RESULTS_PER_GROUP),
    };
  }, [clients, tasks, query]);

  const handleSelectTask = (task: Task) => {
    if (task.clientId) onSelectClient(task.clientId);
    else onSelectBacklog();
  };

  const hasQuery = query.trim() !== "";
  const hasResults = matchedClients.length > 0 || matchedTasks.length > 0;

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[12vh] p-4" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Busca global"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-3 p-4 border-b border-slate-100 dark:border-zinc-800">
          <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente ou tarefa em todo o app..."
            aria-label="Buscar cliente ou tarefa em todo o app"
            className="flex-1 min-w-0 bg-transparent text-sm text-slate-900 dark:text-zinc-100 outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-500"
          />
          <button type="button" aria-label="Fechar busca" onClick={onClose} className="p-1 rounded text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-200 cursor-pointer shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {!hasQuery ? (
            <p className="p-6 text-center text-xs text-slate-400 dark:text-zinc-500 italic">
              Digite para buscar em clientes e tarefas.
            </p>
          ) : !hasResults ? (
            <p className="p-6 text-center text-xs text-slate-500 dark:text-zinc-500 italic">
              Nenhum resultado para "{query}".
            </p>
          ) : (
            <div className="py-2">
              {matchedClients.length > 0 && (
                <div>
                  <p className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                    Clientes
                  </p>
                  {matchedClients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => onSelectClient(client.id)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-zinc-950/60 transition-colors cursor-pointer"
                    >
                      <Briefcase className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                      <span className="text-sm text-slate-800 dark:text-zinc-200 truncate">{client.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {matchedTasks.length > 0 && (
                <div>
                  <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                    Tarefas
                  </p>
                  {matchedTasks.map((task) => {
                    const client = task.clientId ? clientsById.get(task.clientId) : undefined;
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => handleSelectTask(task)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-zinc-950/60 transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          <ListTodo className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0" />
                          <span className="text-sm text-slate-800 dark:text-zinc-200 truncate">{task.title}</span>
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-900/30">
                          {client ? client.name : "Backlog Geral"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-1.5 text-[10px] text-slate-400 dark:text-zinc-500">
          <kbd className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 font-mono">Esc</kbd>
          <span>para fechar</span>
        </div>
      </div>
    </div>
  );
}
