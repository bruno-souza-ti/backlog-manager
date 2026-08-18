import { useMemo } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Client, Task, TaskUpdate } from "../../types";
import TeamNowWidget from "../TeamNowWidget";
import ActivityFeed from "../ActivityFeed";
import Metrics from "../Metrics";
import FocusTasksPanel from "./FocusTasksPanel";
import DailyBriefingPanel from "./DailyBriefingPanel";
import AnalyticsChatPanel from "./AnalyticsChatPanel";
import { matchesClientLifecycleFilter } from "../../lib/clientLifecycle";
import { filterDashboardTasks, type DashboardTaskScope } from "../../lib/dashboardTaskFilters";

type UrgencyFilterValue = "Todas" | "Sem Urgência" | "Urgente" | "Muito Urgente";

interface DashboardViewProps {
  clients: Client[];
  tasks: Task[];
  onSelectClient: (clientId: string) => void;
  urgencyFilter: UrgencyFilterValue;
  setUrgencyFilter: (level: UrgencyFilterValue) => void;
  taskScope: DashboardTaskScope;
  setTaskScope: (scope: DashboardTaskScope) => void;
  currentUserId: string;
  onUpdateTaskColumn: (taskId: string, column: Task["column"]) => void;
  onUpdateTask: (taskId: string, updates: TaskUpdate) => Promise<boolean>;
  canUseGlobalAnalytics: boolean;
  loading: boolean;
  loadError?: string | null;
  onRetry: () => void;
}

export default function DashboardView({
  clients,
  tasks,
  onSelectClient,
  urgencyFilter,
  setUrgencyFilter,
  taskScope,
  setTaskScope,
  currentUserId,
  onUpdateTaskColumn,
  onUpdateTask,
  canUseGlobalAnalytics,
  loading,
  loadError,
  onRetry,
}: DashboardViewProps) {
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

  const scopedTasks = useMemo(
    () => filterDashboardTasks(operationalTasks, currentUserId, taskScope),
    [currentUserId, operationalTasks, taskScope]
  );
  const urgencyScopedTasks = useMemo(
    () => filterDashboardTasks(scopedTasks, currentUserId, "all", urgencyFilter),
    [scopedTasks, urgencyFilter]
  );
  const pendingTasks = useMemo(() => scopedTasks.filter((t) => t.column !== "done"), [scopedTasks]);

  return (
    <>
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
      {/* Minha Prioridade Hoje — Centro de Operações */}
      <DailyBriefingPanel
        clients={operationalClients}
        tasks={operationalTasks}
        onSelectClient={onSelectClient}
      />

      {/* Indicadores e trabalho acionável ficam acima dos painéis informativos. */}
      <Metrics clients={operationalClients} tasks={urgencyScopedTasks} />

      <FocusTasksPanel
        pendingTasks={pendingTasks}
        clientsById={clientsById}
        urgencyFilter={urgencyFilter}
        setUrgencyFilter={setUrgencyFilter}
        taskScope={taskScope}
        setTaskScope={setTaskScope}
        onToggleTaskDone={(taskId, done) => onUpdateTaskColumn(taskId, done ? "done" : "todo")}
        onUpdateTask={onUpdateTask}
      />

      {/* Agora na Equipe (Realtime presence) + Atividade Recente */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <TeamNowWidget clients={operationalClients} tasks={operationalTasks} />
        </div>
        <ActivityFeed />
      </div>

      {/* IA Analítica — perguntas inteligentes sobre a operação */}
      {canUseGlobalAnalytics && (
        <AnalyticsChatPanel />
      )}
    </>
  );
}
