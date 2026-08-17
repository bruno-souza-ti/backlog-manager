import { useEffect, useState } from "react";
import { BrainCircuit, FileBarChart, Inbox, LayoutDashboard, LogOut, Menu, Moon, Settings, Sun, Users, X } from "lucide-react";
import type { Profile, ProfileRole, ProfileStatus } from "../../types";
import { canAccessView, type AppView } from "../../lib/permissions";
import { updateOwnPresence } from "../../lib/profilePresence";
import { useToast } from "../common/ToastProvider";

export type { AppView } from "../../lib/permissions";

interface MobileNavProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  role: ProfileRole;
  darkMode: boolean;
  onToggleTheme: () => void;
  userProfile?: Profile | null;
  onProfileStatusChange: (status: ProfileStatus) => void;
  onSignOut: () => void | Promise<void>;
}

const NAV_ITEMS = [
  { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
  { id: "backlog" as const, label: "Backlog Geral", icon: Inbox },
  { id: "team" as const, label: "Equipe", icon: Users },
  { id: "reports" as const, label: "Relatórios", icon: FileBarChart },
  { id: "settings" as const, label: "Configurações", icon: Settings },
];

export default function MobileNav({ currentView, onNavigate, role, darkMode, onToggleTheme, userProfile, onProfileStatusChange, onSignOut }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const { showToast } = useToast();
  const currentLabel = NAV_ITEMS.find((item) => item.id === currentView)?.label || "Dashboard";

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const handleStatusChange = async (status: ProfileStatus) => {
    const previous = userProfile?.status;
    onProfileStatusChange(status);
    const { error } = await updateOwnPresence(status, userProfile?.current_client_id ?? null);
    if (error) {
      if (previous) onProfileStatusChange(previous);
      showToast("Não foi possível atualizar seu status.", "error");
    }
  };

  return (
    <>
      <header className="md:hidden flex items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-200 dark:border-zinc-900">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-600 shadow-sm"><BrainCircuit className="h-5 w-5 text-zinc-950" /></span>
          <div className="min-w-0"><span className="block truncate font-display text-sm font-bold text-slate-900 dark:text-white">Backlog Manager</span><span className="block truncate text-xs text-slate-500 dark:text-zinc-400">{currentLabel}</span></div>
        </div>
        <button type="button" aria-label="Abrir menu principal" aria-expanded={open} onClick={() => setOpen(true)} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"><Menu className="h-5 w-5" /></button>
      </header>

      {open && (
        <div className="fixed inset-0 z-[70] md:hidden" role="presentation">
          <button type="button" aria-label="Fechar menu" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside role="dialog" aria-modal="true" aria-label="Menu principal" className="absolute inset-y-0 right-0 flex w-[min(88vw,22rem)] flex-col bg-white p-4 shadow-2xl dark:bg-zinc-950">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-zinc-800">
              <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900 dark:text-white">{userProfile?.full_name || "Minha conta"}</p><p className="truncate text-xs text-slate-500 dark:text-zinc-500">{userProfile?.email}</p></div>
              <button type="button" aria-label="Fechar menu principal" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-900"><X className="h-5 w-5" /></button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto py-4" aria-label="Navegação principal">
              {NAV_ITEMS.filter((item) => canAccessView(role, item.id)).map((item) => {
                const Icon = item.icon;
                const active = currentView === item.id;
                return <button key={item.id} type="button" aria-current={active ? "page" : undefined} onClick={() => { onNavigate(item.id); setOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold ${active ? "bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-300" : "text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-900"}`}><Icon className="h-4 w-4" /><span>{item.label}</span></button>;
              })}
            </nav>
            <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-zinc-800">
              {userProfile?.id && <div><label htmlFor="mobile-presence" className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-zinc-400">Meu status</label><select id="mobile-presence" value={userProfile.status || "available"} onChange={(event) => void handleStatusChange(event.target.value as ProfileStatus)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-900"><option value="available">Disponível</option><option value="busy">Ocupado</option>{userProfile.status === "in_meeting" && <option value="in_meeting" disabled>Em reunião</option>}<option value="offline">Offline</option></select></div>}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={onToggleTheme} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold dark:border-zinc-800 dark:bg-zinc-900">{darkMode ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-teal-600" />}{darkMode ? "Tema claro" : "Tema escuro"}</button>
                <button type="button" onClick={() => void onSignOut()} className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400"><LogOut className="h-4 w-4" />Sair</button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
