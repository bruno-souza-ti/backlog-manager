import { AlertTriangle, Loader2, LogOut, RefreshCw } from "lucide-react";
import type { AccessState } from "../../lib/accessControl";

interface AccessGateScreenProps {
  state: Extract<AccessState, "checking" | "denied" | "error">;
  email?: string;
  onRetry: () => void;
  onSignOut: () => void;
}

export default function AccessGateScreen({ state, email, onRetry, onSignOut }: AccessGateScreenProps) {
  if (state === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600 dark:text-teal-400" aria-label="Validando acesso" />
      </div>
    );
  }

  const isError = state === "error";

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950 p-4">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center shadow-lg">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-950/40">
          <AlertTriangle className="h-7 w-7 text-amber-700 dark:text-amber-400" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {isError ? "Não foi possível validar seu acesso" : "Acesso não autorizado"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
          {isError
            ? "Houve uma falha ao consultar seu perfil. Tente novamente em instantes."
            : "Esta plataforma é exclusiva para integrantes ativos da Geniality. Solicite acesso a um administrador."}
        </p>
        {email && <p className="mt-2 text-xs text-slate-500 dark:text-zinc-500">Sessão: {email}</p>}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {isError && (
            <button type="button" onClick={onRetry} className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-700">
              <RefreshCw className="h-4 w-4" /> Tentar novamente
            </button>
          )}
          <button type="button" onClick={onSignOut} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-zinc-700 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800">
            <LogOut className="h-4 w-4" /> Sair desta conta
          </button>
        </div>
      </section>
    </main>
  );
}
