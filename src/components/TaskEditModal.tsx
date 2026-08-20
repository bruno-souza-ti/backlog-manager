import { useMemo, useState } from "react";
import { Loader2, MessageSquare, Pencil, Send, Trash2, X } from "lucide-react";
import type { Client, Profile, Task, TaskUpdate, UrgencyLevel } from "../types";
import { useModalDialog } from "../hooks/useModalDialog";
import { useTaskComments } from "../hooks/useTaskComments";
import { formatTimeAgo } from "../utils";

interface TaskEditModalProps {
  task: Task;
  clients: Client[];
  profiles: Profile[];
  currentUserId: string;
  onClose: () => void;
  onSave: (taskId: string, updates: TaskUpdate) => Promise<boolean>;
}

export default function TaskEditModal({ task, clients, profiles, currentUserId, onClose, onSave }: TaskEditModalProps) {
  const dialogRef = useModalDialog(onClose);
  const profilesById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const { comments, loading: commentsLoading, addComment, deleteComment } = useTaskComments(task.id);
  const [commentDraft, setCommentDraft] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [clientId, setClientId] = useState(task.clientId || "");
  const [assigneeId, setAssigneeId] = useState(task.assigneeId || "");
  const [deadline, setDeadline] = useState(task.deadline || "");
  const [column, setColumn] = useState<Task["column"]>(task.column);
  const [urgency, setUrgency] = useState<"automatic" | UrgencyLevel>(task.urgency ?? "automatic");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    try {
      const saved = await onSave(task.id, {
        title: title.trim(),
        description: description.trim(),
        clientId: clientId || undefined,
        assigneeId: assigneeId || undefined,
        deadline,
        column,
        urgency: urgency === "automatic" ? null : urgency,
      });
      if (saved) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!commentDraft.trim() || postingComment) return;
    setPostingComment(true);
    try {
      const posted = await addComment(commentDraft, currentUserId);
      if (posted) setCommentDraft("");
    } finally {
      setPostingComment(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="presentation">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="task-edit-title" className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <h2 id="task-edit-title" className="font-display text-base font-bold text-slate-900 dark:text-white">Editar tarefa</h2>
          </div>
          <button type="button" aria-label="Fechar edição de tarefa" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div>
            <label htmlFor="edit-task-name" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Título</label>
            <input id="edit-task-name" autoFocus required value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:border-zinc-800 dark:bg-zinc-950" />
          </div>
          <div>
            <label htmlFor="edit-task-description" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Descrição</label>
            <textarea id="edit-task-description" value={description} onChange={(event) => setDescription(event.target.value)} className="h-24 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:border-zinc-800 dark:bg-zinc-950" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-task-client" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Cliente</label>
              <select id="edit-task-client" value={clientId} onChange={(event) => setClientId(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 dark:border-zinc-800 dark:bg-zinc-950">
                <option value="">Backlog Geral</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="edit-task-assignee" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Responsável</label>
              <select id="edit-task-assignee" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 dark:border-zinc-800 dark:bg-zinc-950">
                <option value="">Sem responsável</option>
                {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="edit-task-deadline" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Prazo</label>
              <input id="edit-task-deadline" type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 dark:border-zinc-800 dark:bg-zinc-950" />
            </div>
            <div>
              <label htmlFor="edit-task-column" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Fase</label>
              <select id="edit-task-column" value={column} onChange={(event) => setColumn(event.target.value as Task["column"])} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 dark:border-zinc-800 dark:bg-zinc-950">
                <option value="todo">A Fazer</option><option value="doing">Fazendo</option><option value="blocked">Bloqueado</option><option value="done">Feito</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="edit-task-urgency" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Urgência</label>
            <select id="edit-task-urgency" value={urgency} onChange={(event) => setUrgency(event.target.value as "automatic" | UrgencyLevel)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 dark:border-zinc-800 dark:bg-zinc-950">
              <option value="automatic">Automática pelo prazo</option><option value="Sem Urgência">Sem Urgência</option><option value="Urgente">Urgente</option><option value="Muito Urgente">Muito Urgente</option>
            </select>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-zinc-800">
            <button type="button" onClick={onClose} className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-300">Cancelar</button>
            <button type="submit" disabled={submitting} className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-50 dark:text-zinc-950">
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{submitting ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
        </form>

        <div className="space-y-3 border-t border-slate-200 p-5 dark:border-zinc-800">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            <MessageSquare className="h-3.5 w-3.5" />
            Comentários{comments.length > 0 ? ` (${comments.length})` : ""}
          </h3>

          {commentsLoading ? (
            <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-teal-500" /></div>
          ) : comments.length === 0 ? (
            <p className="text-[11px] italic text-slate-400 dark:text-zinc-500">Nenhum comentário ainda.</p>
          ) : (
            <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
              {comments.map((comment) => {
                const author = profilesById.get(comment.authorId);
                const isOwn = comment.authorId === currentUserId;
                return (
                  <div key={comment.id} className="group rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300">{author?.full_name || "Ex-integrante"}</span>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500">{formatTimeAgo(comment.createdAt)}</span>
                        {isOwn && (
                          <button type="button" aria-label="Excluir comentário" onClick={() => void deleteComment(comment.id)} className="cursor-pointer text-slate-400 opacity-0 transition-all hover:text-red-600 group-hover:opacity-100 dark:hover:text-red-400">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap text-xs text-slate-700 dark:text-zinc-300">{comment.content}</p>
                  </div>
                );
              })}
            </div>
          )}

          <form onSubmit={handleAddComment} className="flex gap-2">
            <input
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              placeholder="Escreva um comentário…"
              aria-label="Escrever comentário"
              maxLength={4000}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:border-zinc-800 dark:bg-zinc-950"
            />
            <button type="submit" disabled={!commentDraft.trim() || postingComment} aria-label="Enviar comentário" className="flex shrink-0 items-center gap-1.5 rounded-xl bg-teal-600 px-3 py-2 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-50 dark:text-zinc-950">
              {postingComment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </form>
        </div>
        </div>
      </div>
    </div>
  );
}
