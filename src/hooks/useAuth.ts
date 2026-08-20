import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import { resolveAccessState, shouldCheckProfileInBackground } from "../lib/accessControl";
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

  const loadProfileAndSettings = useCallback(async (
    userId: string,
    options: { background?: boolean } = {}
  ) => {
    const background = options.background === true;
    if (!background) {
      setProfileChecking(true);
      setProfileLoadFailed(false);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_color, role, is_active, status, current_client_id, status_updated_at, last_seen_at, created_at, updated_at")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Erro ao validar acesso do perfil:", profileError);
      if (!background) {
        setUserProfile(null);
        setProfileLoadFailed(true);
        setProfileChecking(false);
      }
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

    if (!background) setProfileChecking(false);
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
        await loadProfileAndSettings(nextSession.user.id, {
          background: shouldCheckProfileInBackground(event),
        });
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

  // Theme now saves itself the moment it changes — no separate "Save" step.
  // A harmless extra write can happen right after login (state getting set
  // from the just-fetched value), but it's a cheap upsert on a tiny table.
  useEffect(() => {
    if (!session?.user.id || accessState !== "allowed") return;
    void supabase.from("user_settings").upsert(
      { user_id: session.user.id, theme: darkMode ? "dark" : "light" },
      { onConflict: "user_id" }
    );
  }, [darkMode, session?.user.id, accessState]);

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleUpdateProfile = useCallback(async (fullName: string, avatarUrl: string | null): Promise<string | null> => {
    if (!fullName.trim()) return "O nome não pode ficar vazio.";
    setIsSavingProfile(true);
    try {
      const { data, error } = await supabase.rpc("update_own_profile", {
        p_full_name: fullName.trim(),
        p_avatar_url: avatarUrl,
      });
      if (error) return error.message || "Não foi possível salvar o perfil.";

      const updated = Array.isArray(data) ? data[0] : data;
      if (updated) {
        setUserProfile((prev) => prev ? { ...prev, full_name: updated.full_name, avatar_url: updated.avatar_url } : prev);
      }
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Não foi possível salvar o perfil.";
    } finally {
      setIsSavingProfile(false);
    }
  }, []);

  /** Uploads to the caller's own folder in the `avatars` bucket and returns its public URL — does not persist it to the profile by itself. */
  const handleUploadAvatar = useCallback(async (file: File): Promise<{ url: string | null; error: string | null }> => {
    if (!session?.user.id) return { url: null, error: "Sessão inválida." };
    if (!file.type.startsWith("image/")) return { url: null, error: "Envie um arquivo de imagem (PNG, JPG ou WEBP)." };
    if (file.size > 2_000_000) return { url: null, error: "A imagem excede o limite de 2 MB." };

    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${session.user.id}/avatar-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
      upsert: true,
      cacheControl: "3600",
    });
    if (uploadError) return { url: null, error: "Não foi possível enviar a imagem: " + uploadError.message };

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  }, [session?.user.id]);

  const handleChangePassword = useCallback(async (currentPassword: string, newPassword: string, confirmation: string): Promise<string | null> => {
    const validationError = validateNewPassword(newPassword, confirmation);
    if (validationError) return validationError;
    if (!session?.user.email) return "Sessão inválida.";

    setIsChangingPassword(true);
    try {
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: currentPassword,
      });
      if (reauthError) return "Senha atual incorreta.";

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return error.message;
      return null;
    } catch {
      return "Não foi possível alterar a senha. Verifique sua conexão e tente novamente.";
    } finally {
      setIsChangingPassword(false);
    }
  }, [session?.user.email]);

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
    isSavingProfile,
    handleUpdateProfile,
    handleUploadAvatar,
    isChangingPassword,
    handleChangePassword,
  };
}
