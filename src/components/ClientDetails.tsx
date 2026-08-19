import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Client, Task, ClientFile, AIExtractedTaskDTO, ClientLifecycleAction, TaskUpdate } from "../types";
import QuickTaskModal from "./QuickTaskModal";
import KanbanBoard from "./KanbanBoard";
import ConfirmDialog from "./common/ConfirmDialog";
import ClientTimeline from "./ClientTimeline";
import NextActionPanel from "./NextActionPanel";
import { useClientTimeline } from "../hooks/useClientTimeline";
import { computeNextAction } from "../lib/nextAction";
import {
  Sparkles,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  FileText,
  Upload,
  ArrowLeft,
  X,
  Send,
  Loader2,
  Bot,
  Video,
  LockKeyhole,
  Kanban,
  NotebookPen,
  History,
} from "lucide-react";
import { formatDate } from "../utils";
import { computeClientHealth, getHealthMeta } from "../lib/clientHealth";
import { useTeamProfiles } from "../hooks/useTeamProfiles";
import { buildTaskFromAIResult } from "../lib/taskMappers";
import { authPostJson, ApiError } from "../lib/apiClient";
import { useToast } from "./common/ToastProvider";
import ClientLifecycleControl from "./ClientLifecycleControl";
import { CLIENT_LIFECYCLE_META, getClientLifecycleKey, isClientReadOnly } from "../lib/clientLifecycle";

const MeetBotModal = lazy(() => import("./MeetBotModal"));

type ClientDetailsTab = "kanban" | "notes" | "documents" | "audit";

const TABS: { id: ClientDetailsTab; label: string; icon: typeof Kanban }[] = [
  { id: "kanban", label: "Quadro Kanban", icon: Kanban },
  { id: "notes", label: "Bloco de Notas & Reuniões", icon: NotebookPen },
  { id: "documents", label: "Documentos", icon: FileText },
  { id: "audit", label: "Auditoria", icon: History },
];

interface ClientDetailsProps {
  client: Client;
  allClients?: Client[];
  tasks: Task[];
  detailsLoading: boolean;
  /** task_moved counts per client in the last 14 days, from useClientHealthSignals. */
  recentChangeCountByClient?: Map<string, number>;
  onBack: () => void;
  onUpdateClientNotes: (clientId: string, notes: string) => Promise<boolean>;
  onSaveNotesToHistory: (clientId: string, notes: string) => Promise<boolean>;
  onDepositNotes: (clientId: string, notes: string) => Promise<boolean>;
  onAddTask: (task: Omit<Task, "id">) => boolean | Promise<boolean>;
  onDeleteTask: (taskId: string) => void;
  onUpdateTaskColumn: (taskId: string, column: "todo" | "doing" | "blocked" | "done") => void;
  onUpdateTask: (taskId: string, updates: TaskUpdate) => Promise<boolean>;
  onUploadFile: (clientId: string, fileName: string, fileContent: string) => void;
  onDeleteFile: (clientId: string, fileId: string) => void;
  canManageLifecycle: boolean;
  onSetLifecycle: (clientId: string, action: ClientLifecycleAction) => Promise<boolean>;
}

