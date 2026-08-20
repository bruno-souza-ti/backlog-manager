import { useState } from "react";
import { Check, History, Loader2, Pencil, Trash2, X } from "lucide-react";
import { NotesHistoryItem } from "../types";
import { formatDate, formatTimeAgo } from "../utils";
import ConfirmDialog from "./common/ConfirmDialog";

interface NotesHistoryPanelProps {
  items: NotesHistoryItem[];
  loading: boolean;
  readOnly: boolean;
  onEdit: (noteId: string, content: string) => Promise<boolean>;
  onDelete: (noteId: string) => void;
}

/** Always-visible, editable list of archived notes — replaces the old collapsed read-only toggle. */
export default function NotesHistoryPanel({ items, loading, readOnly, onEdit, onDelete }: NotesHistoryPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const startEdit = (item: NotesHistoryItem) => {
    setEditingId(item.id);
    setDraft(item.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft("");
  };

  const confirmEdit = async (noteId: string) => {
    if (!draft.trim()) return;
    setSavingId(noteId);
    const succeeded = await onEdit(noteId, draft.trim());
    setSavingId(null);
    if (succeeded) {
      setEditingId(null);
      setDraft("");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
        <h3 className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
          Anotações Anteriores{items.length > 0 ? ` (${items.length})` : ""}
        </h3>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin text-teal-500" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-[11px] text-slate-500 dark:text-zinc-500 italic text-center py-4 border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl">
          Nenhuma anotação antiga salva.
        </p>
      ) : (
        <div className="space-y-2.5 max-h-[26rem] overflow-y-auto pr-1">
          {items.map((item) => {
            const isEditing = editingId === item.id;
            const isSaving = savingId === item.id;
            return (
              <div
                key={item.id}
                className="group relative p-3.5 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 hover:border-teal-500/30 shadow-sm hover:shadow transition-all duration-200 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-x-1.5 text-[10px] font-semibold text-slate-500 dark:text-zinc-500">
                    <span>Reunião</span>
                    <span>·</span>
                    <span>{formatDate(item.date)}</span>
                    {item.updatedAt && (
                      <span className="text-teal-600 dark:text-teal-400" title={new Date(item.updatedAt).toLocaleString("pt-BR")}>
                        · editada {formatTimeAgo(item.updatedAt)}
                      </span>
                    )}
                  </div>

                  {!readOnly && !isEditing && (
                    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 focus-within:opacity-100 transition-all shrink-0">
                      <button
                        type="button"
                        aria-label="Editar anotação"
                        onClick={() => startEdit(item)}
                        className="p-1 rounded text-slate-400 dark:text-zinc-500 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/20 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        aria-label="Excluir anotação"
                        onClick={() => setPendingDeleteId(item.id)}
                        className="p-1 rounded text-slate-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      disabled={isSaving}
                      rows={4}
                      className="w-full p-2.5 text-[11px] text-slate-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-teal-300 dark:border-teal-800/60 rounded-lg outline-none focus:ring-1 focus:ring-teal-500 resize-none leading-relaxed"
                    />
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={isSaving}
                        className="px-2.5 py-1 text-[10px] font-semibold rounded-lg text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                      >
                        <X className="w-3 h-3" /> Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => void confirmEdit(item.id)}
                        disabled={isSaving || !draft.trim()}
                        className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                      >
                        {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Salvar
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-700 dark:text-zinc-400 whitespace-pre-wrap leading-normal">
                    {item.content}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {pendingDeleteId && (
        <ConfirmDialog
          title="Excluir anotação?"
          message="Esta anotação será removida permanentemente do histórico. Esta ação não pode ser desfeita."
          confirmLabel="Excluir"
          onConfirm={() => {
            onDelete(pendingDeleteId);
            setPendingDeleteId(null);
          }}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </div>
  );
}
