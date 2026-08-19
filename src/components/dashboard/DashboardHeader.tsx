import type { AppView } from "./MobileNav";

interface DashboardHeaderProps {
  currentView: AppView;
}

const VIEW_TITLES: Record<AppView, string> = {
  dashboard: "Visão Geral",
  clients: "Carteira de Clientes",
  backlog: "Backlog Geral",
  team: "Equipe",
  reports: "Relatórios",
  settings: "Configurações",
};

const VIEW_SUBTITLES: Record<AppView, string> = {
  dashboard: "Acompanhamento de projetos e sprints ativas.",
  clients: "Clientes em acompanhamento e seus ciclos de vida.",
  backlog: "Tarefas internas, sem cliente vinculado.",
  team: "Carga de trabalho e produtividade da equipe.",
  reports: "Exportação de tarefas para acompanhamento gerencial.",
  settings: "Customização das diretrizes e chaves da plataforma.",
};

export default function DashboardHeader({ currentView }: DashboardHeaderProps) {
  return (
    <header className="pb-6 border-b border-slate-200 dark:border-zinc-900">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 bg-teal-500 rounded-full shrink-0" />
        <span className="text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider font-mono">
          Backlog Manager
        </span>
      </div>
      <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white mt-1.5 leading-tight tracking-tight">
        {VIEW_TITLES[currentView]}
      </h1>
      <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1">
        {VIEW_SUBTITLES[currentView]}
      </p>
    </header>
  );
}
