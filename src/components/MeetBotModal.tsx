import React, { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { Client, CalendarEvent, Task, AIExtractedTaskDTO } from "../types";
import { supabase } from "../lib/supabaseClient";
import { buildTaskFromAIResult } from "../lib/taskMappers";
import { authPostJson, ApiError } from "../lib/apiClient";
import { updateOwnPresence } from "../lib/profilePresence";
import { connectGoogleCalendar } from "../lib/googleCalendarAuth";
import { useToast } from "./common/ToastProvider";
import { useModalDialog } from "../hooks/useModalDialog";
import {
  Video,
  Calendar,
  X,
  Bot,
  Sparkles,
  CheckCircle2,
  Loader2,
  ArrowRight,
  FileText,
  Upload,
  Clipboard,
  ListPlus,
  RefreshCw,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

interface MeetBotModalProps {
  client: Client;
  onClose: () => void;
  onDepositNotes: (clientId: string, notes: string) => Promise<boolean>;
  onAddTasks?: (tasks: Array<Omit<Task, "id">>) => Promise<boolean[]>;
  /** Called instead of onClose when the user finishes reviewing results, so the host can also jump to the Kanban tab. */
  onViewKanban?: () => void;
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}

/** Sets a user's presence status when joining/leaving a meeting (dedupes two near-identical update calls). */
async function setMeetingStatus(clientId: string | null, status: "in_meeting" | "available") {
  return updateOwnPresence(status, clientId);
}

/** Persists a processed meeting (dedupes two near-identical insert calls). */
async function saveMeeting(params: {
  clientId: string;
  createdBy: string;
  title: string;
  rawTranscript: string;
  generatedNotes: string;
}) {
  return supabase.from("meetings").insert({
    client_id: params.clientId,
    created_by: params.createdBy,
    title: params.title,
    occurred_at: new Date().toISOString(),
    raw_transcript: params.rawTranscript,
    generated_notes: params.generatedNotes,
  });
}

export default function MeetBotModal({
  client,
  onClose,
  onDepositNotes,
  onAddTasks,
  onViewKanban,
}: MeetBotModalProps) {
  const { showToast } = useToast();
  const dialogRef = useModalDialog(onClose);

  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState<boolean>(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [meetingLink, setMeetingLink] = useState<string>("");
  const [sessionStarted, setSessionStarted] = useState(false);

  // Google Calendar Integration State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userToken, setUserToken] = useState<string | null>(null);
  const [isGoogleLinked, setIsGoogleLinked] = useState<boolean>(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  // Initialize Auth listener and check Google Calendar identity
  useEffect(() => {
    const checkCalendarAuth = async () => {
      setLoadingCalendar(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        setCurrentUser(session.user);
        const hasGoogleIdentity = session.user.identities?.some((id) => id.provider === "google");
        setIsGoogleLinked(!!hasGoogleIdentity);

        const token = session.provider_token;
        if (token) {
          setUserToken(token);
          await fetchRealCalendar(token);
        } else {
          setUserToken(null);
          if (hasGoogleIdentity) {
            setCalendarError("Sua conexão com o Google Calendar expirou, reconecte.");
          }
          setLoadingCalendar(false);
        }
      } else {
        setLoadingCalendar(false);
      }
    };

    checkCalendarAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchRealCalendar = async (token: string) => {
    setLoadingCalendar(true);
    setCalendarError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/google-calendar/events", {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(session?.access_token
            ? { "X-Supabase-Authorization": `Bearer ${session.access_token}` }
            : {}),
        },
      });
      const data = await res.json();
      if (res.ok && data.events) {
        setCalendarEvents(data.events);
        if (data.events.length > 0) {
          setSelectedEvent(data.events[0]);
          if (data.events[0].meetLink) {
            setMeetingLink(data.events[0].meetLink);
          }
        }
      } else {
        setCalendarEvents([]);
        if (res.status === 401) {
          setCalendarError("Sua conexão com o Google Calendar expirou, reconecte.");
        } else {
          setCalendarError(data.error || "Não foi possível carregar as reuniões da sua agenda.");
        }
      }
    } catch (err) {
      console.error("Error fetching real calendar:", err);
      setCalendarError(errorMessage(err, "Erro de rede ao conectar com o Google Calendar."));
    } finally {
      setLoadingCalendar(false);
    }
  };

  const handleConnectGoogleCalendar = async () => {
    setIsConnecting(true);
    setCalendarError(null);
    try {
      const error = await connectGoogleCalendar();
      if (error) {
        setCalendarError(error || "Erro ao conectar Google Calendar.");
        setIsConnecting(false);
      }
    } catch (err) {
      console.error("Link identity error:", err);
      setCalendarError(errorMessage(err, "Erro ao solicitar autorização do Google."));
      setIsConnecting(false);
    }
  };

  // Bot Meeting Room state
  const [botStatus, setBotStatus] = useState<"idle" | "summarizing" | "completed">("idle");
  const [pastedTranscriptText, setPastedTranscriptText] = useState<string>("");
  const [generatedNotes, setGeneratedNotes] = useState<string>("");
  const [extractedTasks, setExtractedTasks] = useState<Array<Omit<Task, "id">>>([]);

  // Opens the real meeting link (if any) and marks presence as in_meeting —
  // a convenience action, independent from importing the transcript below.
  const handleStartSession = async () => {
    if (meetingLink.trim()) {
      try {
        const url = new URL(meetingLink.startsWith("http") ? meetingLink : `https://${meetingLink}`);
        if (url.hostname !== "meet.google.com") throw new Error("invalid host");
        window.open(url.toString(), "_blank", "noopener,noreferrer");
      } catch {
        showToast("Informe um link válido do Google Meet, como meet.google.com/abc-defg-hij.", "error");
        return;
      }
    }
    if (currentUser?.id) {
      const { error } = await setMeetingStatus(client.id, "in_meeting");
      if (error) console.error("Erro ao atualizar status para em reunião:", error);
    }
    setSessionStarted(true);
  };

  // Handle file upload for transcript
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["txt", "vtt", "sbv"].includes(extension)) {
      showToast("Formato de transcrição não suportado. Envie TXT, VTT ou SBV.", "error");
      e.target.value = "";
      return;
    }
    if (file.size > 1_000_000) {
      showToast("A transcrição excede o limite de 1 MB.", "error");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setPastedTranscriptText(content);
      }
    };
    reader.readAsText(file);
  };

  // Process Pasted / Uploaded Transcript
  const handleProcessTranscript = async () => {
    if (!pastedTranscriptText.trim()) return;

    setBotStatus("summarizing");
    try {
      const data = await authPostJson<{ notes?: string; extractedTasks?: AIExtractedTaskDTO[] }>(
        "/api/meet/summarize-transcript",
        {
          transcript: pastedTranscriptText,
          meetingTitle: selectedEvent?.summary || "Transcrição do Google Meet",
          clientName: client.name,
        }
      );

      const notesResult = data.notes || "Anotações geradas com sucesso.";
      const tasksResult = (data.extractedTasks || []).map((t) =>
        buildTaskFromAIResult(t, {
          clientId: client.id,
          defaultDescription: "Criada automaticamente via Note Taker",
          defaultUrgency: "Urgente",
        })
      );

      setGeneratedNotes(notesResult);
      const taskSaveResults = onAddTasks && tasksResult.length > 0 ? await onAddTasks(tasksResult) : [];
      const savedTasks = onAddTasks ? tasksResult.filter((_, index) => taskSaveResults[index] === true) : [];
      setExtractedTasks(savedTasks);
      setBotStatus("completed");

      if (currentUser?.id) {
        const { error: meetErr } = await saveMeeting({
          clientId: client.id,
          createdBy: currentUser.id,
          title: selectedEvent?.summary || "Transcrição do Google Meet",
          rawTranscript: pastedTranscriptText,
          generatedNotes: notesResult,
        });
        if (meetErr) console.error("Erro ao salvar reunião na tabela meetings:", meetErr);
      }

      const notesSaved = await onDepositNotes(client.id, notesResult);
      if (!notesSaved) throw new Error("As anotações não puderam ser salvas.");

      if (sessionStarted && currentUser?.id) {
        const { error: profErr } = await setMeetingStatus(null, "available");
        if (profErr) console.error("Erro ao restaurar status do perfil:", profErr);
      }
    } catch (err) {
      console.error(err);
      showToast(errorMessage(err, "Ocorreu um erro ao processar a transcrição com a IA."), "error");
      setBotStatus("idle");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="meetbot-title" className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">

        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 bg-white dark:bg-zinc-900/80 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-500 flex items-center justify-center text-zinc-950 font-bold shadow-lg shadow-teal-500/20 shrink-0">
              <Bot className="w-5 h-5 text-zinc-950" />
            </div>
            <div className="min-w-0">
              <h2 id="meetbot-title" className="text-base font-display font-bold text-slate-900 dark:text-white truncate">
                Conectar na Reunião
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                {client.name} · a IA resume a reunião e extrai tarefas para o Kanban
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">

          {botStatus === "idle" && (
            <div className="space-y-6">
              {/* Calendário de Reuniões */}
              <div className="bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-teal-500" />
                    <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                      Calendário de Reuniões
                    </h3>
                  </div>

                  {isGoogleLinked && userToken ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Google Calendar Conectado</span>
                      </span>
                      <button
                        onClick={() => fetchRealCalendar(userToken)}
                        title="Atualizar reuniões da agenda"
                        className="p-1 rounded-lg bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 transition-colors border border-slate-200 dark:border-zinc-700"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : isGoogleLinked ? (
                    <span className="text-[10px] bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 px-2 py-0.5 rounded-full font-bold">
                      Conexão Expirada
                    </span>
                  ) : (
                    <span className="text-[10px] bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-300 dark:border-zinc-700 px-2 py-0.5 rounded-full font-bold">
                      Não Conectado
                    </span>
                  )}
                </div>

                {!isGoogleLinked ? (
                  <div className="p-4 bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 rounded-xl space-y-3">
                    <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed text-center">
                      Conecte sua conta do Google para visualizar e importar reuniões agendadas no seu Google Calendar.
                    </p>
                    <button
                      onClick={handleConnectGoogleCalendar}
                      disabled={isConnecting}
                      className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 border border-teal-500 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isConnecting ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Calendar className="w-4 h-4 text-white" />}
                      <span>{isConnecting ? "Conectando ao Google..." : "Conectar Google Calendar"}</span>
                    </button>
                  </div>
                ) : !userToken ? (
                  <div className="p-4 bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 rounded-xl space-y-3">
                    <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed text-center">
                      Sua conexão com o Google Calendar expirou, reconecte para renovar a permissão.
                    </p>
                    <button
                      onClick={handleConnectGoogleCalendar}
                      disabled={isConnecting}
                      className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 border border-amber-500 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isConnecting ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <RefreshCw className="w-4 h-4 text-white" />}
                      <span>Reconectar Google Calendar</span>
                    </button>
                  </div>
                ) : loadingCalendar ? (
                  <div className="py-6 text-center space-y-2">
                    <Loader2 className="w-5 h-5 animate-spin text-teal-500 mx-auto" />
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">Buscando reuniões reais na sua agenda do Google...</p>
                  </div>
                ) : calendarError ? (
                  <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-xs text-red-700 dark:text-red-300 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                      <span>{calendarError}</span>
                    </div>
                    <div className="flex gap-2">
                      {userToken && (
                        <button onClick={() => fetchRealCalendar(userToken)} className="px-2.5 py-1 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-lg text-[10px] font-bold border border-slate-200 dark:border-zinc-700">
                          Tentar Novamente
                        </button>
                      )}
                      <button onClick={handleConnectGoogleCalendar} className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold">
                        Reconectar
                      </button>
                    </div>
                  </div>
                ) : calendarEvents.length === 0 ? (
                  <div className="py-6 text-center bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800/60 rounded-xl space-y-1">
                    <Calendar className="w-6 h-6 text-slate-400 dark:text-zinc-600 mx-auto mb-1" />
                    <p className="text-xs font-semibold text-slate-600 dark:text-zinc-300">Nenhuma reunião futura agendada na sua conta do Google.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto pr-1">
                    {calendarEvents.map((evt) => {
                      const isSelected = selectedEvent?.id === evt.id;
                      const startTime = new Date(evt.start).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                      const endTime = new Date(evt.end).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                      const startDate = new Date(evt.start).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
                      return (
                        <div
                          key={evt.id}
                          onClick={() => {
                            setSelectedEvent(evt);
                            if (evt.meetLink) setMeetingLink(evt.meetLink);
                          }}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isSelected
                              ? "bg-teal-50 dark:bg-teal-950/30 border-teal-400 dark:border-teal-500/60 ring-1 ring-teal-500/30"
                              : "bg-white dark:bg-zinc-900/80 border-slate-200 dark:border-zinc-800/80 hover:border-teal-500/40"
                          }`}
                        >
                          <div className="space-y-1 overflow-hidden">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-teal-500 shrink-0" />
                              <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-100 truncate">{evt.summary}</h4>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-slate-500 dark:text-zinc-400 font-mono">
                              <span>📅 {startDate} às {startTime}–{endTime}</span>
                            </div>
                          </div>
                          {isSelected && (
                            <span className="text-[10px] font-bold text-teal-700 dark:text-teal-400 bg-teal-100 dark:bg-teal-950/80 px-2 py-0.5 rounded-md border border-teal-300 dark:border-teal-700/60 shrink-0">
                              Selecionada
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Link da Reunião + Iniciar Sessão */}
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-2">
                  Link da Reunião
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Video className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="meet.google.com/abc-defg-hij"
                      value={meetingLink}
                      onChange={(e) => setMeetingLink(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-mono text-slate-800 dark:text-zinc-200 outline-none focus:border-teal-500"
                    />
                  </div>
                  <button
                    onClick={handleStartSession}
                    className={`px-4 py-3 font-bold text-xs rounded-xl flex items-center justify-center gap-2 shrink-0 transition-all cursor-pointer ${
                      sessionStarted
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40"
                        : "bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white shadow-md"
                    }`}
                  >
                    {sessionStarted ? <CheckCircle2 className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
                    <span>{sessionStarted ? "Sessão iniciada" : "Iniciar Sessão"}</span>
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-zinc-500">
                  Abre o link da reunião em uma nova aba e marca seu status como "Em reunião".
                </p>
              </div>

              {/* Importar Transcrição */}
              <div className="space-y-3 border-t border-slate-100 dark:border-zinc-800 pt-6">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                    <Clipboard className="w-3.5 h-3.5" />
                    Importar Transcrição
                  </label>
                  <label className="cursor-pointer px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors">
                    <Upload className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    <span>Enviar Arquivo</span>
                    <input type="file" accept=".txt,.vtt,.sbv,text/plain,text/vtt" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>

                <textarea
                  rows={7}
                  placeholder="Cole aqui o texto ou transcrição exportada do Google Meet / Tactiq, após a reunião terminar..."
                  value={pastedTranscriptText}
                  onChange={(e) => setPastedTranscriptText(e.target.value)}
                  className="w-full p-4 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl text-xs font-mono text-slate-800 dark:text-zinc-200 outline-none focus:border-teal-500 resize-none leading-relaxed"
                />

                <button
                  onClick={handleProcessTranscript}
                  disabled={!pastedTranscriptText.trim()}
                  className="w-full py-4 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 disabled:opacity-50 text-white font-bold text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Sparkles className="w-5 h-5 text-white" />
                  <span>Anotar Tarefas</span>
                </button>
              </div>
            </div>
          )}

          {/* Summarizing State */}
          {botStatus === "summarizing" && (
            <div className="py-16 text-center space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-teal-500 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Sintetizando anotações e extraindo tarefas...
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Gerando relatório para o Bloco de Notas de <span className="text-teal-600 dark:text-teal-400 font-bold">{client.name}</span> e cadastrando pendências no Kanban.
                </p>
              </div>
            </div>
          )}

          {/* Completed State */}
          {botStatus === "completed" && (
            <div className="space-y-6 text-left">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                    Reunião processada com sucesso!
                  </h3>
                  <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">
                    Anotações salvas em <strong>{client.name}</strong> e <strong>{extractedTasks.length} tarefa(s)</strong> adicionada(s) à esteira Kanban.
                  </p>
                </div>
              </div>

              {extractedTasks.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <ListPlus className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <label className="text-xs font-bold text-slate-600 dark:text-zinc-300 uppercase tracking-wider block">
                      Tarefas adicionadas ao Kanban ({extractedTasks.length})
                    </label>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {extractedTasks.map((t, i) => (
                      <div key={i} className="p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80 rounded-xl space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{t.title}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800 shrink-0">
                            {t.urgency}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-2">{t.description}</p>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono block">Prazo: {t.deadline}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
                  Anotações sintetizadas (Bloco de Notas)
                </label>
                <div className="p-4 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl max-h-52 overflow-y-auto text-xs text-slate-600 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {generatedNotes}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={() => (onViewKanban ? onViewKanban() : onClose())}
                  className="flex-1 py-3.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <FileText className="w-4 h-4" />
                  <span>Ver Tarefas no Kanban</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-3.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 font-semibold text-xs rounded-xl cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
