import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Loader2, Plus, RefreshCw, Rocket } from "lucide-react";
import { Client, NewSprintInput, ProfileRole, Sprint, Task, TaskUpdate } from "../types";
import { useTeamProfiles } from "../hooks/useTeamProfiles";
import { hasPermission } from "../lib/permissions";
import { computeSprintStatus, SPRINT_STATUS_META } from "../lib/sprintStatus";
import { formatDate } from "../utils";
import KanbanBoard from "./KanbanBoard";
import SprintCard from "./SprintCard";
import NewSprintModal from "./NewSprintModal";

interface SprintsProps {
  sprints: Sprint[];
  tasks: Task[];
  clients: Client[];
  currentUserId: string;
  currentUserRole?: ProfileRole;
  onAddSprint: (sprint: NewSprintInput) => boolean | Promise<boolean>;
  onDeleteTask: (taskId: string) => void;
  onUpdateTaskColumn: (taskId: string, column: Task["column"]) => void;
  onUpdateTask: (taskId: string, updates: TaskUpdate) => Promise<boolean>;
  loading: boolean;
  loadError?: string | null;
  onRetry: () => void;
}

function groupBySprintId(tasks: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>();
  tasks.forEach((t) => {
    if (!t.sprintId) return;
    const bucket = map.get(t.sprintId);
    if (bucket) bucket.push(t);
    else map.set(t.sprintId, [t]);
  });
  return map;
}

export default function Sprints({
  sprints,
  tasks,
  clients,
  currentUserId,
  currentUserRole,
  onAddSprint,
  onDeleteTask,
  onUpdateTaskColumn,
  onUpdateTask,
  loading,
  loadError,
  onRetry,
}: SprintsProps) {
  const { profiles } = useTeamProfiles();
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [showNewSprintModal, setShowNewSprintModal] = useState(false);
  const canManageSprints = hasPermission(currentUserRole, "sprints.manage");

  const tasksBySprintId = useMemo(() => groupBySprintId(tasks), [tasks]);

  const groupedSprints = useMemo(() => {
    const active: Sprint[] = [];
    const upcoming: Sprint[] = [];
    const completed: Sprint[] = [];
    sprints.forEach((sprint) => {
      const status = computeSprintStatus(sprint);
      if (status === "active") active.push(sprint);
      else if (status === "upcoming") upcoming.push(sprint);
      else completed.push(sprint);
    });
    return { active, upcoming, completed };
  }, [sprints]);

  const selectedSprint = selectedSprintId ? sprints.find((s) => s.id === selectedSprintId) : undefined;

  if (selectedSprint) {
    const sprintTasks = tasksBySprintId.get(selectedSprint.id) || [];
    const statusMeta = SPRINT_STATUS_META[computeSprintStatus(selectedSprint)];
    return (
      <div className="space-y-6">
        <div>
          <button
            type="button"
            onClick={() => setSelectedSprintId(null)}
            className="flex items-center gap-2 mb-4 text-xs font-bold text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar aos sprints
          </button>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-600 flex items-center justify-center text-white shadow-md shrink-0">
                <Rocket className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white leading-tight">
                  {selectedSprint.name}
                </h1>
                <span className="text-xs font-semibold text-slate-500 dark:text-zinc-500 uppercase">
                  {formatDate(selectedSprint.startDate)} – {formatDate(selectedSprint.endDate)}
                </span>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusMeta.classes}`}>
              {statusMeta.label}
            </span>
          </div>
          {selectedSprint.goal && (
            <p className="text-sm text-slate-600 dark:text-zinc-400 mt-3 max-w-2xl">{selectedSprint.goal}</p>
          )}
        </div>

        <div className="h-[calc(100vh-200px)] flex flex-col min-h-0">
          <KanbanBoard
            tasks={sprintTasks}
            profiles={profiles}
            clients={clients}
            currentUserId={currentUserId}
            onDeleteTask={onDeleteTask}
            onUpdateTaskColumn={onUpdateTaskColumn}
            onUpdateTask={onUpdateTask}
            showClientBadge
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {loading && sprints.length === 0 && (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-10 text-sm text-slate-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400" role="status">
          <Loader2 className="h-5 w-5 animate-spin text-teal-500" />Carregando sprints…
        </div>
      )}
      {loadError && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" />{loadError}</span>
          <button type="button" onClick={onRetry} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-300 px-3 py-2 text-xs font-bold hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-950/40"><RefreshCw className="h-3.5 w-3.5" />Tentar novamente</button>
        </div>
      )}

      {canManageSprints && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowNewSprintModal(true)}
            className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow transition-all duration-150 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Sprint</span>
          </button>
        </div>
      )}

      {!loading && sprints.length === 0 && !loadError && (
        <div className="text-center py-16 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl">
          <Rocket className="w-8 h-8 text-slate-300 dark:text-zinc-700 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600 dark:text-zinc-400">Nenhum sprint criado ainda.</p>
          {canManageSprints && (
            <p className="text-xs text-slate-400 dark:text-zinc-600 mt-1">Crie o primeiro sprint pra começar a organizar o trabalho em ciclos.</p>
          )}
        </div>
      )}

      {groupedSprints.active.length > 0 && (
        <SprintGroup title="Ativos" sprints={groupedSprints.active} tasksBySprintId={tasksBySprintId} onSelect={setSelectedSprintId} />
      )}
      {groupedSprints.upcoming.length > 0 && (
        <SprintGroup title="Próximos" sprints={groupedSprints.upcoming} tasksBySprintId={tasksBySprintId} onSelect={setSelectedSprintId} />
      )}
      {groupedSprints.completed.length > 0 && (
        <SprintGroup title="Concluídos" sprints={groupedSprints.completed} tasksBySprintId={tasksBySprintId} onSelect={setSelectedSprintId} />
      )}

      {showNewSprintModal && (
        <NewSprintModal onClose={() => setShowNewSprintModal(false)} onAddSprint={onAddSprint} />
      )}
    </div>
  );
}

function SprintGroup({
  title,
  sprints,
  tasksBySprintId,
  onSelect,
}: {
  title: string;
  sprints: Sprint[];
  tasksBySprintId: Map<string, Task[]>;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <h2 className="text-sm font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider mb-3">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sprints.map((sprint) => (
          <SprintCard key={sprint.id} sprint={sprint} tasks={tasksBySprintId.get(sprint.id) || []} onClick={() => onSelect(sprint.id)} />
        ))}
      </div>
    </div>
  );
}
