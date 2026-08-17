import { useMemo, useState } from "react";
import { Task, TaskUpdate } from "../types";
import KanbanBoard from "./KanbanBoard";
import QuickTaskModal from "./QuickTaskModal";
import { Inbox, Plus, Search, X } from "lucide-react";
import { useTeamProfiles } from "../hooks/useTeamProfiles";

interface BacklogGeralProps {
  tasks: Task[];
  onAddTask: (task: Omit<Task, "id">) => boolean | Promise<boolean>;
  onDeleteTask: (taskId: string) => void;
  onUpdateTaskColumn: (taskId: string, column: Task["column"]) => void;
  onUpdateTask: (taskId: string, updates: TaskUpdate) => Promise<boolean>;
}

export default function BacklogGeral({ tasks, onAddTask, onDeleteTask, onUpdateTaskColumn, onUpdateTask }: BacklogGeralProps) {
  const { profiles } = useTeamProfiles();
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [query, setQuery] = useState("");

  const backlogTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    return tasks.filter((task) => !task.clientId && (!normalizedQuery
      || task.title.toLocaleLowerCase("pt-BR").includes(normalizedQuery)
      || task.description.toLocaleLowerCase("pt-BR").includes(normalizedQuery)));
  }, [query, tasks]);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Inbox className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          <div>
            <h3 className="font-display font-bold text-base text-slate-900 dark:text-zinc-100">
              Backlog Geral
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-0.5">
              Tarefas internas, sem cliente vinculado
            </p>
          </div>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input aria-label="Buscar no Backlog Geral" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar tarefa…" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-9 text-sm outline-none focus:border-teal-500 dark:border-zinc-800 dark:bg-zinc-950" />
            {query && <button type="button" aria-label="Limpar busca" onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200"><X className="h-3.5 w-3.5" /></button>}
          </div>
          <button
          onClick={() => setShowAddTaskModal(true)}
          className="px-2.5 py-1.5 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-teal-200 dark:border-teal-900/40 hover:bg-teal-100 dark:hover:bg-teal-950/60 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tarefa</span>
          </button>
        </div>
      </div>

      <KanbanBoard
        tasks={backlogTasks}
        profiles={profiles}
        clients={[]}
        onDeleteTask={onDeleteTask}
        onUpdateTaskColumn={onUpdateTaskColumn}
        onUpdateTask={onUpdateTask}
      />

      {showAddTaskModal && (
        <QuickTaskModal
          clients={[]}
          initialClientId={undefined}
          lockClient
          onClose={() => setShowAddTaskModal(false)}
          onAddTask={onAddTask}
        />
      )}
    </div>
  );
}
