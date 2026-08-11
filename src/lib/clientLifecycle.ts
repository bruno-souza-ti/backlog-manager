import type { Client, ClientLifecycleAction, ClientLifecycleStatus } from "../types";

interface LifecycleMeta {
  label: string;
  badgeClasses: string;
  description: string;
}

export type ClientLifecycleFilter = "operational" | ClientLifecycleStatus | "deleted" | "all";

export const CLIENT_LIFECYCLE_META: Readonly<Record<ClientLifecycleStatus | "deleted", LifecycleMeta>> = {
  active: {
    label: "Ativo",
    badgeClasses: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50",
    description: "Operação normal.",
  },
  inactive: {
    label: "Inativo",
    badgeClasses: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
    description: "Fora do acompanhamento ativo, mas ainda editável.",
  },
  frozen: {
    label: "Congelado",
    badgeClasses: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-900/50",
    description: "Somente leitura até ser descongelado por um administrador.",
  },
  deleted: {
    label: "Removido",
    badgeClasses: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/50",
    description: "Removido logicamente; pode ser restaurado por um administrador.",
  },
};

export function getClientLifecycleKey(client: Pick<Client, "status" | "deletedAt">): ClientLifecycleStatus | "deleted" {
  return client.deletedAt ? "deleted" : client.status;
}

export function isClientReadOnly(client: Pick<Client, "status" | "deletedAt">): boolean {
  return Boolean(client.deletedAt) || client.status === "frozen";
}

export function matchesClientLifecycleFilter(
  client: Pick<Client, "status" | "deletedAt">,
  filter: ClientLifecycleFilter
): boolean {
  const lifecycle = getClientLifecycleKey(client);
  if (filter === "all") return true;
  if (filter === "operational") return lifecycle === "active";
  return lifecycle === filter;
}

export function lifecycleActionLabel(action: ClientLifecycleAction): string {
  switch (action) {
    case "active": return "Ativar";
    case "inactive": return "Marcar como inativo";
    case "frozen": return "Congelar";
    case "deleted": return "Remover";
    case "restore": return "Restaurar";
  }
}
