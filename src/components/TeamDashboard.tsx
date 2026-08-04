import React, { useMemo, useState } from "react";
import { Users, Loader2, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { Task, Client } from "../types";
import { formatDate, formatTimeAgo } from "../utils";
import { useTeamProfiles } from "../hooks/useTeamProfiles";
import StatusBadge from "./common/StatusBadge";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default function TeamDashboard({ clients, tasks }: { clients: Client[], tasks: Task[] }) {
  const { profiles, loading } = useTeamProfiles();
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());

  const clientsById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const tasksByAssignee = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((t) => {
      if (!t.assigneeId) return;
      const bucket = map.get(t.assigneeId);
      if (bucket) bucket.push(t);
      else map.set(t.assigneeId, [t]);
    });
    return map;
  }, [tasks]);

  const toggleHistory = (profileId: string) => {
    setExpandedHistory((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) next.delete(profileId);
      else next.add(profileId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <Users className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          <h2 className="font-display font-bold text-lg text-slate-900 dark:text-white">Equipe</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {profiles.map(profile => {
            const assigneeTasks = tasksByAssignee.get(profile.id) || [];
            const userTasks = assigneeTasks.filter(t => t.column !== "done");
            const activeClient = profile.current_client_id ? clientsById.get(profile.current_client_id) : undefined;
            const isHistoryOpen = expandedHistory.has(profile.id);
            const now = Date.now();
            const completedTasks = assigneeTasks
              .filter(t => t.column === "done" && t.completedAt)
              .filter(t => now - new Date(t.completedAt as string).getTime() <= THIRTY_DAYS_MS)
              .sort((a, b) => new Date(b.completedAt as string).getTime() - new Date(a.completedAt as string).getTime());
            return (
              <div key={profile.id} className="p-4 bg-slate-50 dark:bg-zinc-950/50 border border-slate-200 dark:border-zinc-800/80 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-sm">{profile.full_name}</h3>
                    <p className="text-xs text-slate-500">{profile.email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <StatusBadge status={profile.status} />
                    {profile.status_updated_at && (
                      <span className="text-[9px] text-slate-400 dark:text-zinc-500">
                        {formatTimeAgo(profile.status_updated_at)}
                      </span>
                    )}
                  </div>
                </div>

                {activeClient && (
                  <div className="text-[11px] p-2 bg-teal-50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/30 rounded-lg text-teal-800 dark:text-teal-300">
                    <span className="font-semibold">Atuando em:</span> {activeClient.name}
                  </div>
                )}

                <div>
                  <h4 className="text-xs font-semibold text-slate-700 dark:text-zinc-400 mb-2">Tarefas Ativas ({userTasks.length})</h4>
                  {userTasks.length > 0 ? (
                    <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {userTasks.map(task => {
                        const client = task.clientId ? clientsById.get(task.clientId) : undefined;
                        return (
                          <li key={task.id} className="text-[10px] p-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-md">
                            <span className="font-semibold text-slate-800 dark:text-zinc-200">{task.title}</span>
                            {client && <span className="block text-slate-500 mt-0.5">Cliente: {client.name}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-[10px] text-slate-400 italic">Nenhuma tarefa pendente.</p>
                  )}
                </div>

                <div className="border-t border-slate-200 dark:border-zinc-800 pt-3">
                  <button
                    onClick={() => toggleHistory(profile.id)}
                    className="w-full flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      Tarefas Concluídas (últimos 30 dias) ({completedTasks.length})
                    </span>
                    {isHistoryOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {isHistoryOpen && (
                    completedTasks.length > 0 ? (
                      <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-1 mt-2">
                        {completedTasks.map(task => {
                          const client = task.clientId ? clientsById.get(task.clientId) : undefined;
                          return (
                            <li key={task.id} className="text-[10px] p-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-md">
                              <span className="font-semibold text-slate-800 dark:text-zinc-200">{task.title}</span>
                              <span className="block text-slate-500 mt-0.5">
                                {client ? `Cliente: ${client.name}` : "Tarefa Interna"} • Concluída em {formatDate((task.completedAt as string).slice(0, 10))}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic mt-2">Nenhuma tarefa concluída nos últimos 30 dias.</p>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
