import { Bell, Bot, ListTodo } from "lucide-react";
import type { AppView } from "./MobileNav";

interface DashboardHeaderProps {
  currentView: AppView;
  notifPermission: NotificationPermission;
  onEnableNotifications: () => void;
  onTestNotification: () => void;
  onOpenQuickTask: () => void;
  onOpenMeetBot: () => void;
}

const VIEW_TITLES: Record<AppView, string> = {
  dashboard: "Visão Geral",
  clients: "Clientes",
  backlog: "Backlog Geral",
  team: "Equipe",
  reports: "Relatórios",
  settings: "Configurações",
};

const VIEW_SUBTITLES: Record<AppView, string> = {
  dashboard: "Indicadores e sinais essenciais da operação.",
  clients: "Acesse e gerencie a carteira de clientes.",
  backlog: "Tarefas internas, sem cliente vinculado.",
  team: "Carga de trabalho e produtividade da equipe.",
  reports: "Exportação de tarefas para acompanhamento gerencial.",
  settings: "Customização das diretrizes e chaves da plataforma.",
};

export default function DashboardHeader({
  currentView,
  notifPermission,
  onEnableNotifications,
  onTestNotification,
  onOpenQuickTask,
  onOpenMeetBot,
}: DashboardHeaderProps) {
  return (
    <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-zinc-900">
      <div>
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
      </div>

      <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
        {/* Browser notification button */}
        <button
          onClick={notifPermission === "granted" ? onTestNotification : onEnableNotifications}
          className={`px-3 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 transition-all cursor-pointer border ${
            notifPermission === "granted"
              ? "bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 text-teal-700 dark:text-teal-400 border-slate-200 dark:border-teal-800/50 shadow-sm"
              : "bg-amber-100 dark:bg-amber-950/40 hover:bg-amber-200 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800/60"
          }`}
          title={
            notifPermission === "granted"
              ? "Notificações do navegador ativas (clique para testar)"
              : "Clique para ativar notificações do navegador"
          }
        >
          <Bell className={`w-3.5 h-3.5 ${notifPermission === "granted" ? "text-teal-600 dark:text-teal-400" : "text-amber-600 dark:text-amber-400"}`} />
          <span>
            {notifPermission === "granted" ? "Notificações ativas" : "Ativar notificações"}
          </span>
        </button>

        {/* Quick Task Header Launcher */}
        <button
          onClick={onOpenQuickTask}
          className="px-3.5 py-2 bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-200 font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
        >
          <ListTodo className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <span>Nova Tarefa Rápida</span>
        </button>

        {/* Google Meet Bot Header Launcher */}
        <button
          onClick={onOpenMeetBot}
          className="px-3.5 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-zinc-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-md transition-all cursor-pointer"
        >
          <Bot className="w-4 h-4 text-zinc-950" />
          <span>Bot Google Meet & Calendar</span>
        </button>
      </div>
    </header>
  );
}
