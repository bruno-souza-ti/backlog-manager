import React, { useEffect, useState } from "react";
import {
  BrainCircuit,
  Building2,
  FileBarChart,
  Inbox,
  LayoutDashboard,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sun,
  Users,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { updateOwnPresence } from "../lib/profilePresence";
import { Profile, ProfileStatus } from "../types";
import { canAccessView, ROLE_LABELS, type AppView } from "../lib/permissions";
import { useToast } from "./common/ToastProvider";

const SIDEBAR_COLLAPSED_KEY = "backlog-manager:sidebar-collapsed";

interface SidebarProps {
  currentView: AppView;
  setView: (view: AppView) => void;
  selectedClientId: string | null;
  setSelectedClientId: (id: string | null) => void;
  darkMode?: boolean;
  setDarkMode?: React.Dispatch<React.SetStateAction<boolean>>;
  userProfile?: Profile | null;
  onStatusChange?: (status: ProfileStatus) => void;
}

const MENU_ITEMS = [
  { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
  { id: "clients" as const, label: "Clientes", icon: Building2 },
  { id: "backlog" as const, label: "Backlog Geral", icon: Inbox },
  { id: "team" as const, label: "Equipe", icon: Users },
  { id: "reports" as const, label: "Relatórios", icon: FileBarChart },
  { id: "settings" as const, label: "Configurações", icon: Settings },
];

function getInitials(name?: string) {
  if (!name) return "UL";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

const STATUS_COLORS: Record<ProfileStatus, string> = {
  available: "bg-emerald-500",
  busy: "bg-red-500",
  in_meeting: "bg-violet-500",
  offline: "bg-slate-400",
};

export default function Sidebar({
  currentView,
  setView,
  selectedClientId,
  setSelectedClientId,
  darkMode = true,
  setDarkMode,
  userProfile,
  onStatusChange,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(() => window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
  const { showToast } = useToast();

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleStatusChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextStatus = event.target.value as ProfileStatus;
    const previousStatus = userProfile?.status;
    if (!userProfile?.id) return;
    onStatusChange?.(nextStatus);
    const { error } = await updateOwnPresence(nextStatus, userProfile.current_client_id ?? null);
    if (!error) return;
    showToast("Não foi possível atualizar seu status.", "error");
    if (previousStatus) onStatusChange?.(previousStatus);
  };

  const goTo = (view: AppView) => {
    setView(view);
    setSelectedClientId(null);
  };

  return (
    <aside
      className={`relative hidden h-screen shrink-0 flex-col justify-between border-r border-slate-200 bg-white transition-[width,background-color] duration-300 dark:border-zinc-800 dark:bg-zinc-950 md:flex ${collapsed ? "w-20" : "w-64"}`}
      aria-label="Navegação principal"
    >
      <div className="min-h-0 flex-1">
        <div className="relative border-b border-slate-100 dark:border-zinc-900">
          <button type="button" aria-label="Ir para o Dashboard" onClick={() => goTo("dashboard")} className={`group flex w-full items-center cursor-pointer ${collapsed ? "justify-center p-4" : "gap-3 p-6 text-left"}`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-600 font-bold text-white shadow-lg shadow-teal-500/10 transition-transform duration-300 group-hover:scale-105">
              <BrainCircuit className="h-5 w-5 text-zinc-950" />
            </span>
            {!collapsed && <span className="block font-display text-lg font-bold leading-none tracking-tight text-slate-900 dark:text-white">Backlog Manager</span>}
          </button>

          <button type="button" aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"} aria-expanded={!collapsed} title={collapsed ? "Expandir menu" : "Recolher menu"} onClick={() => setCollapsed((current) => !current)} className="absolute -right-3 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-teal-300 hover:text-teal-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-teal-800 dark:hover:text-teal-400">
            {collapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
          </button>
        </div>

        <nav className={`${collapsed ? "p-2" : "p-4"} space-y-1`}>
          {MENU_ITEMS.filter((item) => canAccessView(userProfile?.role, item.id)).map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id && (item.id === "clients" || !selectedClientId);
            return (
              <button key={item.id} type="button" aria-label={collapsed ? item.label : undefined} aria-current={isActive ? "page" : undefined} title={collapsed ? item.label : undefined} onClick={() => goTo(item.id)} className={`flex w-full items-center rounded-xl text-sm font-medium transition-all duration-200 ${collapsed ? "justify-center px-0 py-3" : "gap-3 px-4 py-3"} ${isActive ? "border border-teal-200 bg-teal-50 text-teal-700 shadow-sm dark:border-teal-900/30 dark:bg-teal-950/30 dark:text-teal-400" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-200"}`}>
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-teal-600 dark:text-teal-400" : "text-slate-400 dark:text-zinc-500"}`} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      <div className={`border-t border-slate-100 dark:border-zinc-900 ${collapsed ? "space-y-3 p-3" : "space-y-4 p-4"}`}>
        <button type="button" onClick={() => setDarkMode?.((current) => !current)} aria-label={darkMode ? "Ativar tema claro" : "Ativar tema escuro"} title={collapsed ? (darkMode ? "Tema escuro" : "Tema claro") : "Alternar entre modo claro e escuro"} className={`flex rounded-xl border border-slate-200 bg-slate-100 transition-colors hover:bg-slate-200 dark:border-zinc-800/60 dark:bg-zinc-900/50 dark:hover:bg-zinc-800 ${collapsed ? "h-10 w-full items-center justify-center" : "w-full items-center justify-between p-2.5"}`}>
          <span className={`flex items-center text-xs font-medium text-slate-700 dark:text-zinc-300 ${collapsed ? "justify-center" : "gap-2 px-1"}`}>
            {darkMode ? <Moon className="h-3.5 w-3.5 text-teal-400" /> : <Sun className="h-3.5 w-3.5 text-amber-500" />}
            {!collapsed && <span>Tema</span>}
          </span>
          {!collapsed && <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${darkMode ? "border-teal-900/30 bg-teal-950/40 text-teal-400" : "border-amber-300 bg-amber-100 text-amber-700"}`}>{darkMode ? "Modo Escuro" : "Modo Claro"}</span>}
        </button>

        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div className="relative" title={`${userProfile?.full_name || "Usuário"} — ${ROLE_LABELS[userProfile?.role || "member"]}`}>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-teal-300 bg-teal-100 text-xs font-semibold text-teal-700 shadow-sm dark:border-teal-700/50 dark:bg-teal-900/40 dark:text-teal-400">{getInitials(userProfile?.full_name)}</div>
              <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-zinc-950 ${STATUS_COLORS[userProfile?.status || "offline"]}`} />
            </div>
            <button type="button" aria-label="Sair da conta" onClick={handleLogout} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30" title="Sair"><LogOut className="h-4 w-4" /></button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 px-2 py-1">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-teal-300 bg-teal-100 text-xs font-semibold text-teal-700 shadow-sm dark:border-teal-700/50 dark:bg-teal-900/40 dark:text-teal-400">{getInitials(userProfile?.full_name)}</div>
                <div className="min-w-0 overflow-hidden">
                  <span className="block truncate text-xs font-semibold leading-none text-slate-800 dark:text-zinc-200">{userProfile?.full_name || "Usuário Local"}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-slate-500 dark:text-zinc-500">{userProfile?.email || "Modo Offline"}</span>
                  {userProfile?.role && <span className="mt-1 inline-flex text-[9px] font-bold uppercase tracking-wide text-teal-700 dark:text-teal-400">{ROLE_LABELS[userProfile.role]}</span>}
                </div>
              </div>
              <button type="button" aria-label="Sair da conta" onClick={handleLogout} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30" title="Sair"><LogOut className="h-4 w-4" /></button>
            </div>
            {userProfile?.id && (
              <select value={userProfile.status || "available"} onChange={handleStatusChange} aria-label="Meu status" className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] text-slate-600 outline-none focus:ring-1 focus:ring-teal-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                <option value="available">🟢 Disponível</option>
                <option value="busy">🔴 Ocupado</option>
                {userProfile.status === "in_meeting" && <option value="in_meeting" disabled>🟣 Em Reunião (Automático)</option>}
                <option value="offline">⚪ Offline</option>
              </select>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
