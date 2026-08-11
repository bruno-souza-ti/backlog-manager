import { useMemo, useState } from "react";
import { BrainCircuit, Plus, Search } from "lucide-react";
import { Client, Task } from "../../types";
import TeamNowWidget from "../TeamNowWidget";
import ActivityFeed from "../ActivityFeed";
import Metrics from "../Metrics";
import ClientCard from "../ClientCard";
import FocusTasksPanel from "./FocusTasksPanel";
import DailyBriefingPanel from "./DailyBriefingPanel";
import AnalyticsChatPanel from "./AnalyticsChatPanel";
import { matchesClientLifecycleFilter, type ClientLifecycleFilter } from "../../lib/clientLifecycle";

type UrgencyFilterValue = "Todas" | "Sem Urgência" | "Urgente" | "Muito Urgente";

interface DashboardViewProps {
  clients: Client[];
  tasks: Task[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  onSelectClient: (clientId: string) => void;
  onNewClient: () => void;
  urgencyFilter: UrgencyFilterValue;
  setUrgencyFilter: (level: UrgencyFilterValue) => void;
  onUpdateTaskColumn: (taskId: string, column: Task["column"]) => void;
  /** From useClientHealthSignals — fed into ClientCard/AnalyticsChatPanel health calcs. */
  lastMeetingAtByClient: Map<string, string>;
  recentChangeCountByClient: Map<string, number>;
  canCreateClient: boolean;
  canUseGlobalAnalytics: boolean;
  canManageClientLifecycle: boolean;
}

export default function DashboardView({
  clients,
  tasks,
  searchQuery,
  setSearchQuery,
  onSelectClient,
  onNewClient,
  urgencyFilter,
  setUrgencyFilter,
  onUpdateTaskColumn,
  lastMeetingAtByClient,
  recentChangeCountByClient,
  canCreateClient,
  canUseGlobalAnalytics,
  canManageClientLifecycle,
}: DashboardViewProps) {
  const [lifecycleFilter, setLifecycleFilter] = useState<ClientLifecycleFilter>("operational");
  const clientsById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const operationalClients = useMemo(
    () => clients.filter((client) => matchesClientLifecycleFilter(client, "operational")),
    [clients]
  );
  const operationalClientIds = useMemo(() => new Set(operationalClients.map((client) => client.id)), [operationalClients]);
  const operationalTasks = useMemo(
    () => tasks.filter((task) => !task.clientId || operationalClientIds.has(task.clientId)),
    [tasks, operationalClientIds]
  );

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

  const pendingTasks = useMemo(() => operationalTasks.filter((t) => t.column !== "done"), [operationalTasks]);

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
    <>
      {/* Minha Prioridade Hoje — Centro de Operações */}
      <DailyBriefingPanel
        clients={operationalClients}
        tasks={operationalTasks}
        onSelectClient={onSelectClient}
      />

      {/* Agora na Equipe (Realtime presence) + Atividade Recente */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <TeamNowWidget clients={operationalClients} tasks={operationalTasks} />
        </div>
        <ActivityFeed />
      </div>

      {/* 3 Metric Cards */}
      <Metrics clients={operationalClients} tasks={operationalTasks} />

      <FocusTasksPanel
        pendingTasks={pendingTasks}
        clientsById={clientsById}
        urgencyFilter={urgencyFilter}
        setUrgencyFilter={setUrgencyFilter}
        onToggleTaskDone={(taskId, done) => onUpdateTaskColumn(taskId, done ? "done" : "todo")}
      />

      {/* IA Analítica — perguntas inteligentes sobre a operação */}
      {canUseGlobalAnalytics && (
        <AnalyticsChatPanel
          clients={clients}
          tasks={tasks}
          lastMeetingAtByClient={lastMeetingAtByClient}
          recentChangeCountByClient={recentChangeCountByClient}
        />
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
              className="pl-9 pr-3.5 py-2 text-xs text-slate-900 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-1 focus:ring-teal-500 w-44 sm:w-56 transition-all"
            />
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
    </>
  );
}
