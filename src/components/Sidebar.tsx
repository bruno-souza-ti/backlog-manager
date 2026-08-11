import React from "react";
import { LayoutDashboard, Settings, BrainCircuit, Moon, Sun, LogOut, Users, FileBarChart, Inbox } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { updateOwnPresence } from "../lib/profilePresence";
import { Profile, ProfileStatus } from "../types";
import { canAccessView, ROLE_LABELS, type AppView } from "../lib/permissions";

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
  const menuItems = [
    { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
    { id: "backlog" as const, label: "Backlog Geral", icon: Inbox },
    { id: "team" as const, label: "Equipe", icon: Users },
    { id: "reports" as const, label: "Relatórios", icon: FileBarChart },
    { id: "settings" as const, label: "Configurações", icon: Settings },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as ProfileStatus;
    const oldStatus = userProfile?.status;
    if (userProfile?.id) {
      if (onStatusChange) onStatusChange(newStatus);
      const { error } = await updateOwnPresence(newStatus, userProfile.current_client_id ?? null);
      if (error) {
        console.error("Erro ao atualizar status:", error);
        alert("Erro ao atualizar seu status no sistema: " + error.message);
        if (onStatusChange && oldStatus) onStatusChange(oldStatus);
        return;
      }
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return "UL";
    const parts = name.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <aside className="hidden md:flex w-64 border-r flex-col justify-between bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 h-screen sticky top-0 shrink-0 transition-colors">
      <div>
        {/* Brand Header */}
        <div 
          onClick={() => {
            setView("dashboard");
            setSelectedClientId(null);
          }}
          className="p-6 border-b border-slate-100 dark:border-zinc-900 flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-600 flex items-center justify-center text-white font-bold shadow-lg shadow-teal-500/10 group-hover:scale-105 transition-transform duration-300">
            <BrainCircuit className="w-5 h-5 text-zinc-950" />
          </div>
          <div>
            <span className="font-display font-bold text-lg leading-none tracking-tight block text-slate-900 dark:text-white">
              Backlog Manager
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
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
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400 shadow-sm border border-teal-200 dark:border-teal-900/30"
                    : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900/60 hover:text-slate-900 dark:hover:text-zinc-200"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-teal-600 dark:text-teal-400" : "text-slate-400 dark:text-zinc-500"}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Profile */}
      <div className="p-4 border-t border-slate-100 dark:border-zinc-900 space-y-4">
        {/* Dark Mode Toggle */}
        <button
          onClick={() => setDarkMode && setDarkMode((prev) => !prev)}
          className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-100 dark:bg-zinc-900/50 hover:bg-slate-200 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800/60 transition-colors cursor-pointer"
          title="Alternar entre modo claro e escuro"
        >
          <span className="text-xs font-medium text-slate-700 dark:text-zinc-300 px-1 flex items-center gap-2">
            {darkMode ? <Moon className="w-3.5 h-3.5 text-teal-400" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
            <span>Tema</span>
          </span>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
            darkMode 
              ? "text-teal-400 bg-teal-950/40 border-teal-900/30" 
              : "text-amber-700 bg-amber-100 border-amber-300 dark:text-amber-500 dark:bg-amber-950/20 dark:border-amber-800/30"
          }`}>
            {darkMode ? "Modo Escuro" : "Modo Claro"}
          </span>
        </button>

        {/* User Info & Status */}
        <div className="flex flex-col gap-2 px-2 py-1">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/40 border border-teal-300 dark:border-teal-700/50 flex items-center justify-center text-teal-700 dark:text-teal-400 text-xs font-semibold shadow-sm">
                {getInitials(userProfile?.full_name)}
              </div>
              <div className="overflow-hidden">
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
            <button
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          {userProfile?.id && (
            <select
              value={userProfile?.status || "available"}
              onChange={handleStatusChange}
              className="w-full mt-1 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-[10px] text-slate-600 dark:text-zinc-300 py-1.5 px-2 outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="available">🟢 Disponível</option>
              <option value="busy">🔴 Ocupado</option>
              {userProfile?.status === "in_meeting" && (
                <option value="in_meeting" disabled>
                  🟣 Em Reunião (Automático)
                </option>
              )}
              <option value="offline">⚪ Offline</option>
            </select>
          )}
        </div>
      </div>
    </aside>
  );
}
