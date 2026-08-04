import { AlertCircle, Calendar, Users, TrendingUp, TrendingDown, CheckCircle2 } from "lucide-react";
import { Task, Client } from "../types";
import { isOverdue, isDueToday } from "../utils";

interface MetricsProps {
  clients: Client[];
  tasks: Task[];
}

export default function Metrics({ clients, tasks }: MetricsProps) {
  // Overdue tasks
  const overdueCount = tasks.filter((t) => isOverdue(t.deadline, t.column)).length;

  // Tasks for today
  const todayCount = tasks.filter((t) => isDueToday(t.deadline) && t.column !== "done").length;

  // Active clients
  const activeClientsCount = clients.length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {/* Metric 1: Overdue */}
      <div className="relative group bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl transition-all duration-300 hover:shadow-lg hover:border-red-300 dark:hover:border-red-900/40">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
              Tarefas Atrasadas
            </span>
            <span className="text-4xl font-display font-bold text-slate-900 dark:text-white block mt-2">
              {overdueCount}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/30 border border-red-200 dark:border-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
        <div className={`mt-4 flex items-center gap-1.5 text-xs font-medium ${overdueCount > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
          {overdueCount > 0 ? (
            <>
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Atenção imediata necessária</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Tudo em dia</span>
            </>
          )}
        </div>
      </div>

      {/* Metric 2: Today */}
      <div className="relative group bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl transition-all duration-300 hover:shadow-lg hover:border-teal-300 dark:hover:border-teal-900/40">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
              Tarefas para Hoje
            </span>
            <span className="text-4xl font-display font-bold text-slate-900 dark:text-white block mt-2">
              {todayCount}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400">
            <Calendar className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1.5 text-xs text-teal-600 dark:text-teal-400 font-medium">
          {todayCount > 0 ? (
            <span>Sprint diária em andamento</span>
          ) : (
            <span className="text-slate-500 dark:text-zinc-400">Nenhuma tarefa prevista para hoje</span>
          )}
        </div>
      </div>

      {/* Metric 3: Active Clients */}
      <div className="relative group bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl transition-all duration-300 hover:shadow-lg hover:border-emerald-300 dark:hover:border-emerald-900/40">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
              Clientes Ativos
            </span>
            <span className="text-4xl font-display font-bold text-slate-900 dark:text-white block mt-2">
              {activeClientsCount}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Users className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          {activeClientsCount > 0 ? (
            <span>Base operacional ativa</span>
          ) : (
            <span className="text-slate-500 dark:text-zinc-400">Nenhum cliente cadastrado</span>
          )}
        </div>
      </div>
    </div>
  );
}
