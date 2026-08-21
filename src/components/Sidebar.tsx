import React, { useState } from "react";
import { LayoutDashboard, Briefcase, Search, Settings, BrainCircuit, Moon, Sun, Users, FileBarChart, Inbox, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Profile, ProfileStatus } from "../types";
import { canAccessView, ROLE_LABELS, type AppView } from "../lib/permissions";
import { getStatusMeta } from "../utils";
import Avatar from "./common/Avatar";

const SIDEBAR_COLLAPSED_KEY = "backlog-manager:sidebar-collapsed";

const STATUS_DOT_CLASSES: Record<ProfileStatus, string> = {
  available: "bg-emerald-500",
  busy: "bg-red-500",
  in_meeting: "bg-violet-500",
  offline: "bg-slate-400 dark:bg-zinc-600",
};

interface SidebarProps {
  currentView: AppView;
  setView: (view: AppView) => void;
  selectedClientId: string | null;
  setSelectedClientId: (id: string | null) => void;
  darkMode?: boolean;
  setDarkMode?: React.Dispatch<React.SetStateAction<boolean>>;
  userProfile?: Profile | null;
  /** Automatically derived status (see lib/presence.ts) — read-only, not user-editable. */
  displayStatus?: ProfileStatus;
  onOpenSearch?: () => void;
}

