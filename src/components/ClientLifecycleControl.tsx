import { useState } from "react";
import { Loader2 } from "lucide-react";
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
          <select
            aria-label="Alterar ciclo de vida do cliente"
            value=""
            disabled={saving}
            onChange={(event) => {
              const action = event.target.value as ClientLifecycleAction;
              if (action) requestAction(action);
            }}
            className="px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-zinc-300 disabled:opacity-50"
          >
            <option value="" disabled hidden>{saving ? "Atualizando..." : "Alterar status"}</option>
            {lifecycle === "deleted" ? (
              <option value="restore">Restaurar cliente</option>
            ) : (
              <>
                {lifecycle !== "active" && <option value="active">Ativar</option>}
                {lifecycle !== "frozen" && <option value="frozen">Congelar</option>}
                <option value="deleted">Cancelar cliente</option>
              </>
            )}
          </select>
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
