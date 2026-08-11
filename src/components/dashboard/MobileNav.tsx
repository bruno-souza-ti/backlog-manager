import { BrainCircuit } from "lucide-react";
import type { ProfileRole } from "../../types";
import { canAccessView, type AppView } from "../../lib/permissions";

export type { AppView } from "../../lib/permissions";

interface MobileNavProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  role: ProfileRole;
}

const NAV_ITEMS: { id: AppView; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "backlog", label: "Backlog Geral" },
  { id: "team", label: "Equipe" },
  { id: "reports", label: "Relatórios" },
  { id: "settings", label: "Ajustes" },
];

export default function MobileNav({ currentView, onNavigate, role }: MobileNavProps) {
  return (
    <div className="md:hidden flex items-center justify-between pb-4 mb-6 border-b border-slate-200 dark:border-zinc-900">
      <div className="flex items-center gap-2">
        <BrainCircuit className="w-6 h-6 text-teal-600 dark:text-teal-400" />
        <span className="font-display font-bold text-sm text-slate-900 dark:text-white">
          Geniality IA
        </span>
      </div>
      <div className="flex items-center gap-1 bg-slate-200 dark:bg-zinc-900 p-1 rounded-xl border border-slate-300 dark:border-zinc-800">
        {NAV_ITEMS.filter((item) => canAccessView(role, item.id)).map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              currentView === item.id
                ? "bg-teal-600 text-white dark:bg-teal-950/40 dark:text-teal-400 border border-teal-600 dark:border-teal-900/40 font-bold"
                : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
