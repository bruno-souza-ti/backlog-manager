import { useMemo } from "react";
import { BrainCircuit, Plus, Search } from "lucide-react";
import { Client, Task } from "../../types";
import TeamNowWidget from "../TeamNowWidget";
import ActivityFeed from "../ActivityFeed";
import Metrics from "../Metrics";
import ClientCard from "../ClientCard";
import FocusTasksPanel from "./FocusTasksPanel";
import DailyBriefingPanel from "./DailyBriefingPanel";
import AnalyticsChatPanel from "./AnalyticsChatPanel";

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
}: DashboardViewProps) {
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

  const pendingTasks = useMemo(() => tasks.filter((t) => t.column !== "done"), [tasks]);

  const filteredClients = useMemo(
    () => clients.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [clients, searchQuery]
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
        clients={clients}
        tasks={tasks}
        onSelectClient={onSelectClient}
      />

      {/* Agora na Equipe (Realtime presence) + Atividade Recente */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <TeamNowWidget clients={clients} tasks={tasks} />
        </div>
        <ActivityFeed />
      </div>

      {/* 3 Metric Cards */}
      <Metrics clients={clients} tasks={tasks} />

      <FocusTasksPanel
        pendingTasks={pendingTasks}
        clientsById={clientsById}
        urgencyFilter={urgencyFilter}
        setUrgencyFilter={setUrgencyFilter}
        onToggleTaskDone={(taskId, done) => onUpdateTaskColumn(taskId, done ? "done" : "todo")}
      />

      {/* IA Analítica — perguntas inteligentes sobre a operação */}
      <AnalyticsChatPanel clients={clients} tasks={tasks} />

      {/* Subtitle with action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
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
          <button
            onClick={onNewClient}
            className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white dark:text-zinc-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow transition-all duration-150"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Cliente</span>
          </button>
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
              onClick={() => onSelectClient(client.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}
