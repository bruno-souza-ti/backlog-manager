import React, { useMemo, useState } from "react";
import { Users, Loader2, ChevronDown, ChevronUp, CheckCircle2, Search, ShieldCheck } from "lucide-react";
import { Task, Client, type ProfileRole } from "../types";
import { formatDate, formatTimeAgo } from "../utils";
import { computeDisplayStatus } from "../lib/presence";
import { useTeamProfiles } from "../hooks/useTeamProfiles";
import StatusBadge from "./common/StatusBadge";
import TeamAdministrationPanel from "./TeamAdministrationPanel";
import { hasPermission } from "../lib/permissions";
import type { GeminiPlatformStatus } from "../lib/platformStatus";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const COMPLETED_TASKS_PREVIEW_LIMIT = 5;

type TeamDashboardTab = "overview" | "admin";

interface TeamDashboardProps {
  clients: Client[];
  tasks: Task[];
  currentUserId: string;
  currentUserRole: ProfileRole;
  geminiStatus?: GeminiPlatformStatus | null;
  showPlatformStatus?: boolean;
}

export default function TeamDashboard({ clients, tasks, currentUserId, currentUserRole, geminiStatus = null, showPlatformStatus = false }: TeamDashboardProps) {
  const { profiles, loading } = useTeamProfiles();
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<TeamDashboardTab>("overview");
  const canManageTeam = hasPermission(currentUserRole, "team.manage");

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
  const filteredProfiles = useMemo(() => profiles.filter((profile) => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    const hasDoing = (tasksByAssignee.get(profile.id) || []).some((t) => t.column === "doing");
    const displayStatus = computeDisplayStatus(profile, hasDoing);
    return (statusFilter === "all" || displayStatus === statusFilter)
      && (!normalizedQuery || profile.full_name.toLocaleLowerCase("pt-BR").includes(normalizedQuery) || profile.email.toLocaleLowerCase("pt-BR").includes(normalizedQuery));
  }), [profiles, query, statusFilter, tasksByAssignee]);

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
      {canManageTeam && (
        <div role="tablist" aria-label="Seções da equipe" className="inline-flex w-fit items-center gap-1 rounded-[10px] border border-slate-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
          {([
            { id: "overview" as const, label: "Visão Geral", icon: Users },
            { id: "admin" as const, label: "Administração", icon: ShieldCheck },
          ]).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors cursor-pointer ${
                  isActive
                    ? "bg-teal-600 text-white"
                    : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {canManageTeam && activeTab === "admin" && (
        <TeamAdministrationPanel
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          geminiStatus={geminiStatus}
          showPlatformStatus={showPlatformStatus}
        />
      )}

      {(!canManageTeam || activeTab === "overview") && (
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><Users className="w-5 h-5 text-teal-600 dark:text-teal-400" /><h2 className="font-display font-bold text-lg text-slate-900 dark:text-white">Equipe</h2></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input aria-label="Buscar membro da equipe" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar pessoa…" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-teal-500 dark:border-zinc-800 dark:bg-zinc-950 sm:w-56" /></div>
            <select aria-label="Filtrar equipe por status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"><option value="all">Todos os status</option><option value="available">Disponível</option><option value="busy">Ocupado</option><option value="in_meeting">Em reunião</option><option value="offline">Offline</option></select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredProfiles.map(profile => {
            const assigneeTasks = tasksByAssignee.get(profile.id) || [];
            const userTasks = assigneeTasks.filter(t => t.column !== "done");
            const activeClient = profile.current_client_id ? clientsById.get(profile.current_client_id) : undefined;
            const isHistoryOpen = expandedHistory.has(profile.id);
            const now = Date.now();
            const displayStatus = computeDisplayStatus(profile, userTasks.some(t => t.column === "doing"));
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
                    <StatusBadge status={displayStatus} />
                    {displayStatus === "in_meeting" && profile.status_updated_at && (
                      <span className="text-[9px] text-slate-400 dark:text-zinc-500">
                        {formatTimeAgo(profile.status_updated_at)}
                      </span>
                    )}
                    {displayStatus === "offline" && profile.last_seen_at && (
                      <span className="text-[9px] text-slate-400 dark:text-zinc-500">
                        Visto {formatTimeAgo(profile.last_seen_at)}
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
                          <li key={task.id} className="text-xs p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-md">
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
                      <div className="mt-2 space-y-1.5">
                        <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {completedTasks.slice(0, COMPLETED_TASKS_PREVIEW_LIMIT).map(task => {
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
                        {completedTasks.length > COMPLETED_TASKS_PREVIEW_LIMIT && (
                          <p className="text-[10px] text-slate-400 dark:text-zinc-500 italic px-0.5">
                            … e mais {completedTasks.length - COMPLETED_TASKS_PREVIEW_LIMIT} tarefa{completedTasks.length - COMPLETED_TASKS_PREVIEW_LIMIT !== 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic mt-2">Nenhuma tarefa concluída nos últimos 30 dias.</p>
                    )
                  )}
                </div>
              </div>
            );
          })}
          {filteredProfiles.length === 0 && (
            <div className="md:col-span-2 xl:col-span-3 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-zinc-700 dark:text-zinc-400">Nenhum membro corresponde aos filtros atuais.</div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
