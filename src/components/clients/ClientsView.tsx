import { useMemo, useState } from "react";
import { AlertTriangle, Building2, Loader2, Plus, RefreshCw, Search, X } from "lucide-react";
import type { Client, Task } from "../../types";
import { matchesClientLifecycleFilter, type ClientLifecycleFilter } from "../../lib/clientLifecycle";
import ClientCard from "../ClientCard";

interface ClientsViewProps {
  clients: Client[];
  tasks: Task[];
  searchQuery: string;
  setSearchQuery: (value: string) => void;
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
  const clientsById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);

  const tasksByClientId = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    tasks.forEach((task) => {
      if (!task.clientId) return;
      const bucket = grouped.get(task.clientId);
      if (bucket) bucket.push(task);
      else grouped.set(task.clientId, [task]);
    });
    return grouped;
  }, [tasks]);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredClients = useMemo(
    () => clients.filter((client) =>
      matchesClientLifecycleFilter(client, canManageClientLifecycle ? lifecycleFilter : "operational")
      && client.name.toLowerCase().includes(normalizedSearch)
    ),
    [canManageClientLifecycle, clients, lifecycleFilter, normalizedSearch]
  );

  const matchingTasks = useMemo(() => {
    if (!normalizedSearch) return [];
    return tasks.filter((task) => task.title.toLowerCase().includes(normalizedSearch)).slice(0, 12);
  }, [normalizedSearch, tasks]);

  return (
    <section className="space-y-6" aria-labelledby="clients-list-title">
      {loading && clients.length === 0 && (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-10 text-sm text-slate-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400" role="status">
          <Loader2 className="h-5 w-5 animate-spin text-teal-500" />Carregando clientes…
        </div>
      )}

      {loadError && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" />{loadError}</span>
          <button type="button" onClick={onRetry} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-300 px-3 py-2 text-xs font-bold hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-950/40"><RefreshCw className="h-3.5 w-3.5" />Tentar novamente</button>
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950/30 dark:text-teal-400"><Building2 className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h2 id="clients-list-title" className="font-display text-base font-bold text-slate-900 dark:text-white">Carteira de clientes</h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">{filteredClients.length} cliente{filteredClients.length === 1 ? "" : "s"} neste filtro</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {canManageClientLifecycle && (
            <select aria-label="Filtrar clientes por ciclo de vida" value={lifecycleFilter} onChange={(event) => setLifecycleFilter(event.target.value as ClientLifecycleFilter)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700 outline-none focus:ring-1 focus:ring-teal-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
              <option value="operational">Ativos</option>
              <option value="inactive">Inativos</option>
              <option value="frozen">Congelados</option>
              <option value="deleted">Removidos</option>
              <option value="all">Todos</option>
            </select>
          )}

          <div className="relative min-w-0 sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
            <input type="search" placeholder="Buscar cliente ou tarefa…" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} aria-label="Buscar cliente ou tarefa" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-xs text-slate-900 outline-none focus:ring-1 focus:ring-teal-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200" />
            {searchQuery && <button type="button" aria-label="Limpar busca" onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200"><X className="h-3.5 w-3.5" /></button>}
          </div>

          {canCreateClient && (
            <button type="button" onClick={onNewClient} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow transition-colors hover:bg-teal-700 dark:text-zinc-950"><Plus className="h-4 w-4" />Novo Cliente</button>
          )}
        </div>
      </div>

      {normalizedSearch && matchingTasks.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Tarefas encontradas ({matchingTasks.length})</h3>
          <div className="divide-y divide-slate-100 dark:divide-zinc-800/60">
            {matchingTasks.map((task) => {
              const taskClient = task.clientId ? clientsById.get(task.clientId) : undefined;
              return (
                <button key={task.id} type="button" onClick={() => taskClient && onSelectClient(taskClient.id)} disabled={!taskClient} className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-slate-50 disabled:cursor-default dark:hover:bg-zinc-950/40">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-zinc-200">{task.title}</span>
                  <span className="shrink-0 rounded border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700 dark:border-teal-900/30 dark:bg-teal-950/20 dark:text-teal-400">{taskClient?.name || "Tarefa interna"}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {filteredClients.length === 0 && !loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
          <p className="text-sm italic text-slate-500 dark:text-zinc-500">Nenhum cliente encontrado com os critérios atuais.</p>
          {searchQuery && <button type="button" onClick={() => setSearchQuery("")} className="mt-3 text-xs font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400">Limpar busca</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredClients.map((client) => (
            <ClientCard key={client.id} client={client} tasks={tasksByClientId.get(client.id) || []} lastMeetingAt={lastMeetingAtByClient.get(client.id)} recentChangeCount={recentChangeCountByClient.get(client.id)} onClick={() => onSelectClient(client.id)} />
          ))}
        </div>
      )}
    </section>
  );
}
