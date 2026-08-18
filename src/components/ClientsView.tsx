import { useMemo, useState } from "react";
import { AlertTriangle, BrainCircuit, Loader2, Plus, RefreshCw, Search, X } from "lucide-react";
import { Client, Task } from "../types";
import ClientCard from "./ClientCard";
import { matchesClientLifecycleFilter, type ClientLifecycleFilter } from "../lib/clientLifecycle";

interface ClientsViewProps {
  clients: Client[];
  tasks: Task[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  onSelectClient: (clientId: string) => void;
  onNewClient: () => void;
  lastMeetingAtByClient: Map<string, string>;
  recentChangeCountByClient: Map<string, number>;
  canCreateClient: boolean;
  canManageClientLifecycle: boolean;
  loading: boolean;
  loadError?: string | null;
  onRetry: () => void;
}

export default function ClientsView({
  clients,
  tasks,
  searchQuery,
  setSearchQuery,
  onSelectClient,
  onNewClient,
  lastMeetingAtByClient,
  recentChangeCountByClient,
  canCreateClient,
  canManageClientLifecycle,
  loading,
  loadError,
  onRetry,
}: ClientsViewProps) {
  const [lifecycleFilter, setLifecycleFilter] = useState<ClientLifecycleFilter>("operational");
  const clientsById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const tasksByClientId = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((t) => {
      if (!t.clientId) return;
      const bucket = map.get(t.clientId);
      if (bucket) bucket.push(t);
      else map.set(t.clientId, [t]);
    });
    return map;
  }, [tasks]);

  const filteredClients = useMemo(
    () => clients.filter((client) =>
      matchesClientLifecycleFilter(client, canManageClientLifecycle ? lifecycleFilter : "operational")
      && client.name.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [canManageClientLifecycle, clients, lifecycleFilter, searchQuery]
  );

  const matchingTasks = useMemo(() => {
    if (searchQuery.trim() === "") return [];
    const q = searchQuery.toLowerCase();
    return tasks.filter((t) => t.title.toLowerCase().includes(q));
  }, [tasks, searchQuery]);

  return (
    <div className="space-y-6">
      {loading && clients.length === 0 && tasks.length === 0 && (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-10 text-sm text-slate-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400" role="status">
          <Loader2 className="h-5 w-5 animate-spin text-teal-500" />Carregando operação…
        </div>
      )}
      {loadError && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" />{loadError}</span>
          <button type="button" onClick={onRetry} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-300 px-3 py-2 text-xs font-bold hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-950/40"><RefreshCw className="h-3.5 w-3.5" />Tentar novamente</button>
        </div>
      )}

      {/* Subtitle with action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          {canManageClientLifecycle && (
            <select
              aria-label="Filtrar clientes por ciclo de vida"
              value={lifecycleFilter}
              onChange={(event) => setLifecycleFilter(event.target.value as ClientLifecycleFilter)}
              className="px-3 py-2 text-xs text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="operational">Ativos</option>
              <option value="inactive">Inativos</option>
              <option value="frozen">Congelados</option>
              <option value="deleted">Removidos</option>
              <option value="all">Todos</option>
            </select>
          )}
          <BrainCircuit className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          <h2 className="font-display font-bold text-lg text-slate-900 dark:text-white">
            Clientes em Acompanhamento Ativo
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Field */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar cliente ou tarefa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Buscar cliente ou tarefa"
              className="pl-9 pr-9 py-2 text-xs text-slate-900 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-1 focus:ring-teal-500 w-44 sm:w-56 transition-all"
            />
            {searchQuery && <button type="button" aria-label="Limpar busca" onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200"><X className="h-3.5 w-3.5" /></button>}
          </div>

          {/* New Client Button */}
          {canCreateClient && (
            <button
              onClick={onNewClient}
              className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white dark:text-zinc-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow transition-all duration-150"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Cliente</span>
            </button>
          )}
        </div>
      </div>

      {/* Task Search Results (any client) */}
      {searchQuery.trim() !== "" && matchingTasks.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-2">
          <h3 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
            Tarefas encontradas ({matchingTasks.length})
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-zinc-800/60">
            {matchingTasks.map((task) => {
              const taskClient = task.clientId ? clientsById.get(task.clientId) : undefined;
              return (
                <button
                  key={task.id}
                  onClick={() => {
                    if (taskClient) onSelectClient(taskClient.id);
                  }}
                  disabled={!taskClient}
                  className="w-full flex items-center justify-between gap-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-zinc-950/40 rounded-lg px-2 transition-colors disabled:cursor-default"
                >
                  <span className="text-sm font-medium text-slate-800 dark:text-zinc-200 truncate">
                    {task.title}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-900/30">
                    {taskClient ? taskClient.name : "Tarefa Interna"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Client Grid */}
      {filteredClients.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800 rounded-2xl">
          <p className="text-sm text-slate-500 dark:text-zinc-500 italic">
            Nenhum cliente encontrado com os critérios de busca atuais.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              tasks={tasksByClientId.get(client.id) || []}
              lastMeetingAt={lastMeetingAtByClient.get(client.id)}
              recentChangeCount={recentChangeCountByClient.get(client.id)}
              onClick={() => onSelectClient(client.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
