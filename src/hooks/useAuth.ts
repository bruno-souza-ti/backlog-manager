import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import { resolveAccessState } from "../lib/accessControl";
import type { Profile } from "../types";
import {
  clearAuthCallbackUrl,
  detectPasswordFlow,
  passwordFlowFromAuthEvent,
  passwordRedirectUrl,
  validateNewPassword,
  type PasswordFlowMode,
} from "../lib/passwordFlow";

/** Owns authentication, active-membership validation and user preferences. */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileChecking, setProfileChecking] = useState(false);
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
  const [passwordFlow, setPasswordFlow] = useState<PasswordFlowMode | null>(() => detectPasswordFlow(window.location));
  const [passwordFlowError, setPasswordFlowError] = useState<string | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const loadProfileAndSettings = useCallback(async (userId: string) => {
    setProfileChecking(true);
    setProfileLoadFailed(false);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_color, role, is_active, status, current_client_id, status_updated_at, created_at, updated_at")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Erro ao validar acesso do perfil:", profileError);
      setUserProfile(null);
      setProfileLoadFailed(true);
      setProfileChecking(false);
      return;
    }

    const loadedProfile = (profile as Profile | null) ?? null;
    setUserProfile(loadedProfile);

    // Inactive/missing profiles intentionally cannot read user_settings.
    if (loadedProfile?.is_active) {
      const { data: settings, error: settingsError } = await supabase
        .from("user_settings")
        .select("theme")
        .eq("user_id", userId)
        .maybeSingle();

      if (settingsError) {
        console.error("Erro ao carregar preferências do usuário:", settingsError);
      } else if (settings?.theme) {
        setDarkMode(settings.theme === "dark");
      }
    }

    setProfileChecking(false);
  }, []);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const searchParams = new URLSearchParams(window.location.search);
    const err = searchParams.get("error") || hashParams.get("error");
    const errDesc = searchParams.get("error_description") || hashParams.get("error_description");

    if (err || errDesc) {
      const description = errDesc ? decodeURIComponent(errDesc.replace(/\+/g, " ")) : err;
      const isPasswordCallback = detectPasswordFlow(window.location) !== null;
      const message = isPasswordCallback
        ? `Este link de autenticação é inválido ou expirou: ${description}. Solicite um novo e-mail.`
        : `A vinculação com o Google falhou: ${description}. Verifique o provedor e as URLs de redirecionamento no Supabase.`;
      if (isPasswordCallback) setPasswordFlowError(message);
      else setOauthError(message);
      window.history.replaceState(null, "", window.location.pathname);
    }

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      setSession(initialSession);
      if (initialSession) await loadProfileAndSettings(initialSession.user.id);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      const eventFlow = passwordFlowFromAuthEvent(event);
      if (eventFlow) setPasswordFlow(eventFlow);
      setSession(nextSession);
      if (nextSession) {
        await loadProfileAndSettings(nextSession.user.id);
      } else {
        setUserProfile(null);
        setProfileLoadFailed(false);
        setProfileChecking(false);
      }
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [loadProfileAndSettings]);

  // Role and activation changes must take effect without waiting for a page
  // refresh. RLS already blocks subsequent requests immediately; this
  // subscription also removes the application shell and cached UI from view.
  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;

    const channel = supabase
      .channel(`own-profile-access:${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => setUserProfile(payload.new as Profile)
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        () => setUserProfile(null)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user.id]);

  const accessState = useMemo(
    () => resolveAccessState({
      hasSession: Boolean(session),
      checking: authLoading || profileChecking,
      profile: userProfile,
      profileLoadFailed,
    }),
    [authLoading, profileChecking, profileLoadFailed, session, userProfile]
  );

  const handleLoginEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthError(null);
    setAuthSuccessMsg(null);
    setIsSubmittingAuth(true);

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

    setIsSubmittingAuth(false);
    if (error) {
      setAuthError(
        error.message.includes("Invalid login credentials")
          ? "E-mail ou senha incorretos. Por favor, verifique seus dados."
          : error.message
      );
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setAuthError("Preencha o e-mail para receber as instruções de recuperação.");
      return;
    }

    setAuthError(null);
    setAuthSuccessMsg(null);
    setIsSubmittingAuth(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: passwordRedirectUrl(window.location.origin),
    });
    setIsSubmittingAuth(false);

    if (error) setAuthError(error.message);
    else setAuthSuccessMsg("Instruções de recuperação de senha foram enviadas para o seu e-mail.");
  };

  const reloadAccess = useCallback(async () => {
    if (session?.user.id) await loadProfileAndSettings(session.user.id);
  }, [loadProfileAndSettings, session?.user.id]);

  const handleSignOut = useCallback(async () => {
    setPasswordFlow(null);
    setPasswordFlowError(null);
    clearAuthCallbackUrl();
    await supabase.auth.signOut();
  }, []);

  const handleUpdatePassword = useCallback(async (newPassword: string, confirmation: string): Promise<boolean> => {
    const validationError = validateNewPassword(newPassword, confirmation);
    if (validationError) {
      setPasswordFlowError(validationError);
      return false;
    }
    if (!session) {
      setPasswordFlowError("A sessão deste link não está disponível ou expirou. Solicite um novo e-mail.");
      return false;
    }

    setPasswordFlowError(null);
    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setPasswordFlowError(error.message);
        return false;
      }
    } catch {
      setPasswordFlowError("Não foi possível atualizar a senha. Verifique sua conexão e tente novamente.");
      return false;
    } finally {
      setIsUpdatingPassword(false);
    }

    return true;
  }, [session]);

  const completePasswordFlow = useCallback(() => {
    setPasswordFlow(null);
    setPasswordFlowError(null);
    clearAuthCallbackUrl();
  }, []);

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
      return error ? "Erro ao vincular Google Calendar: " + error.message : null;
    } catch (error) {
      return "Erro ao conectar Google Calendar: " + (error instanceof Error ? error.message : "Erro desconhecido.");
    } finally {
      setIsLinkingGoogle(false);
    }
  };

  const handleSaveTheme = async (): Promise<string | null> => {
    if (!session?.user.id || accessState !== "allowed") return "Acesso não autorizado.";
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
    accessState,
    reloadAccess,
    handleSignOut,
    darkMode,
    setDarkMode,
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    authError,
    authSuccessMsg,
    isSubmittingAuth,
    oauthError,
    setOauthError,
    isLinkingGoogle,
    handleLoginEmail,
    handleResetPassword,
    passwordFlow,
    passwordFlowError,
    isUpdatingPassword,
    handleUpdatePassword,
    completePasswordFlow,
    handleLinkGoogleCalendarInSettings,
    handleSaveTheme,
  };
}
