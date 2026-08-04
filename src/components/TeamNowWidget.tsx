import { useMemo } from "react";
import { Client, Task } from "../types";
import { useTeamProfiles } from "../hooks/useTeamProfiles";
import { formatTimeAgo } from "../utils";
import { Radio, Loader2 } from "lucide-react";
import StatusBadge from "./common/StatusBadge";

interface TeamNowWidgetProps {
  clients: Client[];
  tasks: Task[];
}

export default function TeamNowWidget({ clients, tasks }: TeamNowWidgetProps) {
  const { profiles, loading } = useTeamProfiles();
  const clientsById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const doingTasksByAssignee = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((t) => {
      if (!t.assigneeId || t.column !== "doing") return;
      const bucket = map.get(t.assigneeId);
      if (bucket) bucket.push(t);
      else map.set(t.assigneeId, [t]);
    });
    return map;
  }, [tasks]);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <Radio className="w-4 h-4 text-teal-600 dark:text-teal-400" />
        <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">
          Agora na Equipe
        </h2>
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-teal-500" />
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-teal-500" />
        </div>
      ) : profiles.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-zinc-500 italic py-2">Nenhum membro de equipe encontrado.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {profiles.map((profile) => {
            const activeClient = profile.current_client_id ? clientsById.get(profile.current_client_id) : undefined;

            const doingTasks = (doingTasksByAssignee.get(profile.id) || [])
              .slice()
              .sort((a, b) => {
                const aTime = new Date(a.columnChangedAt || a.createdAt || 0).getTime();
                const bTime = new Date(b.columnChangedAt || b.createdAt || 0).getTime();
                return bTime - aTime;
              });
            const currentTask = doingTasks[0];
            const currentTaskClient = currentTask?.clientId ? clientsById.get(currentTask.clientId) : null;

            let workingOnLabel: string;
            if (profile.status === "in_meeting" && activeClient) {
              workingOnLabel = `Em reunião com ${activeClient.name}`;
            } else if (currentTask) {
              workingOnLabel = `${currentTask.title} • ${currentTaskClient ? currentTaskClient.name : "Backlog Geral"}`;
            } else {
              workingOnLabel = "Sem tarefa em andamento";
            }

            return (
              <div
                key={profile.id}
                className="p-3 bg-slate-50 dark:bg-zinc-950/50 border border-slate-200 dark:border-zinc-800/80 rounded-xl space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                    {profile.full_name}
                  </span>
                  <StatusBadge status={profile.status} className="shrink-0" />
                </div>
                <p className="text-[11px] text-slate-600 dark:text-zinc-400 truncate" title={workingOnLabel}>
                  {workingOnLabel}
                </p>
                {profile.status_updated_at && (
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                    {profile.status === "in_meeting" ? "Em Reunião " : ""}{formatTimeAgo(profile.status_updated_at)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
