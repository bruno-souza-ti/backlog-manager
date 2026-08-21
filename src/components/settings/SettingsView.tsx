import { useEffect, useState, useRef } from "react";
import { Bell, BellOff, Camera, Check, Gauge, KeyRound, Loader2, LogOut, Moon, Pencil, Plug, Plus, SlidersHorizontal, Sun, User, Video, Volume2, VolumeX, X } from "lucide-react";
import { ROLE_LABELS } from "../../lib/permissions";
import type { NotificationScope } from "../../hooks/useDesktopNotifications";
import type { NotificationSound } from "../../utils";
import type { Profile } from "../../types";
import { useAiUsage } from "../../hooks/useAiUsage";
import Avatar from "../common/Avatar";
import Select from "../common/Select";

interface SettingsViewProps {
  isGoogleLinked: boolean;
  isLinkingGoogle: boolean;
  onLinkGoogle: () => void;
  darkMode: boolean;
  onDarkModeChange: (enabled: boolean) => void;
  userProfile?: Profile | null;
  onSignOut: () => void | Promise<void>;
  isSavingProfile: boolean;
  onUpdateName: (fullName: string) => Promise<void>;
  onUploadAvatar: (file: File) => Promise<void>;
  isChangingPassword: boolean;
  onChangePassword: (currentPassword: string, newPassword: string, confirmation: string) => Promise<boolean>;
  notifPermission: NotificationPermission;
  notificationsEnabled: boolean;
  onToggleNotifications: (enabled: boolean) => void;
  onTestNotification: () => void;
  notifyScope: NotificationScope;
  onNotifyScopeChange: (scope: NotificationScope) => void;
  notifyOverdue: boolean;
  onNotifyOverdueChange: (enabled: boolean) => void;
  notifyDueToday: boolean;
  onNotifyDueTodayChange: (enabled: boolean) => void;
  notifyAssigned: boolean;
  onNotifyAssignedChange: (enabled: boolean) => void;
  sound: NotificationSound;
  onSoundChange: (sound: NotificationSound) => void;
}

type SettingsTab = "profile" | "preferences" | "integrations";

const TABS: { id: SettingsTab; label: string; icon: typeof User }[] = [
  { id: "profile", label: "Perfil", icon: User },
  { id: "preferences", label: "Preferências", icon: SlidersHorizontal },
  { id: "integrations", label: "Integrações", icon: Plug },
];

/**
 * Track: w-12 (48px) h-7 (28px). Knob: w-5 h-5 (20px), fixed base offset
 * left-1/top-1 (4px, symmetric margin), translated by exactly its own width
 * (translate-x-5 = 20px) when on — 4px margin on both sides in both states.
 * (Relying on an implicit/auto `left` with only a transform is what caused
 * the previous version's knob to sit outside the track.)
 */
