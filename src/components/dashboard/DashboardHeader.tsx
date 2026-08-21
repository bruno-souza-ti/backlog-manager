import type { AppView } from "./MobileNav";

interface DashboardHeaderProps {
  currentView: AppView;
}

const VIEW_EYEBROWS: Record<AppView, string> = {
  dashboard: "Operação",
  clients: "Carteira",
  backlog: "Operação",
  sprints: "Operação",
  team: "Pessoas",
  reports: "Análise",
  settings: "Conta",
};

const VIEW_TITLES: Record<AppView, string> = {
  dashboard: "Visão Geral",
  clients: "Carteira de Clientes",
  backlog: "Backlog Geral",
  sprints: "Sprints",
  team: "Equipe",
  reports: "Relatórios",
  settings: "Configurações",
};

const VIEW_SUBTITLES: Record<AppView, string> = {
  dashboard: "Acompanhamento de projetos e sprints ativas.",
  clients: "Clientes em acompanhamento e seus ciclos de vida.",
  backlog: "Tarefas internas, sem cliente vinculado.",
  sprints: "Planejamento e execução do trabalho em ciclos.",
  team: "Carga de trabalho e produtividade da equipe.",
  reports: "Exportação de tarefas para acompanhamento gerencial.",
  settings: "Customização das diretrizes e chaves da plataforma.",
};

export default function DashboardHeader({ currentView }: DashboardHeaderProps) {
  return (
    <header className="pb-6 border-b border-slate-200 dark:border-zinc-900">
      <p className="text-[11.5px] font-bold uppercase tracking-wide text-teal-700 dark:text-teal-400 m-0">
        {VIEW_EYEBROWS[currentView]}
      </p>
      <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white mt-1 leading-tight tracking-tight">
        {VIEW_TITLES[currentView]}
      </h1>
      <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1">
        {VIEW_SUBTITLES[currentView]}
      </p>
    </header>
  );
}
