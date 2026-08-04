import React, { memo, useCallback, useMemo, useState } from "react";
import { Profile, Task } from "../types";
import {
  Trash2,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Ban,
} from "lucide-react";
import { getUrgencyBadgeClasses, isOverdue, isDueToday, formatDate, getTaskUrgency } from "../utils";
import ConfirmDialog from "./common/ConfirmDialog";

interface KanbanBoardProps {
  tasks: Task[];
  profiles: Profile[];
  onDeleteTask: (taskId: string) => void;
  onUpdateTaskColumn: (taskId: string, column: Task["column"]) => void;
}

const COLUMN_DEFS: { id: Task["column"]; label: string; emptyLabel: string; countClass: string; dragClass: string }[] = [
  {
    id: "todo",
    label: "A Fazer",
    emptyLabel: "Nenhuma tarefa",
    countClass: "bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300",
    dragClass: "bg-teal-50 dark:bg-teal-950/20 border-teal-500/50 scale-[1.01] shadow-lg shadow-teal-500/5",
  },
  {
    id: "doing",
    label: "Fazendo",
    emptyLabel: "Nenhuma ativa",
    countClass: "bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-900/40",
    dragClass: "bg-teal-50 dark:bg-teal-950/20 border-teal-500/50 scale-[1.01] shadow-lg shadow-teal-500/5",
  },
  {
    id: "blocked",
    label: "Bloqueado",
    emptyLabel: "Nada bloqueado",
    countClass: "bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-900/40",
    dragClass: "bg-violet-50 dark:bg-violet-950/20 border-violet-500/50 scale-[1.01] shadow-lg shadow-violet-500/5",
  },
  {
    id: "done",
    label: "Feito",
    emptyLabel: "Nenhum feito",
    countClass: "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40",
    dragClass: "bg-teal-50 dark:bg-teal-950/20 border-teal-500/50 scale-[1.01] shadow-lg shadow-teal-500/5",
  },
];

