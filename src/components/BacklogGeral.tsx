import { useMemo, useState } from "react";
import { Task } from "../types";
import KanbanBoard from "./KanbanBoard";
import QuickTaskModal from "./QuickTaskModal";
import { Inbox, Plus } from "lucide-react";
import { useTeamProfiles } from "../hooks/useTeamProfiles";

interface BacklogGeralProps {
  tasks: Task[];
  onAddTask: (task: Omit<Task, "id">) => void;
  onDeleteTask: (taskId: string) => void;
  onUpdateTaskColumn: (taskId: string, column: Task["column"]) => void;
}

export default function BacklogGeral({ tasks, onAddTask, onDeleteTask, onUpdateTaskColumn }: BacklogGeralProps) {
  const { profiles } = useTeamProfiles();
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);

  const backlogTasks = useMemo(() => tasks.filter((t) => !t.clientId), [tasks]);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
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

        <button
          onClick={() => setShowAddTaskModal(true)}
          className="px-2.5 py-1.5 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-teal-200 dark:border-teal-900/40 hover:bg-teal-100 dark:hover:bg-teal-950/60 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tarefa</span>
        </button>
      </div>

      <KanbanBoard
        tasks={backlogTasks}
        profiles={profiles}
        onDeleteTask={onDeleteTask}
        onUpdateTaskColumn={onUpdateTaskColumn}
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
