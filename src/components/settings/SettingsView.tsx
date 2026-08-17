import { Loader2, Moon, Plus, Sun, Terminal, Video } from "lucide-react";

interface SettingsViewProps {
  geminiStatus: "loading" | "connected" | "not_configured";
  isGoogleLinked: boolean;
  isLinkingGoogle: boolean;
  onLinkGoogle: () => void;
  onSave: () => void;
  showPlatformStatus: boolean;
  darkMode: boolean;
  onDarkModeChange: (enabled: boolean) => void;
}

export default function SettingsView({
  geminiStatus,
  isGoogleLinked,
  isLinkingGoogle,
  onLinkGoogle,
  onSave,
  showPlatformStatus,
  darkMode,
  onDarkModeChange,
}: SettingsViewProps) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm max-w-2xl space-y-6">
      <div>
        <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">
          Integrações da Plataforma
        </h3>
        <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">
          Status do motor de IA e conexão com o Google Calendar.
        </p>
      </div>

      <div className="space-y-4 border-t border-slate-100 dark:border-zinc-800 pt-4">
        <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            {darkMode ? <Moon className="w-5 h-5 text-teal-500 shrink-0" /> : <Sun className="w-5 h-5 text-amber-500 shrink-0" />}
            <div><span className="text-sm font-semibold text-slate-800 dark:text-zinc-200 block">Aparência</span><p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">Escolha o tema usado em todas as telas.</p></div>
          </div>
          <button type="button" role="switch" aria-checked={darkMode} onClick={() => onDarkModeChange(!darkMode)} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${darkMode ? "bg-teal-600" : "bg-slate-300"}`}>
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${darkMode ? "translate-x-6" : "translate-x-1"}`} />
            <span className="sr-only">{darkMode ? "Desativar tema escuro" : "Ativar tema escuro"}</span>
          </button>
        </div>
        {showPlatformStatus && <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 flex items-start gap-3">
          <Terminal className={`w-5 h-5 shrink-0 mt-0.5 ${geminiStatus === "connected" ? "text-teal-600 dark:text-teal-400" : "text-amber-600 dark:text-amber-400"}`} />
          <div>
            <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 block flex items-center gap-2">
              Status de Conexão com Gemini API
              {geminiStatus === "connected" && <span className="text-[10px] px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-900/40">Conectado</span>}
              {geminiStatus === "not_configured" && <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40">Não Configurado</span>}
            </span>
            <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-1">
              {geminiStatus === "connected"
                ? "Sua chave de API do Gemini está ativa de forma nativa e segura. Todas as requisições automáticas e agentes de chat estão operacionais."
                : "A chave de API do Gemini (GEMINI_API_KEY) não foi detectada no servidor. As funções de inteligência artificial ficarão indisponíveis até a configuração."}
            </p>
          </div>
        </div>}

        {/* Google Calendar Link Card */}
        <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Video className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 block flex items-center gap-2">
                Google Calendar
                {isGoogleLinked ? (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40 font-bold">
                    Google Calendar Conectado
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700 font-bold">
                    Não Conectado
                  </span>
                )}
              </span>
              <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-1">
                Vincule sua conta do Google para importar eventos da agenda no Bot de Reuniões.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLinkGoogle}
            disabled={isLinkingGoogle}
            className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shrink-0 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isLinkingGoogle ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{isGoogleLinked ? "Reconectar" : "Conectar Google Calendar"}</span>
          </button>
        </div>
      </div>

      <div className="border-t border-slate-100 dark:border-zinc-800 pt-4 flex justify-end items-center gap-2">
        <button
          onClick={onSave}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white dark:text-zinc-950 text-xs font-bold rounded-xl transition-colors shadow cursor-pointer"
        >
          Salvar Alterações
        </button>
      </div>
    </div>
  );
}
