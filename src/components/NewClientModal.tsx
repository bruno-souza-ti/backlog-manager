import React, { useRef, useState } from "react";
import { Loader2, Sparkles, Trash2, Upload, X } from "lucide-react";
import type { Client, NewClientInput } from "../types";
import { useModalDialog } from "../hooks/useModalDialog";

interface NewClientModalProps {
  onClose: () => void;
  onAddClient?: (client: NewClientInput) => boolean | Promise<boolean>;
  /** When set, the modal edits this client instead of creating a new one — pre-fills name/color, drops the initial-notes field (notes have their own dedicated editor already), and adds logo upload. */
  client?: Client;
  onUpdateClient?: (clientId: string, updates: { name?: string; logoColor?: string }) => boolean | Promise<boolean>;
  /** Uploads immediately persist logoUrl on the client — independent of the name/color "Salvar" button, mirroring how the profile avatar flow works. */
  onUploadLogo?: (clientId: string, file: File) => Promise<{ url: string | null; error: string | null }>;
  onRemoveLogo?: (clientId: string) => boolean | Promise<boolean>;
}

const COLOR_TEMPLATES = [
  { value: "from-teal-500 to-emerald-600", label: "Menta / Teal", bg: "bg-gradient-to-tr from-teal-500 to-emerald-600" },
  { value: "from-emerald-500 to-teal-600", label: "Verde Esmeralda", bg: "bg-gradient-to-tr from-emerald-500 to-teal-600" },
  { value: "from-amber-500 to-orange-600", label: "Laranja Solar", bg: "bg-gradient-to-tr from-amber-500 to-orange-600" },
  { value: "from-blue-500 to-cyan-600", label: "Azul Elétrico", bg: "bg-gradient-to-tr from-blue-500 to-cyan-600" },
  { value: "from-fuchsia-500 to-pink-600", label: "Rosa Fuschia", bg: "bg-gradient-to-tr from-fuchsia-500 to-pink-600" },
  { value: "from-red-500 to-rose-600", label: "Vermelho Crítico", bg: "bg-gradient-to-tr from-red-500 to-rose-600" },
];

export default function NewClientModal({ onClose, onAddClient, client, onUpdateClient, onUploadLogo, onRemoveLogo }: NewClientModalProps) {
  const isEditing = Boolean(client);
  const dialogRef = useModalDialog(onClose);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(client?.name || "");
  const [colorTemplate, setColorTemplate] = useState(client?.logoColor || "from-violet-500 to-indigo-600");
  const [initialNotes, setInitialNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoUrl, setLogoUrl] = useState(client?.logoUrl || null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !client || !onUploadLogo) return;

    setIsUploadingLogo(true);
    setLogoError(null);
    const { url, error } = await onUploadLogo(client.id, file);
    setIsUploadingLogo(false);
    if (error || !url) {
      setLogoError(error || "Não foi possível enviar a logo.");
      return;
    }
    setLogoUrl(url);
  };

  const handleRemoveLogo = async () => {
    if (!client || !onRemoveLogo) return;
    const removed = await onRemoveLogo(client.id);
    if (removed) setLogoUrl(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const saved = isEditing && client && onUpdateClient
        ? await onUpdateClient(client.id, { name: name.trim(), logoColor: colorTemplate })
        : onAddClient
        ? await onAddClient({
            name,
            logoColor: colorTemplate,
            notes: initialNotes || `Novas notas criadas em ${new Date().toLocaleDateString("pt-BR")}. Digite anotações de reuniões para este cliente.`,
          })
        : false;
      if (saved) onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50" role="presentation">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="new-client-title" className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center bg-slate-50 dark:bg-zinc-950">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h3 id="new-client-title" className="font-display font-bold text-base text-slate-900 dark:text-white">
              {isEditing ? "Editar Cliente" : "Adicionar Novo Cliente"}
            </h3>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 bg-white dark:bg-zinc-900">
          <div>
            <label htmlFor="new-client-name" className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
              Nome da Empresa / Projeto
            </label>
            <input
              type="text"
              id="new-client-name"
              autoFocus
              required
              placeholder="Ex: Weyland-Yutani Corp"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs text-slate-900 dark:text-zinc-200 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          {logoUrl ? (
            <div>
              <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                Logo
              </span>
              <div className="flex items-center gap-3">
                <img src={logoUrl} alt="Logo do cliente" className="w-14 h-14 rounded-xl object-cover border border-slate-200 dark:border-zinc-800" />
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="px-3 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remover logo
                </button>
              </div>
            </div>
          ) : (
            <div>
              <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                Identidade Visual (Cor de Destaque)
              </span>
              <div className="grid grid-cols-6 gap-2">
                {COLOR_TEMPLATES.map((template) => (
                  <button
                    key={template.value}
                    type="button"
                    aria-label={template.label}
                    aria-pressed={colorTemplate === template.value}
                    onClick={() => setColorTemplate(template.value)}
                    className={`w-9 h-9 rounded-xl ${template.bg} flex items-center justify-center transition-all shadow-sm cursor-pointer ${
                      colorTemplate === template.value
                        ? "ring-2 ring-teal-500 ring-offset-2 ring-offset-slate-100 dark:ring-offset-zinc-900 scale-105"
                        : "opacity-80 hover:opacity-100"
                    }`}
                    title={template.label}
                  />
                ))}
              </div>
              {isEditing && onUploadLogo && (
                <>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} />
                  <button
                    type="button"
                    disabled={isUploadingLogo}
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 px-3 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isUploadingLogo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {isUploadingLogo ? "Enviando..." : "Ou envie uma logo"}
                  </button>
                  {logoError && <p role="alert" className="text-[11px] font-semibold text-red-600 dark:text-red-400 mt-1.5">{logoError}</p>}
                </>
              )}
            </div>
          )}

          {!isEditing && (
            <div>
              <label htmlFor="new-client-notes" className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                Anotações de Reunião Iniciais (Opcional)
              </label>
              <textarea
                id="new-client-notes"
                placeholder="Ex: Reunião comercial agendada..."
                value={initialNotes}
                onChange={(e) => setInitialNotes(e.target.value)}
                className="w-full h-20 p-3 text-xs text-slate-900 dark:text-zinc-200 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 resize-none font-sans"
              />
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors shadow cursor-pointer flex items-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isSubmitting ? "Salvando..." : isEditing ? "Salvar" : "Criar Cliente"}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
