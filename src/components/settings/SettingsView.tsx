import { Bell, BellOff, Loader2, LogOut, Moon, Plus, Sun, Terminal, Video } from "lucide-react";
import { describeGeminiStatus, type GeminiPlatformStatus } from "../../lib/platformStatus";
import { ROLE_LABELS } from "../../lib/permissions";
import type { Profile } from "../../types";

interface SettingsViewProps {
  geminiStatus: GeminiPlatformStatus | null;
  isGoogleLinked: boolean;
  isLinkingGoogle: boolean;
  onLinkGoogle: () => void;
  onSave: () => void;
  showPlatformStatus: boolean;
  darkMode: boolean;
  onDarkModeChange: (enabled: boolean) => void;
  userProfile?: Profile | null;
  onSignOut: () => void | Promise<void>;
  notifPermission: NotificationPermission;
  notificationsEnabled: boolean;
  onToggleNotifications: (enabled: boolean) => void;
  onTestNotification: () => void;
}

function getInitials(name?: string) {
  if (!name) return "UL";
  const parts = name.split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
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
  userProfile,
  onSignOut,
  notifPermission,
  notificationsEnabled,
  onToggleNotifications,
  onTestNotification,
}: SettingsViewProps) {
  const geminiPresentation = describeGeminiStatus(geminiStatus);
  const notificationsActive = notificationsEnabled && notifPermission === "granted";
  return (
    <div className="max-w-2xl space-y-6">
      {/* Meu Perfil */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">
            Meu Perfil
          </h3>
          <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">
            Sua conta nesta organização.
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 dark:border-zinc-800 pt-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-full bg-teal-100 dark:bg-teal-900/40 border border-teal-300 dark:border-teal-700/50 flex items-center justify-center text-teal-700 dark:text-teal-400 text-sm font-bold shadow-sm shrink-0">
              {getInitials(userProfile?.full_name)}
            </div>
            <div className="min-w-0">
              <span className="text-sm font-semibold text-slate-800 dark:text-zinc-200 block truncate">
                {userProfile?.full_name || "Usuário Local"}
              </span>
              <span className="text-xs text-slate-500 dark:text-zinc-500 block truncate">
                {userProfile?.email || "Modo Offline"}
              </span>
              {userProfile?.role && (
                <span className="inline-flex mt-1 text-[10px] font-bold uppercase tracking-wide text-teal-700 dark:text-teal-400">
                  {ROLE_LABELS[userProfile.role]}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="px-3.5 py-2 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 text-red-700 dark:text-red-400 text-xs font-bold rounded-xl transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer border border-red-200 dark:border-red-900/40"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair da conta</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-6">
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

        <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            {notificationsActive ? <Bell className="w-5 h-5 text-teal-500 shrink-0" /> : <BellOff className="w-5 h-5 text-slate-400 dark:text-zinc-500 shrink-0" />}
            <div>
              <span className="text-sm font-semibold text-slate-800 dark:text-zinc-200 block">Notificações do navegador</span>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">
                Avisos quando uma tarefa atrasar ou o prazo estiver próximo.
              </p>
              {notifPermission === "denied" && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                  Bloqueadas no navegador. Permita notificações para este site nas configurações do navegador para ativar.
                </p>
              )}
              {notificationsActive && (
                <button type="button" onClick={onTestNotification} className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 hover:underline mt-1 cursor-pointer">
                  Enviar notificação de teste
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={notificationsActive}
            disabled={notifPermission === "denied"}
            onClick={() => onToggleNotifications(!notificationsActive)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${notificationsActive ? "bg-teal-600" : "bg-slate-300 dark:bg-zinc-700"}`}
          >
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${notificationsActive ? "translate-x-6" : "translate-x-1"}`} />
            <span className="sr-only">{notificationsActive ? "Desativar notificações" : "Ativar notificações"}</span>
          </button>
        </div>

        {showPlatformStatus && <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 flex items-start gap-3">
          <Terminal className={`w-5 h-5 shrink-0 mt-0.5 ${geminiPresentation.operational ? "text-teal-600 dark:text-teal-400" : "text-amber-600 dark:text-amber-400"}`} />
          <div>
            <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 block flex items-center gap-2">
              Status de Conexão com Gemini API
              <span className={`text-[10px] px-2 py-0.5 rounded border ${geminiPresentation.operational ? "bg-teal-100 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-900/40" : "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40"}`}>{geminiPresentation.badge}</span>
            </span>
            <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-1">
              {geminiPresentation.description}
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
    </div>
  );
}
