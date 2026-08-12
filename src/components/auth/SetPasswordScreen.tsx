import { useState, type FormEvent } from "react";
import { BrainCircuit, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, LogOut } from "lucide-react";
import type { PasswordFlowMode } from "../../lib/passwordFlow";

interface SetPasswordScreenProps {
  mode: PasswordFlowMode;
  email?: string;
  error: string | null;
  sessionReady: boolean;
  submitting: boolean;
  onSubmit: (password: string, confirmation: string) => Promise<boolean>;
  onContinue: () => void;
  onSignOut: () => void;
}

export default function SetPasswordScreen({ mode, email, error, sessionReady, submitting, onSubmit, onContinue, onSignOut }: SetPasswordScreenProps) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [completed, setCompleted] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (await onSubmit(password, confirmation)) setCompleted(true);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950 p-4">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 shadow-md">
            {completed ? <CheckCircle2 className="h-8 w-8 text-white" /> : <BrainCircuit className="h-8 w-8 text-white" />}
          </div>
          <h1 className="mt-5 text-2xl font-display font-bold text-slate-900 dark:text-white">
            {completed ? "Senha definida" : mode === "invite" ? "Crie sua senha" : "Defina uma nova senha"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
            {completed
              ? "Sua credencial foi atualizada e o acesso está pronto."
              : mode === "invite"
                ? "Conclua seu primeiro acesso antes de entrar na plataforma."
                : "Escolha uma nova senha para recuperar o acesso à sua conta."}
          </p>
          {email && <p className="mt-2 text-xs text-slate-500 dark:text-zinc-500">Conta: {email}</p>}
        </div>

        {completed ? (
          <button type="button" onClick={onContinue} className="mt-6 w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-bold text-white hover:bg-teal-700">
            Continuar para a plataforma
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{error}</div>}

            <label className="block text-xs font-bold uppercase text-slate-500 dark:text-zinc-400">
              Nova senha
              <div className="relative mt-1.5">
                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input autoFocus required minLength={8} maxLength={72} autoComplete="new-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-11 text-sm outline-none focus:ring-2 focus:ring-teal-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white" />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            <label className="block text-xs font-bold uppercase text-slate-500 dark:text-zinc-400">
              Confirmar senha
              <input required minLength={8} maxLength={72} autoComplete="new-password" type={showPassword ? "text" : "password"} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white" />
            </label>

            <p className="text-xs text-slate-500 dark:text-zinc-500">Use entre 8 e 72 caracteres e evite reutilizar senhas de outros serviços.</p>

            <button type="submit" disabled={submitting || !sessionReady} className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-bold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Salvando..." : "Salvar senha"}
            </button>
          </form>
        )}

        {!completed && (
          <button type="button" onClick={onSignOut} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
            <LogOut className="h-4 w-4" /> Cancelar e sair
          </button>
        )}
      </section>
    </main>
  );
}
