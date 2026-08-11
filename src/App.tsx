import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import ClientDetails from "./components/ClientDetails";
import NewClientModal from "./components/NewClientModal";
import MeetBotModal from "./components/MeetBotModal";
import QuickTaskModal from "./components/QuickTaskModal";
import TeamDashboard from "./components/TeamDashboard";
import Reports from "./components/Reports";
import BacklogGeral from "./components/BacklogGeral";
import LoginScreen from "./components/auth/LoginScreen";
import AccessGateScreen from "./components/auth/AccessGateScreen";
import SettingsView from "./components/settings/SettingsView";
import DashboardView from "./components/dashboard/DashboardView";
import DashboardHeader from "./components/dashboard/DashboardHeader";
import MobileNav from "./components/dashboard/MobileNav";
import { canAccessView, hasPermission, type AppView } from "./lib/permissions";
import { UrgencyLevel } from "./types";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "./hooks/useAuth";
import { useClientsData } from "./hooks/useClientsData";
import { useTasksData } from "./hooks/useTasksData";
import { useDesktopNotifications } from "./hooks/useDesktopNotifications";
import { useClientHealthSignals } from "./hooks/useClientHealthSignals";
import { useToast } from "./components/common/ToastProvider";
import { authGetJson } from "./lib/apiClient";
import { isClientReadOnly } from "./lib/clientLifecycle";

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
  const notifications = useDesktopNotifications(tasksData.tasks, clientsData.clients);
  const healthSignals = useClientHealthSignals(userId);

  const [currentView, setView] = useState<AppView>("dashboard");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showMeetBotModal, setShowMeetBotModal] = useState(false);
  const [showQuickTaskModal, setShowQuickTaskModal] = useState(false);
  const [urgencyFilter, setUrgencyFilter] = useState<"Todas" | UrgencyLevel>("Todas");
  const [geminiStatus, setGeminiStatus] = useState<"loading" | "connected" | "not_configured">("loading");

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
    setShowMeetBotModal(false);
    setShowQuickTaskModal(false);
  }, [auth.accessState, clientsData.setClients, tasksData.clearTasks]);

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
    authGetJson<{ geminiConfigured: boolean }>("/api/platform/status")
      .then((data) => {
        setGeminiStatus(data.geminiConfigured ? "connected" : "not_configured");
      })
      .catch(() => setGeminiStatus("not_configured"));
  }, [auth.accessState, canViewPlatformStatus]);

  // Dark mode side-effect
  useEffect(() => {
    if (auth.darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [auth.darkMode]);

  const selectedClient = clientsData.clients.find((c) => c.id === selectedClientId) || null;
  const writableClients = clientsData.clients.filter((client) => !isClientReadOnly(client));
  const isGoogleLinked = !!auth.session?.user?.identities?.some((id) => id.provider === "google");

  const navigateTo = (view: AppView) => {
    if (!canAccessView(userRole, view)) return;
    setSelectedClientId(null);
    setView(view);
  };

  const handleSaveSettings = async () => {
    const errorMsg = await auth.handleSaveTheme();
    if (errorMsg) {
      showToast(errorMsg, "error");
      return;
    }
    showToast("Configurações salvas com sucesso.", "success");
    setView("dashboard");
  };

  const handleLinkGoogle = async () => {
    const errorMsg = await auth.handleLinkGoogleCalendarInSettings();
    if (errorMsg) showToast(errorMsg, "error");
  };

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
        onStatusChange={(newStatus) => {
          if (auth.userProfile) auth.setUserProfile({ ...auth.userProfile, status: newStatus });
        }}
      />

      {/* MAIN VIEWPORT CANVAS */}
      <main className="flex-1 min-w-0 overflow-x-hidden p-6 md:p-8 overflow-y-auto h-screen bg-slate-50 dark:bg-zinc-950 transition-colors">
        <MobileNav currentView={currentView} onNavigate={navigateTo} role={userRole!} />

        {/* Dynamic Client workspace (renders on client click instead of dashboard) */}
        {selectedClient ? (
          <ClientDetails
            client={selectedClient}
            allClients={writableClients}
            tasks={tasksData.tasks}
            detailsLoading={clientsData.detailsLoadingId === selectedClient.id}
            recentChangeCountByClient={healthSignals.recentChangeCountByClient}
            onBack={() => {
              setSelectedClientId(null);
              setView("dashboard");
            }}
            onUpdateClientNotes={clientsData.handleUpdateClientNotes}
            onSaveNotesToHistory={clientsData.handleSaveNotesToHistory}
            onAddTask={tasksData.handleAddTask}
            onDeleteTask={tasksData.handleDeleteTask}
            onUpdateTaskColumn={tasksData.handleUpdateTaskColumn}
            onUploadFile={clientsData.handleUploadFile}
            onDeleteFile={clientsData.handleDeleteFile}
            canManageLifecycle={canManageClientLifecycle}
            onSetLifecycle={clientsData.handleSetClientLifecycle}
          />
        ) : (
          <div className="space-y-6">
            <DashboardHeader
              currentView={currentView}
              notifPermission={notifications.notifPermission}
              onEnableNotifications={notifications.handleEnableNotifications}
              onTestNotification={notifications.handleTestNotification}
              onOpenQuickTask={() => setShowQuickTaskModal(true)}
              onOpenMeetBot={() => setShowMeetBotModal(true)}
            />

            {currentView === "dashboard" && (
              <DashboardView
                clients={clientsData.clients}
                tasks={tasksData.tasks}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onSelectClient={setSelectedClientId}
                onNewClient={() => setShowNewClientModal(true)}
                urgencyFilter={urgencyFilter}
                setUrgencyFilter={setUrgencyFilter}
                onUpdateTaskColumn={tasksData.handleUpdateTaskColumn}
                lastMeetingAtByClient={healthSignals.lastMeetingAtByClient}
                recentChangeCountByClient={healthSignals.recentChangeCountByClient}
                canCreateClient={canCreateClient}
                canUseGlobalAnalytics={canUseGlobalAnalytics}
                canManageClientLifecycle={canManageClientLifecycle}
              />
            )}

            {currentView === "backlog" && (
              <BacklogGeral
                tasks={tasksData.tasks}
                onAddTask={tasksData.handleAddTask}
                onDeleteTask={tasksData.handleDeleteTask}
                onUpdateTaskColumn={tasksData.handleUpdateTaskColumn}
              />
            )}

            {currentView === "team" && (
              <TeamDashboard clients={clientsData.clients} tasks={tasksData.tasks} />
            )}

            {currentView === "reports" && canAccessView(userRole, "reports") && (
              <Reports clients={clientsData.clients} tasks={tasksData.tasks} />
            )}

            {currentView === "settings" && (
              <SettingsView
                geminiStatus={geminiStatus}
                isGoogleLinked={isGoogleLinked}
                isLinkingGoogle={auth.isLinkingGoogle}
                onLinkGoogle={handleLinkGoogle}
                onSave={handleSaveSettings}
                showPlatformStatus={canViewPlatformStatus}
              />
            )}
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

      {/* MEET BOT MODAL */}
      {showMeetBotModal && (
        <MeetBotModal
          clients={writableClients}
          initialClientId={selectedClientId || undefined}
          onClose={() => setShowMeetBotModal(false)}
          onDepositNotes={clientsData.handleDepositNotes}
          onAddTasks={(newTasks) => {
            newTasks.forEach((t) => tasksData.handleAddTask(t));
          }}
          onNavigateToClient={(clientId) => {
            setSelectedClientId(clientId);
            setView("dashboard");
          }}
        />
      )}

      {/* QUICK TASK MODAL (Header launcher) */}
      {showQuickTaskModal && (
        <QuickTaskModal
          clients={writableClients}
          initialClientId={selectedClientId || undefined}
          onClose={() => setShowQuickTaskModal(false)}
          onAddTask={tasksData.handleAddTask}
        />
      )}
    </div>
  );
}
