import React, { memo, useCallback, useMemo, useState } from "react";
import { Client, NewTimeEntryInput, Profile, Sprint, Task, TaskUpdate, UrgencyLevel } from "../types";
import {
  Trash2,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Ban,
  Pencil,
  Timer,
} from "lucide-react";
import { getUrgencyBadgeClasses, isOverdue, isDueToday, formatDate, getTaskUrgency } from "../utils";
import ConfirmDialog from "./common/ConfirmDialog";
import TaskEditModal from "./TaskEditModal";
import LogTimeModal from "./LogTimeModal";
import Select from "./common/Select";

interface KanbanBoardProps {
  tasks: Task[];
  profiles: Profile[];
  clients?: Client[];
  sprints?: Sprint[];
  currentUserId: string;
  onDeleteTask: (taskId: string) => void;
  onUpdateTaskColumn: (taskId: string, column: Task["column"]) => void;
  onUpdateTask: (taskId: string, updates: TaskUpdate) => Promise<boolean>;
  onLogTime?: (input: NewTimeEntryInput) => boolean | Promise<boolean>;
  readOnly?: boolean;
  /** A board that mixes tasks from several clients (Sprints) needs a per-card client label — single-client boards (Backlog Geral, a client's own Kanban tab) don't. */
  showClientBadge?: boolean;
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

/** How far back the "Feito" column shows by default — older completions still exist, just collapsed behind "Mostrar tudo" (and always in Relatórios). */
const DONE_COLUMN_RECENT_DAYS = 30;

function taskDoneDate(task: Task): string | undefined {
  return task.completedAt || task.columnChangedAt || task.createdAt;
}

export default function KanbanBoard({ tasks, profiles, clients = [], sprints = [], currentUserId, onDeleteTask, onUpdateTaskColumn, onUpdateTask, onLogTime, readOnly = false, showClientBadge = false }: KanbanBoardProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [taskPendingDelete, setTaskPendingDelete] = useState<Task | null>(null);
  const [taskPendingEdit, setTaskPendingEdit] = useState<Task | null>(null);
  const [taskPendingLogTime, setTaskPendingLogTime] = useState<Task | null>(null);
  const [showAllDone, setShowAllDone] = useState(false);

  const profilesById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const clientsById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (column: Task["column"]) => {
    if (readOnly) return;
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

  // "Feito" grows forever otherwise — every task ever completed stays in the
  // same column with no cutoff. Recent-first, collapsed to the last 30 days
  // by default; nothing is deleted, older completions are one click away
  // (and always fully available, with date filters, in Relatórios).
  const { doneAll, doneRecent } = useMemo(() => {
    const all = (tasksByColumn.get("done") || []).slice().sort((a, b) => {
      const aTime = new Date(taskDoneDate(a) || 0).getTime();
      const bTime = new Date(taskDoneDate(b) || 0).getTime();
      return bTime - aTime;
    });
    const cutoff = Date.now() - DONE_COLUMN_RECENT_DAYS * 24 * 60 * 60 * 1000;
    const recent = all.filter((t) => {
      const date = taskDoneDate(t);
      return date ? new Date(date).getTime() >= cutoff : true;
    });
    return { doneAll: all, doneRecent: recent };
  }, [tasksByColumn]);
  const doneHiddenCount = doneAll.length - doneRecent.length;
  const doneVisible = showAllDone ? doneAll : doneRecent;

  return (
    <>
      <div className="h-full min-h-0 flex-1 flex flex-col max-w-full overflow-x-auto overscroll-x-contain pb-2" aria-label="Board Kanban com rolagem horizontal">
        <div className="grid grid-cols-[repeat(4,minmax(220px,1fr))] gap-3 flex-1 min-h-0">
      {COLUMN_DEFS.map((col) => {
        const columnTasks = col.id === "done" ? doneVisible : (tasksByColumn.get(col.id) || []);
        return (
          <div
            key={col.id}
            onDragOver={handleDragOver}
            onDragEnter={(e) => { e.preventDefault(); setDragOverColumn(col.id); }}
            onDragLeave={() => setDragOverColumn(null)}
            onDrop={() => handleDrop(col.id)}
            className={`p-2.5 rounded-xl border min-h-[420px] h-full flex flex-col overflow-hidden transition-all duration-300 ${
              dragOverColumn === col.id
                ? col.dragClass
                : "bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
            }`}
          >
            <div className="flex items-center justify-between px-1.5 pb-1.5 border-b border-slate-200 dark:border-zinc-800/50 shrink-0">
              <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                {col.label}
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${col.countClass}`}>
                {columnTasks.length}
              </span>
            </div>

            {col.id === "done" && doneHiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAllDone((v) => !v)}
                className="shrink-0 w-full text-left px-1.5 py-1.5 text-[10px] font-medium text-slate-500 dark:text-zinc-500 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer"
              >
                {showAllDone
                  ? "Mostrando tudo · ver só recentes"
                  : `+ ${doneHiddenCount} concluída${doneHiddenCount !== 1 ? "s" : ""} há mais de ${DONE_COLUMN_RECENT_DAYS} dias · mostrar tudo`}
              </button>
            )}

            <div className="flex-1 overflow-y-auto overflow-x-hidden p-1 space-y-2">
              {columnTasks.map((t) => {
                const assignee = t.assigneeId ? profilesById.get(t.assigneeId) : undefined;
                const client = showClientBadge && t.clientId ? clientsById.get(t.clientId) : undefined;
                return (
                  <KanbanCard
                    key={t.id}
                    task={t}
                    onRequestDelete={handleRequestDelete}
                    onRequestEdit={setTaskPendingEdit}
                    onRequestLogTime={onLogTime ? setTaskPendingLogTime : undefined}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onMoveTo={handleMoveTo}
                    onUpdateUrgency={(urgency) => onUpdateTask(t.id, { urgency })}
                    isDraggingActive={draggedTaskId !== null && draggedTaskId !== t.id}
                    assigneeName={assignee?.full_name}
                    clientName={client?.name}
                    readOnly={readOnly}
                  />
                );
              })}
              {columnTasks.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-400 dark:text-zinc-500 italic">
                  {col.emptyLabel}
                </div>
              )}
            </div>
          </div>
        );
      })}

        </div>
      </div>

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
      {taskPendingEdit && (
        <TaskEditModal
          task={taskPendingEdit}
          clients={clients}
          profiles={profiles}
          sprints={sprints}
          currentUserId={currentUserId}
          onSave={onUpdateTask}
          onClose={() => setTaskPendingEdit(null)}
        />
      )}
      {taskPendingLogTime && onLogTime && (
        <LogTimeModal
          lockedTask={taskPendingLogTime}
          onLogTime={onLogTime}
          onClose={() => setTaskPendingLogTime(null)}
        />
      )}
    </>
  );
}

/* Kanban Card Component helper */
interface KanbanCardProps {
  task: Task;
  onRequestDelete: (task: Task) => void;
  onRequestEdit: (task: Task) => void;
  onRequestLogTime?: (task: Task) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onMoveTo: (id: string, col: Task["column"]) => void;
  onUpdateUrgency: (urgency: UrgencyLevel | null) => void;
  isDraggingActive: boolean;
  assigneeName?: string;
  clientName?: string;
  readOnly: boolean;
}

const KanbanCard = memo(function KanbanCard({ task, onRequestDelete, onRequestEdit, onRequestLogTime, onDragStart, onDragEnd, onMoveTo, onUpdateUrgency, isDraggingActive, assigneeName, clientName, readOnly }: KanbanCardProps) {
  const isTaskOverdue = isOverdue(task.deadline, task.column);
  const isToday = isDueToday(task.deadline);
  const urgency = getTaskUrgency(task);
  const urgencyBadgeStyle = getUrgencyBadgeClasses(urgency);

  return (
    <div
      draggable={!readOnly}
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
      {clientName && (
        <span className="inline-block max-w-full truncate text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400">
          {clientName}
        </span>
      )}
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 flex items-start gap-1.5 min-w-0">
          <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-100 leading-snug [overflow-wrap:anywhere] group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
            {task.title}
          </h4>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Select
            aria-label={`Urgência da tarefa ${task.title}`}
            value={task.urgency ?? "automatic"}
            disabled={readOnly}
            onChange={(value) => onUpdateUrgency(value === "automatic" ? null : value as UrgencyLevel)}
            triggerClassName={`max-w-[8.5rem] text-[10px] font-semibold px-1.5 py-1 rounded border ${urgencyBadgeStyle}`}
            options={[
              { value: "automatic", label: `Automática · ${urgency}` },
              { value: "Sem Urgência", label: "Sem Urgência" },
              { value: "Urgente", label: "Urgente" },
              { value: "Muito Urgente", label: "Muito Urgente" },
            ]}
          />
          {!readOnly && onRequestLogTime && <button
            type="button"
            aria-label={`Registrar tempo na tarefa ${task.title}`}
            title="Registrar tempo"
            onClick={() => onRequestLogTime(task)}
            className="p-1 rounded text-slate-400 dark:text-zinc-500 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/20 opacity-60 group-hover:opacity-100 focus-visible:opacity-100 transition-all cursor-pointer"
          >
            <Timer className="w-3 h-3" />
          </button>}
          {!readOnly && <button
            type="button"
            aria-label={`Editar tarefa ${task.title}`}
            onClick={() => onRequestEdit(task)}
            className="p-1 rounded text-slate-400 dark:text-zinc-500 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/20 opacity-60 group-hover:opacity-100 focus-visible:opacity-100 transition-all cursor-pointer"
          >
            <Pencil className="w-3 h-3" />
          </button>}
          <button
            type="button"
            aria-label={`Excluir tarefa ${task.title}`}
            onClick={() => onRequestDelete(task)}
            className="p-1 rounded text-slate-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 opacity-60 group-hover:opacity-100 focus-visible:opacity-100 transition-all cursor-pointer"
            title="Deletar tarefa"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {task.description && (
        <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
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
      <div className="flex flex-wrap justify-between items-center pt-2 gap-2 border-t border-slate-100 dark:border-zinc-800/60 text-[10px]">
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
              ) : task.deadline ? (
                <>
                  <Calendar className="w-3 h-3" />
                  <span>{formatDate(task.deadline)}</span>
                </>
              ) : (
                <span>Sem prazo</span>
              )}
            </span>
          )}
        </div>

        {/* Quick move selector */}
        <Select
          aria-label={`Mover tarefa ${task.title} para outra fase`}
          value={task.column}
          disabled={readOnly}
          onChange={(value) => onMoveTo(task.id, value as Task["column"])}
          triggerClassName="max-w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-[9px] text-slate-600 dark:text-zinc-400 rounded-md py-0.5 px-1"
          options={[
            { value: "todo", label: "A Fazer" },
            { value: "doing", label: "Fazendo" },
            { value: "blocked", label: "Bloqueado" },
            { value: "done", label: "Feito" },
          ]}
        />
      </div>
    </div>
  );
});
