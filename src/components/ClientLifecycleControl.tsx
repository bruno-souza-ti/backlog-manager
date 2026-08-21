import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Loader2 } from "lucide-react";
import type { Client, ClientLifecycleAction } from "../types";
import { CLIENT_LIFECYCLE_META, getClientLifecycleKey } from "../lib/clientLifecycle";
import ConfirmDialog from "./common/ConfirmDialog";

interface ClientLifecycleControlProps {
  client: Client;
  canManage: boolean;
  onChange: (clientId: string, action: ClientLifecycleAction) => Promise<boolean>;
  onRemoved?: () => void;
}

export default function ClientLifecycleControl({ client, canManage, onChange, onRemoved }: ClientLifecycleControlProps) {
  const lifecycle = getClientLifecycleKey(client);
  const meta = CLIENT_LIFECYCLE_META[lifecycle];
  const [pendingAction, setPendingAction] = useState<ClientLifecycleAction | null>(null);
  const [saving, setSaving] = useState(false);

  const applyAction = async (action: ClientLifecycleAction) => {
    setSaving(true);
    const succeeded = await onChange(client.id, action);
    setSaving(false);
    setPendingAction(null);
    if (succeeded && action === "deleted") onRemoved?.();
  };

  const requestAction = (action: ClientLifecycleAction) => {
    if (action === "deleted" || action === "frozen") {
      setPendingAction(action);
      return;
    }
    void applyAction(action);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.badgeClasses}`} title={meta.description}>
          {meta.label}
        </span>
        {canManage && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              aria-label="Alterar ciclo de vida do cliente"
              disabled={saving}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-zinc-300 outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>{saving ? "Atualizando..." : "Alterar status"}</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={4}
                className="z-[70] min-w-[10rem] overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
              >
                {lifecycle === "deleted" ? (
                  <DropdownMenu.Item
                    onSelect={() => requestAction("restore")}
                    className="cursor-pointer select-none rounded-lg px-3 py-2 text-sm text-slate-700 outline-none data-[highlighted]:bg-teal-50 data-[highlighted]:text-teal-700 dark:text-zinc-300 dark:data-[highlighted]:bg-teal-950/40 dark:data-[highlighted]:text-teal-400"
                  >
                    Restaurar cliente
                  </DropdownMenu.Item>
                ) : (
                  <>
                    {lifecycle !== "active" && (
                      <DropdownMenu.Item
                        onSelect={() => requestAction("active")}
                        className="cursor-pointer select-none rounded-lg px-3 py-2 text-sm text-slate-700 outline-none data-[highlighted]:bg-teal-50 data-[highlighted]:text-teal-700 dark:text-zinc-300 dark:data-[highlighted]:bg-teal-950/40 dark:data-[highlighted]:text-teal-400"
                      >
                        Ativar
                      </DropdownMenu.Item>
                    )}
                    {lifecycle !== "frozen" && (
                      <DropdownMenu.Item
                        onSelect={() => requestAction("frozen")}
                        className="cursor-pointer select-none rounded-lg px-3 py-2 text-sm text-slate-700 outline-none data-[highlighted]:bg-teal-50 data-[highlighted]:text-teal-700 dark:text-zinc-300 dark:data-[highlighted]:bg-teal-950/40 dark:data-[highlighted]:text-teal-400"
                      >
                        Congelar
                      </DropdownMenu.Item>
                    )}
                    <DropdownMenu.Item
                      onSelect={() => requestAction("deleted")}
                      className="cursor-pointer select-none rounded-lg px-3 py-2 text-sm text-red-600 outline-none data-[highlighted]:bg-red-50 dark:text-red-400 dark:data-[highlighted]:bg-red-950/30"
                    >
                      Cancelar cliente
                    </DropdownMenu.Item>
                  </>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
        {saving && <Loader2 className="w-4 h-4 animate-spin text-teal-500" />}
      </div>

      {pendingAction && (
        <ConfirmDialog
          title={pendingAction === "deleted" ? "Cancelar cliente?" : "Congelar cliente?"}
          message={pendingAction === "deleted"
            ? "O cliente deixará a operação, seus dados ficarão somente leitura e ele deixará de contar em qualquer indicador. Um administrador poderá restaurá-lo depois."
            : "Tarefas, notas e arquivos deste cliente ficarão somente leitura até que um administrador o reative."}
          confirmLabel={pendingAction === "deleted" ? "Cancelar cliente" : "Congelar"}
          danger={pendingAction === "deleted"}
          onConfirm={() => void applyAction(pendingAction)}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </>
  );
}
