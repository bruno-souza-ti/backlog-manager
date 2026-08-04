import React from "react";
import { BrainCircuit, Eye, EyeOff, Loader2, LogIn, Plus } from "lucide-react";

interface LoginScreenProps {
  authMode: "login" | "signup";
  setAuthMode: (mode: "login" | "signup") => void;
  fullName: string;
  setFullName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  showConfirmPassword: boolean;
  setShowConfirmPassword: (v: boolean) => void;
  authError: string | null;
  setAuthError: (v: string | null) => void;
  authSuccessMsg: string | null;
  setAuthSuccessMsg: (v: string | null) => void;
  isSubmittingAuth: boolean;
  handleLoginEmail: (e: React.FormEvent) => void;
  handleSignUpEmail: (e: React.FormEvent) => void;
  handleResetPassword: () => void;
}

export default function LoginScreen({
  authMode,
  setAuthMode,
  fullName,
  setFullName,
  email,
  setEmail,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  authError,
  setAuthError,
  authSuccessMsg,
  setAuthSuccessMsg,
  isSubmittingAuth,
  handleLoginEmail,
  handleSignUpEmail,
  handleResetPassword,
}: LoginScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950 p-4">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 max-w-md w-full shadow-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto shadow-md">
            <BrainCircuit className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white">
            Geniality IA
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Gerenciamento de projetos, sprints e assistente cognitivo.
          </p>
        </div>

        {/* MODE TAB SWITCHER */}
        <div className="flex bg-slate-100 dark:bg-zinc-950 p-1 rounded-xl border border-slate-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => {
              setAuthMode("login");
              setAuthError(null);
              setAuthSuccessMsg(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              authMode === "login"
                ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode("signup");
              setAuthError(null);
              setAuthSuccessMsg(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              authMode === "signup"
                ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
            }`}
          >
            Criar Conta
          </button>
        </div>

        {/* ALERT MESSAGES */}
        {authError && (
          <div className="p-3 bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 text-xs rounded-xl border border-red-200 dark:border-red-900/40 text-center">
            {authError}
          </div>
        )}

        {authSuccessMsg && (
          <div className="p-3 bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300 text-xs rounded-xl border border-teal-200 dark:border-teal-900/50 text-center leading-relaxed">
            {authSuccessMsg}
          </div>
        )}

        {/* LOGIN FORM */}
        {authMode === "login" && (
          <form onSubmit={handleLoginEmail} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1">
                E-mail
              </label>
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-10 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
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
              {isSubmittingAuth ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              <span>{isSubmittingAuth ? "Entrando..." : "Entrar"}</span>
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={handleResetPassword}
                className="text-xs text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
              >
                Esqueci minha senha
              </button>
            </div>
          </form>
        )}

        {/* SIGNUP FORM */}
        {authMode === "signup" && (
          <form onSubmit={handleSignUpEmail} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1">
                Nome Completo
              </label>
              <input
                type="text"
                placeholder="Seu Nome"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1">
                E-mail
              </label>
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1">
                Senha (mínimo 6 caracteres)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-10 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1">
                Confirmar Senha
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-10 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmittingAuth}
              className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-colors shadow flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmittingAuth ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>{isSubmittingAuth ? "Criando Conta..." : "Criar Conta"}</span>
            </button>
          </form>
        )}

        <p className="text-[11px] text-slate-500 dark:text-zinc-500 text-center pt-2">
          Geniality IA • Sincronização Inteligente
        </p>
      </div>
    </div>
  );
}
