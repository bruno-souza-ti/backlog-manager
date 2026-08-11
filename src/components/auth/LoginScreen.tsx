import React from "react";
import { BrainCircuit, Eye, EyeOff, Loader2, LogIn, ShieldCheck } from "lucide-react";

interface LoginScreenProps {
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  authError: string | null;
  authSuccessMsg: string | null;
  isSubmittingAuth: boolean;
  handleLoginEmail: (event: React.FormEvent) => void;
  handleResetPassword: () => void;
}

export default function LoginScreen({
  email,
  setEmail,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  authError,
  authSuccessMsg,
  isSubmittingAuth,
  handleLoginEmail,
  handleResetPassword,
}: LoginScreenProps) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950 p-4">
      <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 max-w-md w-full shadow-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto shadow-md">
            <BrainCircuit className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white">Geniality IA</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Gerenciamento de projetos, sprints e assistente cognitivo.
          </p>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 p-3 text-teal-800 dark:border-teal-900/50 dark:bg-teal-950/30 dark:text-teal-300">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-xs leading-relaxed">
            Acesso exclusivo para integrantes convidados pela Geniality.
          </p>
        </div>

        {authError && (
          <div role="alert" className="p-3 bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 text-xs rounded-xl border border-red-200 dark:border-red-900/40 text-center">
            {authError}
          </div>
        )}

        {authSuccessMsg && (
          <div role="status" className="p-3 bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300 text-xs rounded-xl border border-teal-200 dark:border-teal-900/50 text-center leading-relaxed">
            {authSuccessMsg}
          </div>
        )}

        <form onSubmit={handleLoginEmail} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1">E-mail</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
              required
            />
          </div>

          <div>
            <label htmlFor="login-password" className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1">Senha</label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full px-4 py-3 pr-10 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmittingAuth}
            className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-colors shadow flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmittingAuth ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            <span>{isSubmittingAuth ? "Entrando..." : "Entrar"}</span>
          </button>

          <div className="text-center pt-2">
            <button type="button" onClick={handleResetPassword} className="text-xs text-teal-600 dark:text-teal-400 hover:underline cursor-pointer">
              Esqueci minha senha
            </button>
          </div>
        </form>

        <p className="text-[11px] text-slate-500 dark:text-zinc-500 text-center pt-2">
          Geniality IA • Sincronização Inteligente
        </p>
      </section>
    </main>
  );
}