function ToggleSwitch({ checked, onChange, disabled, label }: { checked: boolean; onChange: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${checked ? "bg-teal-600" : "bg-slate-300 dark:bg-zinc-700"}`}
    >
      <span className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
      <span className="sr-only">{label}</span>
    </button>
  );
}

export default function SettingsView({
  isGoogleLinked,
  isLinkingGoogle,
  onLinkGoogle,
  darkMode,
  onDarkModeChange,
  userProfile,
  onSignOut,
  isSavingProfile,
  onUpdateName,
  onUploadAvatar,
  isChangingPassword,
  onChangePassword,
  notifPermission,
  notificationsEnabled,
  onToggleNotifications,
  onTestNotification,
  notifyScope,
  onNotifyScopeChange,
  notifyOverdue,
  onNotifyOverdueChange,
  notifyDueToday,
  onNotifyDueTodayChange,
  notifyAssigned,
  onNotifyAssignedChange,
  sound,
  onSoundChange,
}: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const notificationsActive = notificationsEnabled && notifPermission === "granted";
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const aiUsage = useAiUsage();

  useEffect(() => {
    if (activeTab === "integrations") void aiUsage.fetchUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(userProfile?.full_name || "");

  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const startEditName = () => {
    setNameDraft(userProfile?.full_name || "");
    setEditingName(true);
  };

  const confirmEditName = async () => {
    if (!nameDraft.trim()) return;
    await onUpdateName(nameDraft.trim());
    setEditingName(false);
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await onUploadAvatar(file);
  };

  const submitPasswordChange = async () => {
    const succeeded = await onChangePassword(currentPassword, newPassword, confirmPassword);
    if (succeeded) {
      setChangingPassword(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Tabs Navigation */}
      <div role="tablist" aria-label="Seções de configurações" className="inline-flex w-fit items-center gap-1 rounded-[10px] border border-slate-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
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
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors cursor-pointer ${
                isActive
                  ? "bg-teal-600 text-white"
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB: PERFIL */}
      {activeTab === "profile" && (
        <div role="tabpanel" className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">
              Meu Perfil
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">
              Sua conta nesta organização.
            </p>
          </div>

          <div className="flex items-start justify-between gap-3 border-t border-slate-100 dark:border-zinc-800 pt-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative group shrink-0">
                <Avatar name={userProfile?.full_name} url={userProfile?.avatar_url} size="lg" />
                <button
                  type="button"
                  aria-label="Alterar foto de perfil"
                  title="Alterar foto de perfil"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={isSavingProfile}
                  className="absolute inset-0 rounded-full flex items-center justify-center bg-black/0 group-hover:bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSavingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                </button>
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFileChange} />
              </div>

              <div className="min-w-0">
                {editingName ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      disabled={isSavingProfile}
                      className="min-w-0 px-2 py-1 text-sm font-semibold text-slate-800 dark:text-zinc-200 bg-slate-50 dark:bg-zinc-950 border border-teal-300 dark:border-teal-800/60 rounded-lg outline-none focus:ring-1 focus:ring-teal-500"
                    />
                    <button type="button" onClick={() => void confirmEditName()} disabled={isSavingProfile || !nameDraft.trim()} className="p-1 rounded text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/30 disabled:opacity-50 cursor-pointer">
                      {isSavingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    </button>
                    <button type="button" onClick={() => setEditingName(false)} disabled={isSavingProfile} className="p-1 rounded text-slate-400 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-50 cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="group/name flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-slate-800 dark:text-zinc-200 truncate">
                      {userProfile?.full_name || "Usuário Local"}
                    </span>
                    <button
                      type="button"
                      aria-label="Editar nome"
                      onClick={startEditName}
                      className="p-1 rounded text-slate-400 dark:text-zinc-500 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/20 opacity-0 group-hover/name:opacity-100 focus-visible:opacity-100 transition-all cursor-pointer shrink-0"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                )}
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

          {/* Trocar Senha */}
          <div className="border-t border-slate-100 dark:border-zinc-800 pt-4">
            {!changingPassword ? (
              <button
                type="button"
                onClick={() => setChangingPassword(true)}
                className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Alterar senha
              </button>
            ) : (
              <div className="space-y-2.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-2">
                  <KeyRound className="w-3.5 h-3.5" /> Alterar senha
                </span>
                <input
                  type="password"
                  placeholder="Senha atual"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={isChangingPassword}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-60"
                />
                <input
                  type="password"
                  placeholder="Nova senha (mín. 8 caracteres)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isChangingPassword}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-60"
                />
                <input
                  type="password"
                  placeholder="Confirmar nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isChangingPassword}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-60"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setChangingPassword(false);
                      setCurrentPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                    }}
                    disabled={isChangingPassword}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitPasswordChange()}
                    disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isChangingPassword && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Salvar nova senha
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: PREFERÊNCIAS */}
      {activeTab === "preferences" && (
        <div role="tabpanel" className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">
              Preferências
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">
              Aparência e notificações — salvas automaticamente.
            </p>
          </div>

          <div className="space-y-4 border-t border-slate-100 dark:border-zinc-800 pt-4">
            <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                {darkMode ? <Moon className="w-5 h-5 text-teal-500 shrink-0" /> : <Sun className="w-5 h-5 text-amber-500 shrink-0" />}
                <div><span className="text-sm font-semibold text-slate-800 dark:text-zinc-200 block">Aparência</span><p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">Escolha o tema usado em todas as telas.</p></div>
              </div>
              <ToggleSwitch checked={darkMode} onChange={() => onDarkModeChange(!darkMode)} label={darkMode ? "Desativar tema escuro" : "Ativar tema escuro"} />
            </div>

            <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                <ToggleSwitch checked={notificationsActive} disabled={notifPermission === "denied"} onChange={() => onToggleNotifications(!notificationsActive)} label={notificationsActive ? "Desativar notificações" : "Ativar notificações"} />
              </div>

              {notificationsActive && (
                <div className="space-y-3 border-t border-slate-200 dark:border-zinc-800 pt-3.5 pl-8">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">O que notificar</span>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-400 cursor-pointer">
                        <input type="checkbox" checked={notifyOverdue} onChange={(e) => onNotifyOverdueChange(e.target.checked)} className="accent-teal-600" />
                        Atrasadas
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-400 cursor-pointer">
                        <input type="checkbox" checked={notifyDueToday} onChange={(e) => onNotifyDueTodayChange(e.target.checked)} className="accent-teal-600" />
                        Vencendo hoje
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-400 cursor-pointer">
                        <input type="checkbox" checked={notifyAssigned} onChange={(e) => onNotifyAssignedChange(e.target.checked)} className="accent-teal-600" />
                        Atribuídas a mim
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">Escopo</span>
                    <Select
                      value={notifyScope}
                      onChange={(value) => onNotifyScopeChange(value as NotificationScope)}
                      triggerClassName="px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-zinc-300"
                      options={[
                        { value: "mine", label: "Só minhas tarefas" },
                        { value: "all", label: "Todas as tarefas do time" },
                      ]}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-slate-600 dark:text-zinc-400 flex items-center gap-1.5">
                      {sound === "none" ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      Som
                    </span>
                    <Select
                      value={sound}
                      onChange={(value) => onSoundChange(value as NotificationSound)}
                      triggerClassName="px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-zinc-300"
                      options={[
                        { value: "none", label: "Nenhum" },
                        { value: "soft", label: "Suave" },
                        { value: "classic", label: "Clássico" },
                      ]}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: INTEGRAÇÕES */}
      {activeTab === "integrations" && (
        <div role="tabpanel" className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">
              Integrações
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">
              Conexões da sua conta com serviços externos.
            </p>
          </div>

          <div className="border-t border-slate-100 dark:border-zinc-800 pt-4">
            <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <Video className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 block flex items-center gap-2">
                    Google Calendar
                    {isGoogleLinked ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40 font-bold">
                        Conectado
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700 font-bold">
                        Não Conectado
                      </span>
                    )}
                  </span>
                  <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-1">
                    Vincule sua conta do Google para importar eventos da agenda no Note Taker.
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

            {/* AI usage indicator */}
            <div className="mt-3 p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-3">
              <div className="flex items-center gap-2">
                <Gauge className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 block">Uso de IA (Gemini)</span>
                  <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-0.5">Cota por recurso, renovada a cada hora cheia.</p>
                </div>
                {aiUsage.loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-500 shrink-0 ml-auto" />}
              </div>

              {aiUsage.error ? (
                <p className="text-[11px] text-red-600 dark:text-red-400">{aiUsage.error}</p>
              ) : aiUsage.usage ? (
                <div className="space-y-2.5">
                  {aiUsage.usage.routes.map((r) => {
                    const pct = Math.min(100, Math.round((r.hourlyUsed / r.hourlyLimit) * 100));
                    const isNear = r.hourlyUsed >= r.hourlyLimit * 0.8;
                    return (
                      <div key={r.route}>
                        <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-zinc-400 mb-1">
                          <span>{r.label}</span>
                          <span className={isNear ? "text-amber-600 dark:text-amber-400 font-semibold" : ""}>
                            {r.hourlyUsed}/{r.hourlyLimit} nesta hora
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${isNear ? "bg-amber-500" : "bg-teal-500"}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : !aiUsage.loading ? (
                <p className="text-[11px] text-slate-500 dark:text-zinc-500 italic">Não foi possível carregar.</p>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
