import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import { Profile } from "../types";

type AuthMode = "login" | "signup";

/**
 * Owns everything about the current session: login/signup/reset/Google-link
 * flows, the logged-in profile, and the persisted theme preference that used
 * to live inline in App.tsx. Client/task data loading is handled separately
 * by useClientsData/useTasksData once a session exists.
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [darkMode, setDarkMode] = useState<boolean>(true);

  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);

  const loadProfileAndSettings = useCallback(async (userId: string) => {
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (profile) setUserProfile(profile as Profile);

    const { data: settings } = await supabase.from("user_settings").select("*").eq("user_id", userId).single();
    if (settings?.theme) {
      setDarkMode(settings.theme === "dark");
    }
  }, []);

  useEffect(() => {
    // GoTrue delivers OAuth/linkIdentity failures (e.g. provider disabled,
    // redirect URL not allow-listed) as #error=...&error_description=... in the
    // URL instead of via onAuthStateChange, so it's silently dropped otherwise.
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const searchParams = new URLSearchParams(window.location.search);
    const err = searchParams.get("error") || hashParams.get("error");
    const errDesc = searchParams.get("error_description") || hashParams.get("error_description");

    if (err || errDesc) {
      const desc = errDesc ? decodeURIComponent(errDesc.replace(/\+/g, " ")) : err;
      setOauthError(
        `A vinculação com o Google falhou: ${desc}. Verifique se o provedor Google está habilitado no Supabase e se esta URL está na lista de redirecionamento permitida.`
      );
      window.history.replaceState(null, "", window.location.pathname);
    }

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      setSession(initialSession);
      if (initialSession) {
        await loadProfileAndSettings(initialSession.user.id);
      }
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        await loadProfileAndSettings(nextSession.user.id);
      } else {
        setUserProfile(null);
      }
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [loadProfileAndSettings]);

  const handleLoginEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccessMsg(null);
    setIsSubmittingAuth(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setIsSubmittingAuth(false);
    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        setAuthError("E-mail ou senha incorretos. Por favor, verifique seus dados.");
      } else {
        setAuthError(error.message);
      }
    }
  };

  const handleSignUpEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccessMsg(null);

    if (!fullName.trim()) {
      setAuthError("Por favor, preencha o seu nome completo.");
      return;
    }

    if (password !== confirmPassword) {
      setAuthError("As senhas não coincidem.");
      return;
    }

    if (password.length < 6) {
      setAuthError("A senha deve conter no mínimo 6 caracteres.");
      return;
    }

    setIsSubmittingAuth(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
      },
    });

    setIsSubmittingAuth(false);

    if (error) {
      setAuthError(error.message);
      return;
    }

    if (data.session) {
      setAuthSuccessMsg("Conta criada e autenticada com sucesso! Entrando...");
      setTimeout(() => {
        setSession(data.session);
      }, 1200);
    } else if (data.user && !data.session) {
      setAuthSuccessMsg(`Conta criada com sucesso! Enviamos um e-mail de confirmação para ${email.trim()}. Por favor, verifique sua caixa de entrada e clique no link de ativação antes de fazer o login.`);
      setTimeout(() => {
        setAuthMode("login");
      }, 3000);
    } else {
      setAuthSuccessMsg("Conta criada com sucesso!");
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setAuthError("Por favor, preencha o e-mail para instrução de recuperação.");
      return;
    }
    setAuthError(null);
    setAuthSuccessMsg(null);
    setIsSubmittingAuth(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setIsSubmittingAuth(false);

    if (error) {
      setAuthError(error.message);
    } else {
      setAuthSuccessMsg("Instruções de recuperação de senha foram enviadas para o seu e-mail.");
    }
  };

  const handleLinkGoogleCalendarInSettings = async (): Promise<string | null> => {
    setIsLinkingGoogle(true);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: {
          scopes: "https://www.googleapis.com/auth/calendar.readonly",
          redirectTo: window.location.origin,
        },
      });
      if (error) {
        return "Erro ao vincular Google Calendar: " + error.message;
      }
      return null;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro desconhecido.";
      return "Erro ao conectar Google Calendar: " + message;
    } finally {
      setIsLinkingGoogle(false);
    }
  };

  const handleSaveTheme = async (): Promise<string | null> => {
    if (!session?.user?.id) return null;
    const { error } = await supabase.from("user_settings").upsert(
      { user_id: session.user.id, theme: darkMode ? "dark" : "light" },
      { onConflict: "user_id" }
    );
    if (error) {
      console.error("Erro ao salvar configurações no Supabase:", error);
      return "Erro ao salvar configurações: " + error.message;
    }
    return null;
  };

  return {
    session,
    userProfile,
    setUserProfile,
    authLoading,
    darkMode,
    setDarkMode,
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
    oauthError,
    setOauthError,
    isLinkingGoogle,
    handleLoginEmail,
    handleSignUpEmail,
    handleResetPassword,
    handleLinkGoogleCalendarInSettings,
    handleSaveTheme,
  };
}
