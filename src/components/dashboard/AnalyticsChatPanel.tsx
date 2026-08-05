import React, { useState } from "react";
import {
  Sparkles,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
  BrainCircuit,
} from "lucide-react";
import { Client, Task } from "../../types";
import { useTeamProfiles } from "../../hooks/useTeamProfiles";
import { buildAnalyticsContext } from "../../lib/analyticsContext";
import { authPostJson, ApiError } from "../../lib/apiClient";

const QUICK_QUESTIONS: { label: string; question: string }[] = [
  { label: "Maior risco", question: "Qual cliente está em maior risco agora e por quê?" },
  { label: "Prioridade hoje", question: "O que a equipe deve priorizar hoje e em qual ordem?" },
  { label: "Bloqueios", question: "Quais tarefas estão bloqueadas e o que pode desbloqueá-las?" },
  { label: "Carga da equipe", question: "Quem da equipe tem maior carga de trabalho no momento?" },
  { label: "Sem movimentação", question: "Quais clientes estão sem movimentação há mais tempo?" },
  { label: "Atrasos", question: "Quais projetos apresentam atrasos e qual a gravidade de cada um?" },
  { label: "Esta semana", question: "Quais entregas vencem nos próximos 7 dias?" },
];

interface AnalyticsChatPanelProps {
  clients: Client[];
  tasks: Task[];
  lastMeetingAtByClient: Map<string, string>;
  recentChangeCountByClient: Map<string, number>;
}

export default function AnalyticsChatPanel({
  clients,
  tasks,
  lastMeetingAtByClient,
  recentChangeCountByClient,
}: AnalyticsChatPanelProps) {
  const { profiles } = useTeamProfiles();

  const [isExpanded, setIsExpanded] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const askQuestion = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || isLoading) return;

    setIsLoading(true);
    setAnswer(null);
    setLastQuestion(trimmed);
    setQuestion("");
    if (!isExpanded) setIsExpanded(true);

    try {
      const context = buildAnalyticsContext(clients, tasks, profiles, lastMeetingAtByClient, recentChangeCountByClient);
      const data = await authPostJson<{ answer: string }>("/api/analyze", {
        question: trimmed,
        context,
      });
      setAnswer(data.answer);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Erro ao consultar a IA. Verifique a conexão com o servidor.";
      setAnswer(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    askQuestion(question);
  };

  const clearAnswer = () => {
    setAnswer(null);
    setLastQuestion(null);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
      {/* ── Header (always visible) ─────────────────────────────────────────── */}
      <button
        onClick={() => setIsExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors duration-150 cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shrink-0 shadow-sm">
            <BrainCircuit className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-display font-bold text-base text-slate-900 dark:text-zinc-100 leading-none">
              IA Analítica
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
              Perguntas inteligentes sobre a operação
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isLoading && (
            <Loader2 className="w-4 h-4 animate-spin text-teal-500" />
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
          )}
        </div>
      </button>

      {/* ── Expandable body ─────────────────────────────────────────────────── */}
      {isExpanded && (
        <div className="border-t border-slate-100 dark:border-zinc-800 p-5 space-y-4">
          {/* Quick questions */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2">
              Perguntas rápidas
            </p>
            <div className="flex flex-wrap gap-2">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q.label}
                  onClick={() => askQuestion(q.question)}
                  disabled={isLoading}
                  className="px-3 py-1.5 text-[11px] font-semibold rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-teal-50 dark:hover:bg-teal-950/30 hover:text-teal-700 dark:hover:text-teal-400 hover:border-teal-300 dark:hover:border-teal-800/60 transition-all duration-150 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3 h-3 text-teal-500 dark:text-teal-400 shrink-0" />
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom question input */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Faça uma pergunta sobre a operação…"
              disabled={isLoading}
              className="flex-1 px-3 py-2.5 text-xs text-slate-900 dark:text-zinc-200 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 disabled:opacity-50 transition-all"
            />
            <button
              type="submit"
              disabled={isLoading || !question.trim()}
              className="px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>

          {/* Answer area */}
          {(isLoading || answer) && (
            <div className="bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 space-y-2">
              {lastQuestion && (
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 italic">
                    "{lastQuestion}"
                  </p>
                  {!isLoading && (
                    <button
                      onClick={clearAnswer}
                      className="shrink-0 p-0.5 text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors cursor-pointer"
                      title="Limpar resposta"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {isLoading ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-teal-500 shrink-0" />
                  <span className="text-xs text-slate-500 dark:text-zinc-400 animate-pulse">
                    Analisando operação…
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-md bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-3 h-3 text-white" />
                  </div>
                  <p className="text-xs text-slate-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap flex-1">
                    {answer}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
