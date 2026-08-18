import React, { useState, useEffect, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import { Client, CalendarEvent, MeetingTranscriptEntry, Task, AIExtractedTaskDTO } from "../types";
import { supabase } from "../lib/supabaseClient";
import { buildTaskFromAIResult } from "../lib/taskMappers";
import { authPostJson, ApiError } from "../lib/apiClient";
import { updateOwnPresence } from "../lib/profilePresence";
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
  Mic,
  MicOff,
  Square,
  ArrowRight,
  User as UserIcon,
  Clock,
  Zap,
  FileText,
  Upload,
  Clipboard,
  ListPlus,
  Radio,
  RefreshCw,
  AlertCircle
} from "lucide-react";

interface MeetBotModalProps {
  clients: Client[];
  initialClientId?: string;
  onClose: () => void;
  onDepositNotes: (clientId: string, notes: string) => Promise<boolean>;
  onAddTasks?: (tasks: Array<Omit<Task, "id">>) => Promise<boolean[]>;
  onNavigateToClient?: (clientId: string) => void;
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}

// The Web Speech API isn't part of TypeScript's standard DOM lib, so we
// declare the minimal surface this component actually uses.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
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
  clients,
  initialClientId,
  onClose,
  onDepositNotes,
  onAddTasks,
  onNavigateToClient,
}: MeetBotModalProps) {
  const { showToast } = useToast();
  const dialogRef = useModalDialog(onClose);
  const [selectedClientId, setSelectedClientId] = useState<string>(
    initialClientId || clients[0]?.id || ""
  );
  
  const [activeTab, setActiveTab] = useState<"live" | "paste">("live");
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState<boolean>(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [customMeetUrl, setCustomMeetUrl] = useState<string>("");

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
            setCustomMeetUrl(data.events[0].meetLink);
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
      const { error } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/calendar.readonly',
          redirectTo: window.location.origin,
        }
      });
      if (error) {
        setCalendarError(error.message || "Erro ao conectar Google Calendar.");
        setIsConnecting(false);
      }
    } catch (err) {
      console.error("Link identity error:", err);
      setCalendarError(errorMessage(err, "Erro ao solicitar autorização do Google."));
      setIsConnecting(false);
    }
  };

  // Bot Meeting Room state
  const [botStatus, setBotStatus] = useState<"idle" | "joining" | "connected" | "summarizing" | "completed">("idle");
  const [transcript, setTranscript] = useState<MeetingTranscriptEntry[]>([]);
  const [pastedTranscriptText, setPastedTranscriptText] = useState<string>("");
  const [generatedNotes, setGeneratedNotes] = useState<string>("");
  const [extractedTasks, setExtractedTasks] = useState<Array<Omit<Task, "id">>>([]);

  // Real Web Speech API Mic Recording State
  const [isMicListening, setIsMicListening] = useState<boolean>(false);
  const [micSupported, setMicSupported] = useState<boolean>(true);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const selectedClient = clients.find((c) => c.id === selectedClientId) || clients[0];

  // Initialize Speech Recognition if browser supports it
  useEffect(() => {
    if (!getSpeechRecognitionConstructor()) {
      setMicSupported(false);
    }
  }, []);

  // Toggle Browser Microphone Transcription
  const toggleMicrophone = () => {
    const SpeechRecognition = getSpeechRecognitionConstructor();

    if (!SpeechRecognition) {
      showToast("Seu navegador não suporta a API de Reconhecimento de Voz nativa. Você pode usar a simulação ou colar o texto da reunião.", "error");
      return;
    }

    if (isMicListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsMicListening(false);
    } else {
      try {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = "pt-BR";

        rec.onstart = () => {
          setIsMicListening(true);
        };

        rec.onresult = (event) => {
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              const spokenText = event.results[i][0].transcript.trim();
              if (spokenText) {
                const now = new Date();
                const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                setTranscript((prev) => [
                  ...prev,
                  {
                    id: `tr-mic-${Date.now()}-${Math.random()}`,
                    timestamp: timeStr,
                    speaker: "Você / Participante (Meet Mic)",
                    text: spokenText,
                  },
                ]);
              }
            }
          }
        };

        rec.onerror = (err) => {
          console.error("Speech Recognition Error:", err);
          setIsMicListening(false);
        };

        rec.onend = () => {
          setIsMicListening(false);
        };

        rec.start();
        recognitionRef.current = rec;
      } catch (err) {
        console.error("Erro ao iniciar microfone:", err);
        showToast("Não foi possível acessar o microfone. Verifique as permissões no navegador.", "error");
      }
    }
  };

  // Handle Start Recording Session
  const handleJoinMeet = async () => {
    if (!selectedClient) {
      showToast("Cadastre ou restaure um cliente antes de iniciar uma reunião.", "error");
      return;
    }
    if (customMeetUrl.trim()) {
      try {
        const url = new URL(customMeetUrl.startsWith("http") ? customMeetUrl : `https://${customMeetUrl}`);
        if (url.hostname !== "meet.google.com") throw new Error("invalid host");
        window.open(url.toString(), "_blank", "noopener,noreferrer");
      } catch {
        showToast("Informe um link válido do Google Meet, como meet.google.com/abc-defg-hij.", "error");
        return;
      }
    }
    setBotStatus("joining");
    setTranscript([]);

    // Update profile status to in_meeting
    if (currentUser?.id) {
      const { error } = await setMeetingStatus(selectedClientId || null, "in_meeting");
      if (error) {
        console.error("Erro ao atualizar status para em reunião:", error);
      }
    }

    setTimeout(() => {
      setBotStatus("connected");
    }, 1000);
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

  // Process Pasted / Uploaded Transcript directly
  const handleProcessPastedTranscript = async () => {
    if (!pastedTranscriptText.trim()) return;

    setBotStatus("summarizing");
    try {
      const data = await authPostJson<{ notes?: string; extractedTasks?: AIExtractedTaskDTO[] }>(
        "/api/meet/summarize-transcript",
        {
          transcript: pastedTranscriptText,
          meetingTitle: selectedEvent?.summary || "Transcrição do Google Meet",
          clientName: selectedClient?.name || "Cliente",
        }
      );

      const notesResult = data.notes || "Anotações geradas com sucesso.";
      const tasksResult = (data.extractedTasks || []).map((t) =>
        buildTaskFromAIResult(t, {
          clientId: selectedClientId,
          defaultDescription: "Criada automaticamente via Bot do Google Meet",
          defaultUrgency: "Urgente",
        })
      );

      setGeneratedNotes(notesResult);
      const taskSaveResults = onAddTasks && tasksResult.length > 0 ? await onAddTasks(tasksResult) : [];
      const savedTasks = onAddTasks ? tasksResult.filter((_, index) => taskSaveResults[index] === true) : [];
      setExtractedTasks(savedTasks);
      setBotStatus("completed");

      if (selectedClientId && currentUser?.id) {
        const { error: meetErr } = await saveMeeting({
          clientId: selectedClientId,
          createdBy: currentUser.id,
          title: selectedEvent?.summary || "Transcrição do Google Meet",
          rawTranscript: pastedTranscriptText,
          generatedNotes: notesResult,
        });
        if (meetErr) console.error("Erro ao salvar reunião na tabela meetings:", meetErr);
      }

      if (selectedClientId) {
        const notesSaved = await onDepositNotes(selectedClientId, notesResult);
        if (!notesSaved) throw new Error("As anotações não puderam ser salvas.");
      }

    } catch (err) {
      console.error(err);
      showToast(errorMessage(err, "Ocorreu um erro ao processar a transcrição com a IA."), "error");
      setBotStatus("idle");
    }
  };

  // Finish Live Meeting & Summarize via Gemini
  const handleFinishAndSummarize = async () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsMicListening(false);
    setBotStatus("summarizing");

    if (currentUser?.id) {
      // Revert status to available
      const { error: profErr } = await setMeetingStatus(null, "available");
      if (profErr) {
        console.error("Erro ao restaurar status do perfil:", profErr);
      }
    }

    try {
      const data = await authPostJson<{ notes?: string; extractedTasks?: AIExtractedTaskDTO[] }>(
        "/api/meet/summarize-transcript",
        {
          transcript,
          meetingTitle: selectedEvent?.summary || "Alinhamento Google Meet",
          clientName: selectedClient?.name || "Cliente",
        }
      );

      const notesResult = data.notes || "Anotações geradas com sucesso pelo Bot do Google Meet.";
      const tasksResult = (data.extractedTasks || []).map((t) =>
        buildTaskFromAIResult(t, {
          clientId: selectedClientId,
          defaultDescription: "Criada automaticamente via Bot do Google Meet",
          defaultUrgency: "Urgente",
        })
      );

      setGeneratedNotes(notesResult);
      const taskSaveResults = onAddTasks && tasksResult.length > 0 ? await onAddTasks(tasksResult) : [];
      const savedTasks = onAddTasks ? tasksResult.filter((_, index) => taskSaveResults[index] === true) : [];
      setExtractedTasks(savedTasks);
      setBotStatus("completed");

      // Save complete meeting to Supabase
      if (selectedClientId && currentUser?.id) {
        const fullTranscriptText = transcript.map(t => `${t.speaker} (${t.timestamp}): ${t.text}`).join("\n");
        const { error: meetErr } = await saveMeeting({
          clientId: selectedClientId,
          createdBy: currentUser.id,
          title: selectedEvent?.summary || "Alinhamento Google Meet",
          rawTranscript: fullTranscriptText || "Transcrição de áudio ao vivo.",
          generatedNotes: notesResult,
        });
        if (meetErr) console.error("Erro ao salvar reunião na tabela meetings:", meetErr);
      }

      // Auto deposit directly into client's Bloco de Notas
      if (selectedClientId) {
        const notesSaved = await onDepositNotes(selectedClientId, notesResult);
        if (!notesSaved) throw new Error("As anotações não puderam ser salvas.");
      }

    } catch (err) {
      console.error(err);
      showToast(errorMessage(err, "Ocorreu um erro ao gerar o resumo da reunião com a IA."), "error");
      setBotStatus("idle");
    }
  };

  if (!selectedClient) {
    return (
      <>
        <button type="button" aria-label="Fechar" onClick={onClose} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm cursor-default" />
        <aside
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="meet-empty-title"
          className="fixed right-0 top-0 z-[60] flex h-full w-full max-w-md flex-col items-center justify-center border-l border-slate-200 bg-white p-6 text-center shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
        >
          <AlertCircle className="mx-auto h-8 w-8 text-amber-500" />
          <h2 id="meet-empty-title" className="mt-3 text-base font-bold text-slate-900 dark:text-white">Nenhum cliente disponível</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">Cadastre ou restaure um cliente para gravar uma reunião e salvar as anotações.</p>
          <button type="button" onClick={onClose} className="mt-5 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-700">Fechar</button>
        </aside>
      </>
    );
  }

  return (
    <>
      <button type="button" aria-label="Fechar" onClick={onClose} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm cursor-default" />
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="meetbot-title"
        className="fixed right-0 top-0 z-[60] flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl overflow-hidden dark:border-zinc-800 dark:bg-zinc-900"
      >

        {/* Top Header */}
        <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex items-start justify-between gap-3 bg-white dark:bg-zinc-900/80 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-500 flex items-center justify-center text-zinc-950 font-bold shadow-lg shadow-teal-500/20 shrink-0">
              <Bot className="w-6 h-6 text-zinc-950" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="meetbot-title" className="text-base font-display font-bold text-slate-900 dark:text-white">
                  Notetaker & Transcritor de Reuniões (IA)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200 dark:bg-teal-950 dark:text-teal-400 dark:border-teal-800/60 flex items-center gap-1 shrink-0">
                  <Zap className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                  <span>Análise de Transcrição</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Cole a transcrição do Google Meet para que a IA analise o contexto da reunião, resuma pontos-chave e extraia tarefas acionáveis diretamente para o Kanban.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">

          {botStatus === "idle" && (
            <div className="space-y-6">

              {/* Client Selection */}
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-2">
                  1. Cliente Alvo das Anotações e Tarefas
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm font-medium text-slate-800 dark:text-zinc-200 outline-none focus:border-teal-500"
                >
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mode Selector Tabs */}
              <div className="flex bg-slate-50 dark:bg-zinc-950 p-1.5 rounded-2xl border border-slate-200 dark:border-zinc-800/80 gap-1">
                <button
                  onClick={() => setActiveTab("live")}
                  className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    activeTab === "live"
                      ? "bg-teal-500 text-zinc-950 shadow-md"
                      : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:text-zinc-200"
                  }`}
                >
                  <Video className="w-4 h-4" />
                  <span>Simulador de Bot de Reunião (Google Meet)</span>
                </button>

                <button
                  onClick={() => setActiveTab("paste")}
                  className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    activeTab === "paste"
                      ? "bg-teal-500 text-zinc-950 shadow-md"
                      : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:text-zinc-200"
                  }`}
                >
                  <Clipboard className="w-4 h-4" />
                  <span>Importar / Colar Transcrição do Meet</span>
                </button>
              </div>

              {/* TAB 1: LIVE MEET BOT */}
              {activeTab === "live" && (
                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-2">
                      Link do Google Meet ou Reunião
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="meet.google.com/abc-defg-hij"
                        value={customMeetUrl}
                        onChange={(e) => setCustomMeetUrl(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-mono text-slate-800 dark:text-zinc-200 outline-none focus:border-teal-500"
                      />
                      <Video className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-3.5" />
                    </div>
                  </div>

                  {/* Real Google Calendar Sync Component */}
                  <div className="bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-teal-400" />
                        <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                          Reuniões Reais do Google Calendar
                        </h3>
                      </div>
                      
                      {isGoogleLinked && userToken ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-emerald-950/60 text-emerald-400 border border-emerald-900/60 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Google Calendar Conectado</span>
                          </span>

                          <button
                            onClick={() => fetchRealCalendar(userToken)}
                            title="Atualizar Reuniões da Agenda"
                            className="p-1 rounded-lg bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 transition-colors"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : isGoogleLinked ? (
                        <span className="text-[10px] bg-amber-950/50 text-amber-400 border border-amber-900/50 px-2 py-0.5 rounded-full font-bold">
                          Conexão Expirada
                        </span>
                      ) : (
                        <span className="text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700 px-2 py-0.5 rounded-full font-bold">
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
                          {isConnecting ? (
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                          ) : (
                            <Calendar className="w-4 h-4 text-white" />
                          )}
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
                          {isConnecting ? (
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                          ) : (
                            <RefreshCw className="w-4 h-4 text-white" />
                          )}
                          <span>Reconectar Google Calendar</span>
                        </button>
                      </div>
                    ) : loadingCalendar ? (
                      <div className="py-6 text-center space-y-2">
                        <Loader2 className="w-5 h-5 animate-spin text-teal-400 mx-auto" />
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400">Buscando reuniões reais na sua agenda do Google...</p>
                      </div>
                    ) : calendarError ? (
                      <div className="p-3 bg-red-950/40 border border-red-900/60 rounded-xl text-xs text-red-300 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                          <span>{calendarError}</span>
                        </div>
                        <div className="flex gap-2">
                          {userToken && (
                            <button
                              onClick={() => fetchRealCalendar(userToken)}
                              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-[10px] font-bold"
                            >
                              Tentar Novamente
                            </button>
                          )}
                          <button
                            onClick={handleConnectGoogleCalendar}
                            className="px-2.5 py-1 bg-amber-700 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold"
                          >
                            Reconectar
                          </button>
                        </div>
                      </div>
                    ) : calendarEvents.length === 0 ? (
                      <div className="py-6 text-center bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800/60 rounded-xl space-y-1">
                        <Calendar className="w-6 h-6 text-zinc-600 mx-auto mb-1" />
                        <p className="text-xs font-semibold text-slate-600 dark:text-zinc-300">Nenhuma reunião futura agendada na sua conta do Google.</p>
                        <p className="text-[11px] text-slate-400 dark:text-zinc-500">Eventos criados no seu Google Calendar aparecerão automaticamente aqui.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
                        {calendarEvents.map((evt) => {
                          const isSelected = selectedEvent?.id === evt.id;
                          const startTime = new Date(evt.start).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                          const startDate = new Date(evt.start).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
                          return (
                            <div
                              key={evt.id}
                              onClick={() => {
                                setSelectedEvent(evt);
                                if (evt.meetLink) {
                                  setCustomMeetUrl(evt.meetLink);
                                }
                              }}
                              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                isSelected 
                                  ? "bg-teal-950/30 border-teal-500/60 ring-1 ring-teal-500/40" 
                                  : "bg-white dark:bg-zinc-900/80 border-slate-200 dark:border-zinc-800/80 hover:border-zinc-700"
                              }`}
                            >
                              <div className="space-y-1 overflow-hidden">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-teal-400 shrink-0" />
                                  <h4 className="text-xs font-bold text-zinc-100 truncate">{evt.summary}</h4>
                                </div>
                                <div className="flex items-center gap-3 text-[10px] text-slate-500 dark:text-zinc-400 font-mono">
                                  <span>📅 {startDate} às {startTime}</span>
                                  {evt.meetLink && (
                                    <span className="text-teal-400 truncate max-w-[200px]">{evt.meetLink}</span>
                                  )}
                                </div>
                              </div>

                              {isSelected && (
                                <span className="text-[10px] font-bold text-teal-400 bg-teal-950/80 px-2 py-0.5 rounded-md border border-teal-700/60 shrink-0">
                                  Selecionada
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleJoinMeet}
                    className="w-full py-4 bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-600 hover:from-teal-600 hover:to-emerald-700 text-zinc-950 font-bold text-sm rounded-2xl shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Mic className="w-5 h-5 text-zinc-950" />
                    <span>Iniciar Gravador de Microfone & Sessão de Reunião</span>
                    <ArrowRight className="w-5 h-5 text-zinc-950" />
                  </button>
                </div>
              )}

              {/* TAB 2: PASTE OR UPLOAD TRANSCRIPT */}
              {activeTab === "paste" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
                      Cole a Transcrição ou Faça Upload (.txt, .vtt)
                    </label>

                    <label className="cursor-pointer px-3 py-1.5 bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors">
                      <Upload className="w-3.5 h-3.5 text-teal-400" />
                      <span>Upload de Arquivo</span>
                      <input
                        type="file"
                        accept=".txt,.vtt,.sbv,text/plain,text/vtt"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <textarea
                    rows={8}
                    placeholder="Cole aqui o texto ou transcrição exportada do Google Meet / Tactiq..."
                    value={pastedTranscriptText}
                    onChange={(e) => setPastedTranscriptText(e.target.value)}
                    className="w-full p-4 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl text-xs font-mono text-slate-800 dark:text-zinc-200 outline-none focus:border-teal-500 resize-none leading-relaxed"
                  />

                  <button
                    onClick={handleProcessPastedTranscript}
                    disabled={!pastedTranscriptText.trim()}
                    className="w-full py-4 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 disabled:opacity-50 text-zinc-950 font-bold text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Sparkles className="w-5 h-5 text-zinc-950" />
                    <span>Processar Transcrição com Gemini AI & Gerar Tarefas</span>
                  </button>
                </div>
              )}

            </div>
          )}

          {/* Bot Joining State */}
          {botStatus === "joining" && (
            <div className="py-16 text-center space-y-4">
              <div className="relative w-16 h-16 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-teal-500/20 animate-ping" />
                <div className="w-16 h-16 rounded-full bg-teal-500/10 border-2 border-teal-500 flex items-center justify-center">
                  <Mic className="w-8 h-8 text-teal-400 animate-pulse" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Iniciando Sessão de Gravador & Transcrição...
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Preparando microfone local para a reunião com <span className="text-teal-400 font-semibold">{selectedClient.name}</span>
                </p>
              </div>
            </div>
          )}

          {/* Connected & Live Mic State */}
          {botStatus === "connected" && (
            <div className="space-y-4">
              
              {/* Meeting Control Bar */}
              <div className="p-4 bg-emerald-950/30 border border-emerald-900/50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <div>
                    <h3 className="text-xs font-bold text-emerald-300">
                      Sessão de Gravação de Voz Ativa
                    </h3>
                    <p className="text-[11px] text-emerald-400/80">
                      Cliente: <strong className="text-slate-900 dark:text-white">{selectedClient.name}</strong> • Microfone Local
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Real Browser Microphone Toggle */}
                  <button
                    onClick={toggleMicrophone}
                    disabled={!micSupported}
                    className={`px-3.5 py-2 text-xs font-bold rounded-xl flex items-center gap-2 border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      isMicListening
                        ? "bg-red-950 text-red-300 border-red-800 animate-pulse"
                        : "bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-teal-400 border-zinc-700"
                    }`}
                    title={micSupported ? "Ativar transcrição de fala via microfone local do computador" : "Seu navegador não suporta a API de Reconhecimento de Voz nativa"}
                  >
                    {isMicListening ? <Mic className="w-4 h-4 text-red-400" /> : <MicOff className="w-4 h-4 text-teal-400" />}
                    <span>{isMicListening ? "Pausar Microfone" : "Ativar Microfone (Voz Real)"}</span>
                  </button>

                  <button
                    onClick={handleFinishAndSummarize}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-slate-900 dark:text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-md transition-all cursor-pointer"
                  >
                    <Square className="w-4 h-4 fill-white" />
                    <span>Encerrar & Gerar Notas e Tarefas</span>
                  </button>
                </div>
              </div>

              {/* Audio & Mic Notice Bar */}
              <div className="p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className={`w-4 h-4 ${isMicListening ? "text-red-400 animate-ping" : "text-teal-400"}`} />
                    <span className="text-xs text-slate-600 dark:text-zinc-300 font-medium">
                      {isMicListening 
                        ? "Ouvindo sua fala no microfone..." 
                        : "Microfone pausado. Clique em 'Ativar Microfone' para falar."}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1 h-4">
                    <div className="w-1 bg-teal-500 h-2 animate-bounce" />
                    <div className="w-1 bg-teal-400 h-4 animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1 bg-emerald-500 h-3 animate-bounce [animation-delay:0.4s]" />
                    <div className="w-1 bg-teal-500 h-1 animate-bounce [animation-delay:0.1s]" />
                    <div className="w-1 bg-emerald-400 h-4 animate-bounce [animation-delay:0.3s]" />
                  </div>
                </div>

                <div className="p-2 bg-amber-950/20 border border-amber-900/40 rounded-lg text-[11px] text-amber-300/90 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span><strong>Nota sobre o Microfone:</strong> O reconhecimento de voz grava o áudio capturado pelo seu microfone local. Nenhuma linha de texto é injetada automaticamente.</span>
                </div>
              </div>

              {/* Live Transcript Display Box */}
              <div className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 h-64 overflow-y-auto space-y-3 font-sans">
                {transcript.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-zinc-500 text-xs italic gap-2">
                    <Mic className="w-6 h-6 text-zinc-600" />
                    <span>Aguardando falas ou clique em "Falar no Microfone (Real)" acima...</span>
                  </div>
                ) : (
                  transcript.map((entry) => (
                    <div key={entry.id} className="p-2.5 bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800/60 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-teal-400 flex items-center gap-1">
                          <UserIcon className="w-3 h-3 text-teal-500" />
                          {entry.speaker}
                        </span>
                        <span className="text-slate-400 dark:text-zinc-500 font-mono">{entry.timestamp}</span>
                      </div>
                      <p className="text-xs text-slate-800 dark:text-zinc-200 leading-relaxed">
                        {entry.text}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Summarizing State */}
          {botStatus === "summarizing" && (
            <div className="py-16 text-center space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-teal-400 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Sintetizando Anotações & Extraindo Tarefas no Gemini 2.5...
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Gerando relatório para o Bloco de Notas de <span className="text-teal-400 font-bold">{selectedClient.name}</span> e cadastrando pendências no Kanban.
                </p>
              </div>
            </div>
          )}

          {/* Completed State */}
          {botStatus === "completed" && (
            <div className="space-y-6 text-left">
              
              <div className="p-4 bg-emerald-950/40 border border-emerald-900/60 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-emerald-300">
                      Reunião Processada com Sucesso!
                    </h3>
                    <p className="text-xs text-emerald-400/80">
                      Anotações salvas em <strong>{selectedClient.name}</strong> e <strong>{extractedTasks.length} tarefa(s)</strong> adicionada(s) à esteira Kanban.
                    </p>
                  </div>
                </div>
              </div>

              {/* Extracted Tasks Display */}
              {extractedTasks.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <ListPlus className="w-4 h-4 text-teal-400" />
                    <label className="text-xs font-bold text-slate-600 dark:text-zinc-300 uppercase tracking-wider block">
                      Tarefas Extraídas Automaticamente para o Kanban ({extractedTasks.length})
                    </label>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {extractedTasks.map((t, i) => (
                      <div key={i} className="p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{t.title}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-teal-950 text-teal-400 border border-teal-800">
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

              {/* Notes Preview */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
                  Anotações Sintetizadas (Bloco de Notas)
                </label>
                <div className="p-4 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl max-h-52 overflow-y-auto text-xs text-slate-600 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {generatedNotes}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={() => {
                    onClose();
                    if (onNavigateToClient) {
                      onNavigateToClient(selectedClientId);
                    }
                  }}
                  className="flex-1 py-3.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-zinc-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <FileText className="w-4 h-4 text-zinc-950" />
                  <span>Ver Cliente e Tarefas no Kanban</span>
                  <ArrowRight className="w-4 h-4 text-zinc-950" />
                </button>

                <button
                  onClick={onClose}
                  className="px-6 py-3.5 bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 font-semibold text-xs rounded-xl cursor-pointer"
                >
                  Fechar
                </button>
              </div>

            </div>
          )}

        </div>

      </aside>
    </>
  );
}