export default function KanbanBoard({ tasks, profiles, onDeleteTask, onUpdateTaskColumn }: KanbanBoardProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [taskPendingDelete, setTaskPendingDelete] = useState<Task | null>(null);

  const profilesById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (column: Task["column"]) => {
    if (draggedTaskId) {
      onUpdateTaskColumn(draggedTaskId, column);
      setDraggedTaskId(null);
    }
    setDragOverColumn(null);
  };

  const handleDragStart = useCallback((id: string) => setDraggedTaskId(id), []);
  const handleDragEnd = useCallback(() => setDraggedTaskId(null), []);
  const handleMoveTo = useCallback(
    (id: string, col: Task["column"]) => onUpdateTaskColumn(id, col),
    [onUpdateTaskColumn]
  );
  const handleRequestDelete = useCallback((task: Task) => setTaskPendingDelete(task), []);

  const tasksByColumn = useMemo(() => {
    const map = new Map<Task["column"], Task[]>();
    tasks.forEach((t) => {
      const bucket = map.get(t.column);
      if (bucket) bucket.push(t);
      else map.set(t.column, [t]);
    });
    return map;
  }, [tasks]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      {COLUMN_DEFS.map((col) => {
        const columnTasks = tasksByColumn.get(col.id) || [];
        return (
          <div
            key={col.id}
            onDragOver={handleDragOver}
            onDragEnter={(e) => { e.preventDefault(); setDragOverColumn(col.id); }}
            onDragLeave={() => setDragOverColumn(null)}
            onDrop={() => handleDrop(col.id)}
            className={`p-2.5 rounded-xl border min-h-[450px] flex flex-col space-y-2.5 transition-all duration-300 ${
              dragOverColumn === col.id
                ? col.dragClass
                : "bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
            }`}
          >
            <div className="flex items-center justify-between px-1.5 pb-1.5 border-b border-slate-200 dark:border-zinc-800/50">
              <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                {col.label}
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${col.countClass}`}>
                {columnTasks.length}
              </span>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto">
              {columnTasks.map((t) => {
                const assignee = t.assigneeId ? profilesById.get(t.assigneeId) : undefined;
                return (
                  <KanbanCard
                    key={t.id}
                    task={t}
                    onRequestDelete={handleRequestDelete}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onMoveTo={handleMoveTo}
                    isDraggingActive={draggedTaskId !== null && draggedTaskId !== t.id}
                    assigneeName={assignee?.full_name}
                  />
                );
              })}
              {columnTasks.length === 0 && (
                <div className="text-center py-8 text-[11px] text-slate-400 dark:text-zinc-500 italic">
                  {col.emptyLabel}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {taskPendingDelete && (
        <ConfirmDialog
          title="Excluir tarefa"
          message={`Tem certeza que deseja excluir "${taskPendingDelete.title}"? Esta ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          onConfirm={() => {
            onDeleteTask(taskPendingDelete.id);
            setTaskPendingDelete(null);
          }}
          onCancel={() => setTaskPendingDelete(null)}
        />
      )}
    </div>
  );
}

/* Kanban Card Component helper */
interface KanbanCardProps {
  task: Task;
  onRequestDelete: (task: Task) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onMoveTo: (id: string, col: Task["column"]) => void;
  isDraggingActive: boolean;
  assigneeName?: string;
}

const KanbanCard = memo(function KanbanCard({ task, onRequestDelete, onDragStart, onDragEnd, onMoveTo, isDraggingActive, assigneeName }: KanbanCardProps) {
  const isTaskOverdue = isOverdue(task.deadline, task.column);
  const isToday = isDueToday(task.deadline);
  const urgency = getTaskUrgency(task);
  const urgencyBadgeStyle = getUrgencyBadgeClasses(urgency);

  return (
    <div
      draggable
      onDragStart={() => onDragStart(task.id)}
      onDragEnd={onDragEnd}
      className={`p-3 bg-white dark:bg-zinc-900 rounded-xl border hover:border-teal-500/30 shadow-sm cursor-grab active:cursor-grabbing space-y-2 group relative transition-all duration-200 hover:-translate-y-0.5 ${
        isDraggingActive ? "pointer-events-none opacity-40" : ""
      } ${
        urgency === "Muito Urgente" && task.column !== "done"
          ? "border-l-4 border-l-red-500 border-slate-200 dark:border-zinc-800/80"
          : urgency === "Urgente" && task.column !== "done"
          ? "border-l-4 border-l-amber-500 border-slate-200 dark:border-zinc-800/80"
          : "border-slate-200 dark:border-zinc-800/80"
      }`}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex items-start gap-1.5 min-w-0">
          <h4 className="text-[11px] font-bold text-slate-800 dark:text-zinc-100 leading-snug break-words group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
            {task.title}
          </h4>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${urgencyBadgeStyle}`}>
            {urgency}
          </span>
          <button
            onClick={() => onRequestDelete(task)}
            className="p-1 rounded text-slate-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
            title="Deletar tarefa"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {task.description && (
        <p className="text-[10px] text-slate-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}

      {assigneeName && (
        <div className="flex items-center gap-1.5 pt-1">
          <div className="w-4 h-4 rounded-full bg-teal-100 dark:bg-teal-900/40 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-[7px] font-bold text-teal-700 dark:text-teal-400">
            {assigneeName.substring(0, 2).toUpperCase()}
          </div>
          <span className="text-[9px] font-medium text-slate-600 dark:text-zinc-400 truncate">
            {assigneeName}
          </span>
        </div>
      )}

      {/* Column Switcher for non-drag-and-drop users/iframe ease */}
      <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-zinc-800/60 text-[9px]">
        <div className="flex items-center gap-1">
          {task.column === "done" ? (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span>Concluída</span>
            </span>
          ) : task.column === "blocked" ? (
            <span className="flex items-center gap-1 text-violet-600 dark:text-violet-400 font-semibold">
              <Ban className="w-3 h-3 text-violet-500" />
              <span>Bloqueado</span>
            </span>
          ) : (
            <span className={`flex items-center gap-1 font-semibold ${
              isTaskOverdue
                ? "text-red-600 dark:text-red-400"
                : isToday
                ? "text-amber-600 dark:text-amber-400"
                : "text-slate-500 dark:text-zinc-500"
            }`}>
              {isTaskOverdue ? (
                <>
                  <AlertCircle className="w-3 h-3 text-red-500" />
                  <span>Atrasado ({formatDate(task.deadline)})</span>
                </>
              ) : isToday ? (
                <>
                  <Clock className="w-3 h-3 text-amber-500" />
                  <span>Hoje ({formatDate(task.deadline)})</span>
                </>
              ) : (
                <>
                  <Calendar className="w-3 h-3" />
                  <span>{formatDate(task.deadline)}</span>
                </>
              )}
            </span>
          )}
        </div>

        {/* Quick move selector */}
        <select
          value={task.column}
          onChange={(e) => onMoveTo(task.id, e.target.value as Task["column"])}
          className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-[9px] text-slate-600 dark:text-zinc-400 rounded-md py-0.5 px-1 outline-none focus:border-teal-500 cursor-pointer"
        >
          <option value="todo">A Fazer</option>
          <option value="doing">Fazendo</option>
          <option value="blocked">Bloqueado</option>
          <option value="done">Feito</option>
        </select>
      </div>
    </div>
  );
});