export default function Sidebar({
  currentView,
  setView,
  selectedClientId,
  setSelectedClientId,
  darkMode = true,
  setDarkMode,
  userProfile,
  displayStatus,
  onOpenSearch,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  };

  const menuItems = [
    { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
    { id: "clients" as const, label: "Carteira de Clientes", icon: Briefcase },
    { id: "backlog" as const, label: "Backlog Geral", icon: Inbox },
    { id: "team" as const, label: "Equipe", icon: Users },
    { id: "reports" as const, label: "Relatórios", icon: FileBarChart },
    { id: "settings" as const, label: "Configurações", icon: Settings },
  ];

  const statusMeta = displayStatus ? getStatusMeta(displayStatus) : null;

  return (
    <aside className={`hidden md:flex ${collapsed ? "w-20" : "w-64"} border-r flex-col justify-between bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 h-screen sticky top-0 shrink-0 transition-all duration-200`}>
      <div>
        {/* Brand Header */}
        <div className={`border-b border-slate-100 dark:border-zinc-900 ${collapsed ? "p-3" : "p-4"}`}>
          <button
            type="button"
            aria-label="Ir para o Dashboard"
            title="Backlog Manager"
            onClick={() => {
              setView("dashboard");
              setSelectedClientId(null);
            }}
            className={`w-full flex items-center gap-3 cursor-pointer group text-left ${collapsed ? "justify-center" : "p-2"}`}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-600 flex items-center justify-center text-white font-bold shadow-lg shadow-teal-500/10 group-hover:scale-105 transition-transform duration-300 shrink-0">
              <BrainCircuit className="w-5 h-5 text-zinc-950" />
            </div>
            {!collapsed && (
              <span className="font-display font-bold text-lg leading-none tracking-tight block text-slate-900 dark:text-white truncate">
                Backlog Manager
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            className={`mt-2 w-full flex items-center gap-2 rounded-lg p-1.5 text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer ${collapsed ? "justify-center" : "justify-start px-2"}`}
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            {!collapsed && <span className="text-xs font-medium">Recolher</span>}
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {onOpenSearch && (
            <button
              type="button"
              onClick={onOpenSearch}
              title="Buscar em todo o app"
              aria-label="Buscar em todo o app"
              className={`w-full flex items-center rounded-xl text-sm font-medium transition-all duration-200 mb-2 text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900/60 hover:text-slate-900 dark:hover:text-zinc-200 border border-slate-200 dark:border-zinc-800 ${collapsed ? "justify-center px-0 py-3" : "justify-between gap-3 px-4 py-2.5"}`}
            >
              <span className="flex items-center gap-3">
                <Search className="w-4 h-4 shrink-0 text-slate-400 dark:text-zinc-500" />
                {!collapsed && <span>Buscar</span>}
              </span>
              {!collapsed && (
                <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500">
                  Ctrl K
                </kbd>
              )}
            </button>
          )}
          {menuItems.filter((item) => canAccessView(userProfile?.role, item.id)).map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id && !selectedClientId;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setView(item.id);
                  setSelectedClientId(null);
                }}
                title={collapsed ? item.label : undefined}
                aria-label={item.label}
                className={`w-full flex items-center rounded-xl text-sm font-medium transition-all duration-200 ${collapsed ? "justify-center px-0 py-3" : "gap-3 px-4 py-3"} ${
                  isActive
                    ? "bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400 shadow-sm border border-teal-200 dark:border-teal-900/30"
                    : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900/60 hover:text-slate-900 dark:hover:text-zinc-200"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-teal-600 dark:text-teal-400" : "text-slate-400 dark:text-zinc-500"}`} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Profile */}
      <div className={`border-t border-slate-100 dark:border-zinc-900 space-y-4 ${collapsed ? "p-3" : "p-4"}`}>
        {/* Dark Mode Toggle */}
        {collapsed ? (
          <button
            onClick={() => setDarkMode && setDarkMode((prev) => !prev)}
            className="w-full flex items-center justify-center rounded-xl bg-slate-100 dark:bg-zinc-900/50 hover:bg-slate-200 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800/60 transition-colors cursor-pointer p-2.5"
            title="Alternar entre modo claro e escuro"
          >
            {darkMode ? <Moon className="w-4 h-4 text-teal-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
          </button>
        ) : (
          <div className="flex rounded-[10px] border border-slate-200 bg-slate-50 p-[3px] dark:border-zinc-800/60 dark:bg-zinc-950">
            <button
              type="button"
              onClick={() => setDarkMode && setDarkMode(false)}
              aria-pressed={!darkMode}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                !darkMode ? "bg-teal-600 text-white" : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
              }`}
            >
              <Sun className="w-3.5 h-3.5" />Claro
            </button>
            <button
              type="button"
              onClick={() => setDarkMode && setDarkMode(true)}
              aria-pressed={darkMode}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                darkMode ? "bg-teal-600 text-white" : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
              }`}
            >
              <Moon className="w-3.5 h-3.5" />Escuro
            </button>
          </div>
        )}

        {/* User Info & Status (automatic — see lib/presence.ts) */}
        {collapsed ? (
          <div className="flex justify-center px-2 py-1" title={displayStatus ? `${userProfile?.full_name || "Usuário Local"} · ${getStatusMeta(displayStatus).label}` : userProfile?.full_name || "Usuário Local"}>
            <div className="relative">
              <Avatar name={userProfile?.full_name} url={userProfile?.avatar_url} size="sm" />
              {displayStatus && (
                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-zinc-950 ${STATUS_DOT_CLASSES[displayStatus]}`} />
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 px-2 py-1">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar name={userProfile?.full_name} url={userProfile?.avatar_url} size="sm" />
              <div className="min-w-0 overflow-hidden">
                <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 block truncate leading-none">
                  {userProfile?.full_name || "Usuário Local"}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-zinc-500 block truncate mt-0.5">
                  {userProfile?.email || "Modo Offline"}
                </span>
                {userProfile?.role && (
                  <span className="inline-flex mt-1 text-[9px] font-bold uppercase tracking-wide text-teal-700 dark:text-teal-400">
                    {ROLE_LABELS[userProfile.role]}
                  </span>
                )}
              </div>
            </div>
            {statusMeta && (
              <span
                className={`w-full mt-1 flex items-center justify-center gap-1.5 rounded-lg text-sm py-2.5 px-3 border font-semibold ${statusMeta.classes}`}
                title="Status calculado automaticamente a partir da sua atividade"
              >
                <span>{statusMeta.label}</span>
              </span>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