export default function ClientDetails({
  client,
  allClients,
  tasks,
  detailsLoading,
  recentChangeCountByClient,
  onBack,
  onUpdateClientNotes,
  onSaveNotesToHistory,
  onDepositNotes,
  onAddTask,
  onDeleteTask,
  onUpdateTaskColumn,
  onUpdateTask,
  onUploadFile,
  onDeleteFile,
  canManageLifecycle,
  onSetLifecycle,
}: ClientDetailsProps) {
  const { showToast } = useToast();
  const [notes, setNotes] = useState(client.notes);
  const [notesSaveState, setNotesSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isExtractingTasks, setIsExtractingTasks] = useState(false);
  const [extractionFeedback, setExtractionFeedback] = useState<string | null>(null);
  const [showMeetBotModal, setShowMeetBotModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<ClientFile | null>(null);
  const [activeTab, setActiveTab] = useState<ClientDetailsTab>("kanban");
  const readOnly = isClientReadOnly(client);
  const lifecycleMeta = CLIENT_LIFECYCLE_META[getClientLifecycleKey(client)];

  // Keep the notes textarea in sync when the user switches to a different
  // client (this component isn't remounted on navigation, so without this
  // the previous client's in-progress notes would linger on screen).
  useEffect(() => {
    setNotes(client.notes);
  }, [client.id, client.notes]);

  const clientTasks = useMemo(() => tasks.filter((t) => t.clientId === client.id), [tasks, client.id]);

  const { events: timelineEvents, timelineLoading, meetings: clientMeetings } = useClientTimeline(
    client.id,
    clientTasks,
    client.notesHistory,
    client.files,
    detailsLoading
  );

  const nextAction = React.useMemo(
    () => computeNextAction(clientTasks, client.notesHistory, clientMeetings),
    [clientTasks, client.notesHistory, clientMeetings]
  );

  // clientMeetings is already sorted most-recent-first by useClientTimeline's query.
  const health = useMemo(
    () =>
      computeClientHealth({
        tasks: clientTasks,
        lastMeetingAt: clientMeetings[0]?.occurred_at,
        recentChangeCount: recentChangeCountByClient?.get(client.id) ?? 0,
      }),
    [clientTasks, clientMeetings, recentChangeCountByClient, client.id]
  );
  const healthMeta = getHealthMeta(health.level);

  // Quick Task modal toggle
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);

  const { profiles } = useTeamProfiles();

  // File upload simulation states
  const [uploading, setUploading] = useState(false);

  // Chat with Document modal states
  const [selectedFileForChat, setSelectedFileForChat] = useState<ClientFile | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<{ sender: "user" | "ai"; text: string }[]>([]);
  const [isSendingChat, setIsSendingChat] = useState(false);

  // Notes update handler with ~500ms debounce
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingNotesRef = useRef({ clientId: client.id, value: client.notes, dirty: false });

  const persistNotes = async (clientId: string, value: string) => {
    setNotesSaveState("saving");
    pendingNotesRef.current.dirty = false;
    const saved = await onUpdateClientNotes(clientId, value);
    if (!saved) {
      pendingNotesRef.current = { clientId, value, dirty: true };
      setNotesSaveState("error");
      return false;
    }
    setNotesSaveState("saved");
    return true;
  };

  const handleNotesChange = (val: string) => {
    if (readOnly) return;
    setNotes(val);
    setNotesSaveState("idle");
    pendingNotesRef.current = { clientId: client.id, value: val, dirty: true };
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      void persistNotes(client.id, val);
    }, 500);
  };

  // Flush and clear any pending debounced save when switching clients or
  // unmounting, so notes never get written to the wrong client after the
  // component has moved on.
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      const pending = pendingNotesRef.current;
      if (pending.dirty) void onUpdateClientNotes(pending.clientId, pending.value);
    };
  }, [client.id]);

  const handleSaveNotesToHistory = async () => {
    if (readOnly) return;
    if (notes.trim() === "") return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    const currentNotes = notes;
    if (pendingNotesRef.current.dirty && !(await persistNotes(client.id, currentNotes))) return;
    const archived = await onSaveNotesToHistory(client.id, currentNotes);
    if (archived) {
      setNotes("");
      pendingNotesRef.current = { clientId: client.id, value: "", dirty: false };
      setNotesSaveState("saved");
    }
  };

  // AI Extract Tasks
  const handleExtractTasks = async () => {
    if (readOnly) return;
    if (notes.trim() === "") {
      setExtractionFeedback("O bloco de notas está vazio. Digite alguma anotação antes de extrair.");
      return;
    }
    setIsExtractingTasks(true);
    setExtractionFeedback(null);

    try {
      const data = await authPostJson<{ tasks?: AIExtractedTaskDTO[] }>("/api/extract-tasks", { notes });

      if (data.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) {
        const results = await Promise.all(data.tasks.map((task) =>
          onAddTask(buildTaskFromAIResult(task, { clientId: client.id }))
        ));
        const createdCount = results.filter(Boolean).length;
        setExtractionFeedback(createdCount === data.tasks.length
          ? `Sucesso! Extraímos ${createdCount} nova(s) tarefa(s) para o seu Kanban com IA.`
          : `${createdCount} de ${data.tasks.length} tarefa(s) foram salvas. Revise os avisos exibidos.`);
      } else {
        setExtractionFeedback("Nenhuma tarefa clara pôde ser extraída do texto.");
      }
    } catch (err) {
      console.error(err);
      setExtractionFeedback(err instanceof ApiError ? err.message : "Ocorreu um erro ao chamar o motor de IA.");
    } finally {
      setIsExtractingTasks(false);
      setTimeout(() => setExtractionFeedback(null), 8000);
    }
  };

  // Real document content extractor via FileReader
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["txt", "md", "csv", "json", "vtt", "sbv"].includes(extension)) {
      showToast("Formato não suportado. Envie TXT, MD, CSV, JSON, VTT ou SBV.", "error");
      e.target.value = "";
      return;
    }
    if (file.size > 1_000_000) {
      showToast("O arquivo excede o limite de 1 MB.", "error");
      e.target.value = "";
      return;
    }

    setUploading(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      const result = event.target?.result;
      let textContent = typeof result === "string" ? result : "";

      if (!textContent || textContent.trim() === "") {
        showToast(`Não foi possível extrair texto do arquivo "${file.name}". Por favor envie um arquivo com texto legível.`, "error");
        setUploading(false);
        return;
      }

      onUploadFile(
        client.id,
        file.name,
        textContent
      );
      setUploading(false);
    };

    reader.onerror = () => {
      showToast(`Erro ao ler o arquivo "${file.name}".`, "error");
      setUploading(false);
    };

    reader.readAsText(file, "UTF-8");
  };

  // Chat with Document submission
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || !selectedFileForChat) return;

    const userMsg = { sender: "user" as const, text: chatMessage };
    setChatHistory((prev) => [...prev, userMsg]);
    setChatMessage("");
    setIsSendingChat(true);

    try {
      const data = await authPostJson<{ answer: string }>("/api/chat-document", {
        fileName: selectedFileForChat.name,
        fileContent: selectedFileForChat.extractedContent,
        message: chatMessage,
        chatHistory,
      });
      setChatHistory((prev) => [...prev, { sender: "ai" as const, text: data.answer }]);
    } catch (err) {
      console.error(err);
      const message = err instanceof ApiError ? err.message : "Houve um erro técnico ao se comunicar com o analista virtual.";
      setChatHistory((prev) => [...prev, { sender: "ai" as const, text: message }]);
    } finally {
      setIsSendingChat(false);
    }
  };

  const startChatWithFile = (file: ClientFile) => {
    setSelectedFileForChat(file);
    setChatHistory([
      { 
        sender: "ai", 
        text: `Olá! Eu sou o assistente cognitivo da Geniality IA. Analisei o arquivo **"${file.name}"**. Do que você precisa saber? (Pergunte sobre valores, prazos ou responsabilidades).` 
      }
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-zinc-800">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all duration-200 shadow-sm"
            title="Voltar para Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${client.logoColor} flex items-center justify-center text-white font-bold text-lg shadow-md`}>
              {client.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white leading-tight">
                {client.name}
              </h1>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <ClientLifecycleControl
            client={client}
            canManage={canManageLifecycle}
            onChange={onSetLifecycle}
            onRemoved={onBack}
          />
          <span className="text-xs font-semibold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">Saúde do Projeto:</span>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold border ${healthMeta.badgeClasses}`}
            title={health.reasons.join(" • ")}
          >
            {healthMeta.emoji} {healthMeta.label}
          </span>
        </div>
      </div>

      {readOnly && (
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-sky-200 dark:border-sky-900/50 bg-sky-50 dark:bg-sky-950/30 text-sky-800 dark:text-sky-300">
          <LockKeyhole className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold">Cliente em modo somente leitura</p>
            <p className="text-xs mt-1">{lifecycleMeta.description} Tarefas, notas, reuniões e arquivos não podem ser alterados neste estado.</p>
          </div>
        </div>
      )}

      {/* PRÓXIMA AÇÃO */}
      <NextActionPanel action={nextAction} profiles={profiles} />

      {/* Tabs Navigation */}
      <div role="tablist" aria-label="Seções do cliente" className="flex items-center gap-1 border-b border-slate-200 dark:border-zinc-800 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
                isActive
                  ? "border-teal-500 text-teal-700 dark:text-teal-400"
                  : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB: QUADRO KANBAN */}
      {activeTab === "kanban" && (
        <div role="tabpanel" className="min-w-0 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-base text-slate-900 dark:text-zinc-100">
                Board Kanban (Tarefas)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-0.5">
                Organize e arraste tarefas entre colunas
              </p>
            </div>

            <button
              onClick={() => setShowAddTaskForm(true)}
              disabled={readOnly}
              className="px-2.5 py-1.5 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-teal-200 dark:border-teal-900/40 hover:bg-teal-100 dark:hover:bg-teal-950/60 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tarefa</span>
            </button>
          </div>

          <div
            className={`h-[calc(100vh-200px)] flex flex-col min-h-0 overflow-hidden ${readOnly ? "opacity-60" : ""}`}
            aria-disabled={readOnly}
          >
            <KanbanBoard
              tasks={clientTasks}
              profiles={profiles}
              clients={allClients || [client]}
              onDeleteTask={onDeleteTask}
              onUpdateTaskColumn={onUpdateTaskColumn}
              onUpdateTask={onUpdateTask}
              readOnly={readOnly}
            />
          </div>
        </div>
      )}

      {/* TAB: BLOCO DE NOTAS & REUNIÕES */}
      {activeTab === "notes" && (
        <div role="tabpanel" className="min-w-0 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-base text-slate-900 dark:text-zinc-100">
              Bloco de Notas & Reuniões
            </h3>
          </div>

          {/* Google Meet AI Bot Launcher */}
          <div className="p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-teal-800/40 rounded-xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-teal-100 dark:bg-teal-500/20 border border-teal-200 dark:border-teal-500/40 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-slate-900 dark:text-zinc-200 block truncate">
                  Geniality Note Taker
                </span>
                <span className="text-[10px] text-slate-500 dark:text-zinc-400 block truncate">
                  Entra na reunião e transcreve para você.
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowMeetBotModal(true)}
              disabled={readOnly}
              className="px-2.5 py-1.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white dark:text-zinc-950 font-bold text-[10px] rounded-lg shadow flex items-center gap-1 shrink-0 cursor-pointer transition-all"
            >
              <Video className="w-3 h-3 text-white dark:text-zinc-950" />
              <span>Conectar na Reunião</span>
            </button>
          </div>

          <div className="relative">
            <textarea
              className="w-full h-80 p-3.5 text-xs text-slate-900 dark:text-zinc-300 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none resize-none font-sans leading-relaxed"
              placeholder="Escreva anotações em tempo real da reunião aqui..."
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              onBlur={() => {
                if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                const pending = pendingNotesRef.current;
                if (pending.dirty) void persistNotes(pending.clientId, pending.value);
              }}
              disabled={readOnly}
            />
            {!readOnly && (
              <span className={`absolute bottom-2.5 right-3 text-[10px] font-medium ${notesSaveState === "error" ? "text-red-600 dark:text-red-400" : "text-slate-400 dark:text-zinc-500"}`} aria-live="polite">
                {notesSaveState === "saving" ? "Salvando…" : notesSaveState === "saved" ? "Salvo" : notesSaveState === "error" ? "Erro ao salvar" : "Alterações salvas automaticamente"}
              </span>
            )}
          </div>

          {/* AI Task Extraction and Save */}
          <div className="space-y-2">
            <button
              onClick={handleExtractTasks}
              disabled={isExtractingTasks || readOnly}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white dark:text-zinc-950 font-bold text-xs rounded-xl shadow-md transition-all duration-150 disabled:opacity-50 cursor-pointer"
            >
              {isExtractingTasks ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white dark:text-zinc-950" />
                  <span>Analisando Anotações...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-white dark:text-zinc-950 " />
                  <span>Anotar Tarefas</span>
                </>
              )}
            </button>

            <button
              onClick={handleSaveNotesToHistory}
              disabled={readOnly}
              className="w-full py-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-semibold rounded-xl transition-colors duration-150 border border-slate-200 dark:border-transparent"
            >
              Salvar Anotação no Histórico
            </button>
          </div>

          {extractionFeedback && (
            <div className="p-3 bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-400 rounded-xl text-xs flex gap-2 items-start border border-teal-200 dark:border-teal-900/50">
              <Sparkles className="w-4 h-4 shrink-0 text-teal-600 dark:text-teal-500" />
              <span>{extractionFeedback}</span>
            </div>
          )}

          {/* Collapsible History */}
          <div className="border-t border-slate-200 dark:border-zinc-800 pt-3">
            <button
              onClick={() => setHistoryOpen(!historyOpen)}
              className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors py-1"
            >
              <span className="flex items-center gap-2">
                Anotações Anteriores ({client.notesHistory.length})
              </span>
              {historyOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {historyOpen && (
              <div className="mt-3 space-y-3 max-h-56 overflow-y-auto pr-1">
                {detailsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-teal-500" />
                  </div>
                ) : client.notesHistory.length === 0 ? (
                  <p className="text-[11px] text-slate-500 dark:text-zinc-500 italic text-center py-2">
                    Nenhuma anotação antiga salva.
                  </p>
                ) : (
                  client.notesHistory.map((item) => (
                    <div key={item.id} className="p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800">
                      <div className="flex justify-between items-center mb-1.5 text-[10px] font-semibold text-slate-500 dark:text-zinc-500">
                        <span>Reunião</span>
                        <span>{formatDate(item.date)}</span>
                      </div>
                      <p className="text-[11px] text-slate-700 dark:text-zinc-400 whitespace-pre-wrap leading-normal">
                        {item.content}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: DOCUMENTOS */}
      {activeTab === "documents" && (
        <div role="tabpanel" className="min-w-0 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-base text-slate-900 dark:text-zinc-100">
              Documentos
            </h3>
            <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-500">
              PDF, DOCX
            </span>
          </div>

          {/* Files List */}
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {detailsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-teal-500" />
              </div>
            ) : client.files.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 dark:text-zinc-500 italic">
                Nenhum arquivo anexado.
              </div>
            ) : (
              client.files.map((file) => (
                <div
                  key={file.id}
                  className="p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800/80 hover:border-teal-500/20 transition-all duration-200 flex flex-col gap-2 group"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                      <div className="overflow-hidden">
                        <span className="text-[11px] font-semibold text-slate-800 dark:text-zinc-200 block truncate" title={file.name}>
                          {file.name}
                        </span>
                        <span className="text-[9px] text-slate-500 dark:text-zinc-500 block">
                          {file.size} • {formatDate(file.uploadDate)}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => !readOnly && setFileToDelete(file)}
                      disabled={readOnly}
                      className="p-1 rounded text-slate-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
                      title="Excluir arquivo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Talk with File Button */}
                  <button
                    onClick={() => startChatWithFile(file)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-teal-500/40 hover:text-teal-600 dark:hover:text-teal-400 rounded-lg text-[10px] font-bold text-slate-600 dark:text-zinc-400 shadow-sm transition-all duration-150 cursor-pointer"
                  >
                    <MessageSquare className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                    <span>Conversar com Arquivo (IA)</span>
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Upload Button */}
          <div>
            <label className="w-full flex flex-col items-center justify-center gap-2 px-4 py-4 bg-slate-50 dark:bg-zinc-950 border border-dashed border-slate-300 dark:border-zinc-800 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-900/60 transition-all duration-200 cursor-pointer text-center group">
              {uploading ? (
                <div className="flex flex-col items-center gap-1.5 py-1">
                  <Loader2 className="w-5 h-5 text-teal-600 dark:text-teal-400 animate-spin" />
                  <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400 ">
                    A Carregar...
                  </span>
                  <span className="text-[9px] text-slate-500 dark:text-zinc-500 font-mono">
                    Indexando metadados no Gemini
                  </span>
                </div>
              ) : (
                <>
                  <Upload className="w-5 h-5 text-slate-400 dark:text-zinc-500 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" />
                  <div>
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300 block">
                      Anexar Novo Arquivo
                    </span>
                    <span className="text-[9px] text-slate-500 dark:text-zinc-500 block mt-0.5">
                      Arraste ou clique para selecionar
                    </span>
                  </div>
                </>
              )}
              <input
                type="file"
                className="hidden"
                accept=".txt,.md,.csv,.json,.vtt,.sbv,text/plain,text/csv,application/json"
                onChange={handleFileUpload}
                disabled={uploading || readOnly}
              />
            </label>
          </div>
        </div>
      )}

      {/* TAB: AUDITORIA */}
      {activeTab === "audit" && (
        <div role="tabpanel" className="min-w-0">
          <ClientTimeline events={timelineEvents} loading={timelineLoading} />
        </div>
      )}

      {/* CHAT WITH DOCUMENT MODAL (POPUP) */}
      {selectedFileForChat && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/40 flex justify-between items-center">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/40 flex items-center justify-center text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-900/40">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="overflow-hidden">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-100 block truncate">
                    Analista de Arquivos AI
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                    Lendo: {selectedFileForChat.name}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedFileForChat(null)}
                className="p-1 rounded-lg text-slate-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Chat Body */}
            <div className="flex-1 p-4 space-y-3 overflow-y-auto h-80 min-h-[300px] bg-slate-50 dark:bg-zinc-950/30 scroll-smooth scrollbar-thin scrollbar-thumb-zinc-800">
              {chatHistory.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm ${
                    msg.sender === "user"
                      ? "bg-teal-600 text-white dark:text-zinc-950 font-bold rounded-tr-none"
                      : "bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-200 border border-slate-200 dark:border-zinc-800 rounded-tl-none"
                  }`}>
                    {msg.sender === "ai" && (
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-1">
                        <Sparkles className="w-3 h-3 text-teal-600 dark:text-teal-400 " />
                        <span>Geniality IA</span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              ))}
              {isSendingChat && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-200 border border-slate-200 dark:border-zinc-800 rounded-2xl rounded-tl-none px-4 py-3 text-xs flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-teal-600 dark:text-teal-400" />
                    <span className="text-slate-500 dark:text-zinc-500">Analisando o PDF comercial...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Prompt suggestions */}
            <div className="px-4 py-2 bg-slate-100 dark:bg-zinc-950/20 border-t border-slate-200 dark:border-zinc-800/60 flex flex-wrap gap-1.5">
              <button
                onClick={() => setChatMessage("Qual o valor estipulado no documento?")}
                className="text-[10px] bg-white dark:bg-zinc-950 hover:bg-slate-200 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 px-2 py-1 rounded-md transition-colors cursor-pointer"
              >
                Qual o valor?
              </button>
              <button
                onClick={() => setChatMessage("Quais os prazos de entrega e deploy?")}
                className="text-[10px] bg-white dark:bg-zinc-950 hover:bg-slate-200 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 px-2 py-1 rounded-md transition-colors cursor-pointer"
              >
                Quais os prazos?
              </button>
              <button
                onClick={() => setChatMessage("Quais as obrigações e requisitos?")}
                className="text-[10px] bg-white dark:bg-zinc-950 hover:bg-slate-200 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 px-2 py-1 rounded-md transition-colors cursor-pointer"
              >
                Quais as obrigações?
              </button>
            </div>

            {/* Chat Footer */}
            <form onSubmit={handleSendChatMessage} className="p-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 flex gap-2">
              <input
                type="text"
                placeholder="Pergunte algo sobre o arquivo..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                disabled={isSendingChat}
                className="flex-1 px-3 py-2 text-xs text-slate-900 dark:text-zinc-200 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:border-teal-500"
              />
              <button
                type="submit"
                disabled={isSendingChat || !chatMessage.trim()}
                className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white dark:text-zinc-950 font-bold rounded-xl flex items-center justify-center transition-colors shadow cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

          </div>
        </div>
      )}

      {/* MEET BOT MODAL */}
      {showMeetBotModal && !readOnly && (
        <Suspense fallback={null}><MeetBotModal
          client={client}
          onClose={() => setShowMeetBotModal(false)}
          onViewKanban={() => {
            setShowMeetBotModal(false);
            setActiveTab("kanban");
          }}
          onDepositNotes={async (clientId, newNotes) => {
            const saved = await onDepositNotes(clientId, newNotes);
            if (!saved) return false;
            if (clientId === client.id) {
              setNotes(newNotes);
            }
            setExtractionFeedback("✨ Anotações da reunião depositadas com sucesso! As tarefas extraídas já foram incluídas na esteira Kanban.");
            return true;
          }}
          onAddTasks={(newTasks) => Promise.all(newTasks.map((task) => Promise.resolve(onAddTask(task))))}
        /></Suspense>
      )}

      {/* QUICK TASK MODAL */}
      {showAddTaskForm && !readOnly && (
        <QuickTaskModal
          clients={allClients || [client]}
          initialClientId={client.id}
          lockClient
          onClose={() => setShowAddTaskForm(false)}
          onAddTask={onAddTask}
        />
      )}

      {fileToDelete && (
        <ConfirmDialog
          title="Excluir arquivo"
          message={`Tem certeza que deseja excluir "${fileToDelete.name}"? Esta ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          onConfirm={() => {
            onDeleteFile(client.id, fileToDelete.id);
            setFileToDelete(null);
          }}
          onCancel={() => setFileToDelete(null)}
        />
      )}

    </div>
  );
}

