import { lazy, Suspense, useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import ClientDetails from "./components/ClientDetails";
import NewClientModal from "./components/NewClientModal";
import BacklogGeral from "./components/BacklogGeral";
import LoginScreen from "./components/auth/LoginScreen";
import AccessGateScreen from "./components/auth/AccessGateScreen";
import SetPasswordScreen from "./components/auth/SetPasswordScreen";
import DashboardView from "./components/dashboard/DashboardView";
import ClientsView from "./components/ClientsView";
import DashboardHeader from "./components/dashboard/DashboardHeader";
import MobileNav from "./components/dashboard/MobileNav";
import AnalyticsChatPanel from "./components/dashboard/AnalyticsChatPanel";
import GlobalSearch from "./components/GlobalSearch";
import { canAccessView, hasPermission, type AppView } from "./lib/permissions";
import { UrgencyLevel } from "./types";
import { AlertTriangle, BrainCircuit } from "lucide-react";
import { useAuth } from "./hooks/useAuth";
import { useClientsData } from "./hooks/useClientsData";
import { useTasksData } from "./hooks/useTasksData";
import { useDesktopNotifications } from "./hooks/useDesktopNotifications";
import { useClientHealthSignals } from "./hooks/useClientHealthSignals";
import { usePresenceHeartbeat } from "./hooks/usePresenceHeartbeat";
import { computeDisplayStatus, hasTaskInDoing } from "./lib/presence";
import { useToast } from "./components/common/ToastProvider";
import { authGetJson } from "./lib/apiClient";
import { isClientReadOnly } from "./lib/clientLifecycle";
import type { GeminiPlatformStatus } from "./lib/platformStatus";

type TaskScope = "mine" | "all";
const TASK_SCOPE_STORAGE_KEY = "backlog-manager:dashboard-task-scope";
const TeamDashboard = lazy(() => import("./components/TeamDashboard"));
const Reports = lazy(() => import("./components/Reports"));
const SettingsView = lazy(() => import("./components/settings/SettingsView"));

function ViewLoading() {
  return <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400" role="status">Carregando tela…</div>;
}

export default function App() {
  const auth = useAuth();
  const { showToast } = useToast();
  const userId = auth.accessState === "allowed" ? auth.session?.user?.id : undefined;
  const userRole = auth.accessState === "allowed" ? auth.userProfile?.role : undefined;
  const canCreateClient = hasPermission(userRole, "clients.create");
  const canManageClientLifecycle = hasPermission(userRole, "clients.manage_lifecycle");
  const canUseGlobalAnalytics = hasPermission(userRole, "analytics.global");
  const canViewPlatformStatus = hasPermission(userRole, "platform.status");

  const clientsData = useClientsData(userId);
  const tasksData = useTasksData(userId, clientsData.clients);
  const notifications = useDesktopNotifications(tasksData.tasks, clientsData.clients, userId);
  const healthSignals = useClientHealthSignals(userId);
  usePresenceHeartbeat(userId);

  const [currentView, setView] = useState<AppView>("dashboard");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showAnalyticsChat, setShowAnalyticsChat] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [urgencyFilter, setUrgencyFilter] = useState<"Todas" | UrgencyLevel>("Todas");
  const [taskScope, setTaskScope] = useState<TaskScope>(() => {
    const saved = window.localStorage.getItem(TASK_SCOPE_STORAGE_KEY);
    return saved === "all" ? "all" : "mine";
  });
  const [geminiStatus, setGeminiStatus] = useState<GeminiPlatformStatus | null>(null);

  // Load clients + tasks once a session exists (mirrors the old fetchInitialData trigger).
  useEffect(() => {
    if (auth.accessState === "allowed") {
      clientsData.fetchClients();
      tasksData.fetchTasks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.accessState]);

  // Clear operational state as soon as access is revoked or the session ends.
  useEffect(() => {
    if (auth.accessState === "allowed" || auth.accessState === "checking") return;
    clientsData.setClients([]);
    tasksData.clearTasks();
    setSelectedClientId(null);
    setShowNewClientModal(false);
    setShowAnalyticsChat(false);
    setShowGlobalSearch(false);
  }, [auth.accessState, clientsData.setClients, tasksData.clearTasks]);

  // Global "quick search" shortcut (Cmd/Ctrl+K), available from anywhere in the app.
  useEffect(() => {
    if (auth.accessState !== "allowed") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setShowGlobalSearch(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [auth.accessState]);

  // A role can change while a view is open. Never keep rendering a view that
  // is no longer present in the validated role's capability set.
  useEffect(() => {
    if (auth.accessState === "allowed" && !canAccessView(userRole, currentView)) {
      setSelectedClientId(null);
      setView("dashboard");
    }
  }, [auth.accessState, currentView, userRole]);

  // Lazily load notes history + files only for the client currently being viewed.
  useEffect(() => {
    if (selectedClientId) {
      clientsData.fetchClientDetails(selectedClientId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId]);

  // Fetch API Health on mount
  useEffect(() => {
    if (auth.accessState !== "allowed" || !canViewPlatformStatus) return;
    authGetJson<GeminiPlatformStatus>("/api/platform/status")
      .then(setGeminiStatus)
      .catch(() => setGeminiStatus({
        enabled: true,
        configured: true,
        available: false,
        state: "unavailable",
        model: "",
        checkedAt: new Date().toISOString(),
        retryable: true,
      }));
  }, [auth.accessState, canViewPlatformStatus]);

  // Dark mode side-effect
  useEffect(() => {
    if (auth.darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [auth.darkMode]);

  useEffect(() => {
    window.localStorage.setItem(TASK_SCOPE_STORAGE_KEY, taskScope);
  }, [taskScope]);

  const selectedClient = clientsData.clients.find((c) => c.id === selectedClientId) || null;
  const writableClients = clientsData.clients.filter((client) => !isClientReadOnly(client));
  const isGoogleLinked = !!auth.session?.user?.identities?.some((id) => id.provider === "google");
  const myDisplayStatus = auth.userProfile
    ? computeDisplayStatus(auth.userProfile, hasTaskInDoing(tasksData.tasks, auth.userProfile.id))
    : undefined;

  const navigateTo = (view: AppView) => {
    if (!canAccessView(userRole, view)) return;
    setSelectedClientId(null);
    setView(view);
  };

  const handleLinkGoogle = async () => {
    const errorMsg = await auth.handleLinkGoogleCalendarInSettings();
    if (errorMsg) showToast(errorMsg, "error");
  };

  const handleUpdateName = async (fullName: string) => {
    const errorMsg = await auth.handleUpdateProfile(fullName, auth.userProfile?.avatar_url ?? null);
    showToast(errorMsg || "Nome atualizado.", errorMsg ? "error" : "success");
  };

  const handleUploadAvatar = async (file: File) => {
    const { url, error } = await auth.handleUploadAvatar(file);
    if (error || !url) {
      showToast(error || "Não foi possível enviar a imagem.", "error");
      return;
    }
    const saveError = await auth.handleUpdateProfile(auth.userProfile?.full_name || "", url);
    showToast(saveError || "Foto de perfil atualizada.", saveError ? "error" : "success");
  };

  const handleChangePassword = async (currentPassword: string, newPassword: string, confirmation: string) => {
    const errorMsg = await auth.handleChangePassword(currentPassword, newPassword, confirmation);
    showToast(errorMsg || "Senha alterada com sucesso.", errorMsg ? "error" : "success");
    return !errorMsg;
  };

  if (auth.passwordFlow && auth.authLoading) {
    return <AccessGateScreen state="checking" onRetry={auth.reloadAccess} onSignOut={auth.handleSignOut} />;
  }

  if (auth.passwordFlow) {
    return (
      <SetPasswordScreen
        mode={auth.passwordFlow}
        email={auth.session?.user.email}
        error={auth.passwordFlowError || (!auth.session ? "Este link é inválido, já foi utilizado ou expirou. Solicite um novo e-mail." : null)}
        sessionReady={Boolean(auth.session)}
        submitting={auth.isUpdatingPassword}
        onSubmit={auth.handleUpdatePassword}
        onContinue={auth.completePasswordFlow}
        onSignOut={auth.handleSignOut}
      />
    );
  }

  if (auth.accessState === "checking") {
    return <AccessGateScreen state="checking" onRetry={auth.reloadAccess} onSignOut={auth.handleSignOut} />;
  }

  if (auth.accessState === "signed_out") {
    return (
      <LoginScreen
        email={auth.email}
        setEmail={auth.setEmail}
        password={auth.password}
        setPassword={auth.setPassword}
        showPassword={auth.showPassword}
        setShowPassword={auth.setShowPassword}
        authError={auth.authError}
        authSuccessMsg={auth.authSuccessMsg}
        isSubmittingAuth={auth.isSubmittingAuth}
        handleLoginEmail={auth.handleLoginEmail}
        handleResetPassword={auth.handleResetPassword}
      />
    );
  }

  if (auth.accessState === "denied" || auth.accessState === "error") {
    return (
      <AccessGateScreen
        state={auth.accessState}
        email={auth.session?.user.email}
        onRetry={auth.reloadAccess}
        onSignOut={auth.handleSignOut}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 transition-colors">
      {auth.oauthError && (
        <div className="fixed top-4 right-4 z-50 max-w-sm p-3 bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 text-xs rounded-xl border border-red-200 dark:border-red-900/40 shadow-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{auth.oauthError}</span>
          <button onClick={() => auth.setOauthError(null)} className="shrink-0 opacity-70 hover:opacity-100 cursor-pointer">✕</button>
        </div>
      )}

      {/* PERSISTENT SIDEBAR */}
      <Sidebar
        currentView={currentView}
        setView={setView}
        selectedClientId={selectedClientId}
        setSelectedClientId={setSelectedClientId}
        darkMode={auth.darkMode}
        setDarkMode={auth.setDarkMode}
        userProfile={auth.userProfile}
        displayStatus={myDisplayStatus}
        onOpenSearch={() => setShowGlobalSearch(true)}
      />

      {/* MAIN VIEWPORT CANVAS */}
      <main className="flex-1 min-w-0 overflow-x-hidden p-6 md:p-8 overflow-y-auto h-screen bg-slate-50 dark:bg-zinc-950 transition-colors">
        <MobileNav
          currentView={currentView}
          onNavigate={navigateTo}
          role={userRole!}
          darkMode={auth.darkMode}
          onToggleTheme={() => auth.setDarkMode((current) => !current)}
          userProfile={auth.userProfile}
          displayStatus={myDisplayStatus}
          onSignOut={auth.handleSignOut}
          onOpenSearch={() => setShowGlobalSearch(true)}
        />

        {/* Dynamic Client workspace (renders on client click instead of dashboard) */}
        {selectedClient ? (
          <ClientDetails
            client={selectedClient}
            allClients={writableClients}
            tasks={tasksData.tasks}
            currentUserId={userId!}
            detailsLoading={clientsData.detailsLoadingId === selectedClient.id}
            recentChangeCountByClient={healthSignals.recentChangeCountByClient}
            onBack={() => {
              setSelectedClientId(null);
              setView("dashboard");
            }}
            onUpdateClientNotes={clientsData.handleUpdateClientNotes}
            onSaveNotesToHistory={clientsData.handleSaveNotesToHistory}
            onUpdateNoteHistory={clientsData.handleUpdateNoteHistory}
            onDeleteNoteHistory={clientsData.handleDeleteNoteHistory}
            onDepositNotes={clientsData.handleDepositNotes}
            onAddTask={tasksData.handleAddTask}
            onDeleteTask={tasksData.handleDeleteTask}
            onUpdateTaskColumn={tasksData.handleUpdateTaskColumn}
            onUpdateTask={tasksData.handleUpdateTask}
            onUploadFile={clientsData.handleUploadFile}
            onDeleteFile={clientsData.handleDeleteFile}
            canManageLifecycle={canManageClientLifecycle}
            onSetLifecycle={clientsData.handleSetClientLifecycle}
          />
        ) : (
          <div className="space-y-6">
            <DashboardHeader currentView={currentView} />

            {currentView === "dashboard" && (
              <DashboardView
                clients={clientsData.clients}
                tasks={tasksData.tasks}
                onSelectClient={setSelectedClientId}
                urgencyFilter={urgencyFilter}
                setUrgencyFilter={setUrgencyFilter}
                taskScope={taskScope}
                setTaskScope={setTaskScope}
                currentUserId={userId!}
                onUpdateTaskColumn={tasksData.handleUpdateTaskColumn}
                onUpdateTask={tasksData.handleUpdateTask}
                loading={clientsData.clientsLoading || tasksData.tasksLoading}
                loadError={clientsData.clientsError || tasksData.tasksError}
                onRetry={() => {
                  void clientsData.fetchClients();
                  void tasksData.fetchTasks();
                }}
              />
            )}

            {currentView === "clients" && (
              <ClientsView
                clients={clientsData.clients}
                tasks={tasksData.tasks}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onSelectClient={setSelectedClientId}
                onNewClient={() => setShowNewClientModal(true)}
                lastMeetingAtByClient={healthSignals.lastMeetingAtByClient}
                recentChangeCountByClient={healthSignals.recentChangeCountByClient}
                canCreateClient={canCreateClient}
                canManageClientLifecycle={canManageClientLifecycle}
                loading={clientsData.clientsLoading || tasksData.tasksLoading}
                loadError={clientsData.clientsError || tasksData.tasksError}
                onRetry={() => {
                  void clientsData.fetchClients();
                  void tasksData.fetchTasks();
                }}
              />
            )}

            <Suspense fallback={<ViewLoading />}>
            {currentView === "backlog" && (
              <BacklogGeral
                tasks={tasksData.tasks}
                currentUserId={userId!}
                onAddTask={tasksData.handleAddTask}
                onDeleteTask={tasksData.handleDeleteTask}
                onUpdateTaskColumn={tasksData.handleUpdateTaskColumn}
                onUpdateTask={tasksData.handleUpdateTask}
              />
            )}

            {currentView === "team" && (
              <TeamDashboard
                clients={clientsData.clients}
                tasks={tasksData.tasks}
                currentUserId={userId!}
                currentUserRole={userRole!}
                geminiStatus={geminiStatus}
                showPlatformStatus={canViewPlatformStatus}
              />
            )}

            {currentView === "reports" && canAccessView(userRole, "reports") && (
              <Reports clients={clientsData.clients} tasks={tasksData.tasks} />
            )}

            {currentView === "settings" && (
              <SettingsView
                isGoogleLinked={isGoogleLinked}
                isLinkingGoogle={auth.isLinkingGoogle}
                onLinkGoogle={handleLinkGoogle}
                darkMode={auth.darkMode}
                onDarkModeChange={auth.setDarkMode}
                userProfile={auth.userProfile}
                onSignOut={auth.handleSignOut}
                isSavingProfile={auth.isSavingProfile}
                onUpdateName={handleUpdateName}
                onUploadAvatar={handleUploadAvatar}
                isChangingPassword={auth.isChangingPassword}
                onChangePassword={handleChangePassword}
                notifPermission={notifications.notifPermission}
                notificationsEnabled={notifications.notificationsEnabled}
                onToggleNotifications={notifications.handleToggleNotifications}
                onTestNotification={notifications.handleTestNotification}
                notifyScope={notifications.scope}
                onNotifyScopeChange={notifications.setScope}
                notifyOverdue={notifications.notifyOverdue}
                onNotifyOverdueChange={notifications.setNotifyOverdue}
                notifyDueToday={notifications.notifyDueToday}
                onNotifyDueTodayChange={notifications.setNotifyDueToday}
                sound={notifications.sound}
                onSoundChange={notifications.setSound}
              />
            )}
            </Suspense>
          </div>
        )}
      </main>

      {/* NEW CLIENT DIALOG MODAL */}
      {showNewClientModal && canCreateClient && (
        <NewClientModal
          onClose={() => setShowNewClientModal(false)}
          onAddClient={clientsData.handleAddClient}
        />
      )}

      {/* IA ANALÍTICA — floating action button + slide-over global */}
      {canUseGlobalAnalytics && (
        <>
          <button
            type="button"
            aria-label="Abrir IA Analítica"
            onClick={() => setShowAnalyticsChat(true)}
            className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white shadow-lg shadow-teal-500/30 flex items-center justify-center transition-all duration-200 hover:scale-105 cursor-pointer"
            title="IA Analítica"
          >
            <BrainCircuit className="w-6 h-6" />
          </button>
          <AnalyticsChatPanel
            isOpen={showAnalyticsChat}
            onClose={() => setShowAnalyticsChat(false)}
          />
        </>
      )}

      {/* BUSCA GLOBAL — Cmd/Ctrl+K de qualquer tela */}
      {showGlobalSearch && (
        <GlobalSearch
          clients={clientsData.clients}
          tasks={tasksData.tasks}
          onClose={() => setShowGlobalSearch(false)}
          onSelectClient={(clientId) => {
            setSelectedClientId(clientId);
            setShowGlobalSearch(false);
          }}
          onSelectBacklog={() => {
            setSelectedClientId(null);
            setView("backlog");
            setShowGlobalSearch(false);
          }}
        />
      )}
    </div>
  );
}
