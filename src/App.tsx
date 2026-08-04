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
import SettingsView from "./components/settings/SettingsView";
import DashboardView from "./components/dashboard/DashboardView";
import DashboardHeader from "./components/dashboard/DashboardHeader";
import MobileNav, { AppView } from "./components/dashboard/MobileNav";
import { UrgencyLevel } from "./types";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useAuth } from "./hooks/useAuth";
import { useClientsData } from "./hooks/useClientsData";
import { useTasksData } from "./hooks/useTasksData";
import { useDesktopNotifications } from "./hooks/useDesktopNotifications";
import { useToast } from "./components/common/ToastProvider";

export default function App() {
  const auth = useAuth();
  const { showToast } = useToast();
  const userId = auth.session?.user?.id;

  const clientsData = useClientsData(userId);
  const tasksData = useTasksData(userId, auth.userProfile?.full_name);
  const notifications = useDesktopNotifications(tasksData.tasks, clientsData.clients);

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
    if (auth.session) {
      clientsData.fetchClients();
      tasksData.fetchTasks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.session]);

  // Lazily load notes history + files only for the client currently being viewed.
  useEffect(() => {
    if (selectedClientId) {
      clientsData.fetchClientDetails(selectedClientId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId]);

  // Fetch API Health on mount
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => {
        setGeminiStatus(data.geminiConfigured ? "connected" : "not_configured");
      })
      .catch(() => setGeminiStatus("not_configured"));
  }, []);

  // Dark mode side-effect
  useEffect(() => {
    if (auth.darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [auth.darkMode]);

  const selectedClient = clientsData.clients.find((c) => c.id === selectedClientId) || null;
  const isGoogleLinked = !!auth.session?.user?.identities?.some((id) => id.provider === "google");

  const navigateTo = (view: AppView) => {
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

  if (auth.authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600 dark:text-teal-400" />
      </div>
    );
  }

  if (!auth.session) {
    return (
      <LoginScreen
        authMode={auth.authMode}
        setAuthMode={auth.setAuthMode}
        fullName={auth.fullName}
        setFullName={auth.setFullName}
        email={auth.email}
        setEmail={auth.setEmail}
        password={auth.password}
        setPassword={auth.setPassword}
        confirmPassword={auth.confirmPassword}
        setConfirmPassword={auth.setConfirmPassword}
        showPassword={auth.showPassword}
        setShowPassword={auth.setShowPassword}
        showConfirmPassword={auth.showConfirmPassword}
        setShowConfirmPassword={auth.setShowConfirmPassword}
        authError={auth.authError}
        setAuthError={auth.setAuthError}
        authSuccessMsg={auth.authSuccessMsg}
        setAuthSuccessMsg={auth.setAuthSuccessMsg}
        isSubmittingAuth={auth.isSubmittingAuth}
        handleLoginEmail={auth.handleLoginEmail}
        handleSignUpEmail={auth.handleSignUpEmail}
        handleResetPassword={auth.handleResetPassword}
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
      <main className="flex-1 p-6 md:p-8 overflow-y-auto h-screen bg-slate-50 dark:bg-zinc-950 transition-colors">
        <MobileNav currentView={currentView} onNavigate={navigateTo} />

        {/* Dynamic Client workspace (renders on client click instead of dashboard) */}
        {selectedClient ? (
          <ClientDetails
            client={selectedClient}
            allClients={clientsData.clients}
            tasks={tasksData.tasks}
            detailsLoading={clientsData.detailsLoadingId === selectedClient.id}
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

            {currentView === "reports" && (
              <Reports clients={clientsData.clients} tasks={tasksData.tasks} />
            )}

            {currentView === "settings" && (
              <SettingsView
                geminiStatus={geminiStatus}
                isGoogleLinked={isGoogleLinked}
                isLinkingGoogle={auth.isLinkingGoogle}
                onLinkGoogle={handleLinkGoogle}
                onSave={handleSaveSettings}
              />
            )}
          </div>
        )}
      </main>

      {/* NEW CLIENT DIALOG MODAL */}
      {showNewClientModal && (
        <NewClientModal
          onClose={() => setShowNewClientModal(false)}
          onAddClient={clientsData.handleAddClient}
        />
      )}

      {/* MEET BOT MODAL */}
      {showMeetBotModal && (
        <MeetBotModal
          clients={clientsData.clients}
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
          clients={clientsData.clients}
          initialClientId={selectedClientId || undefined}
          onClose={() => setShowQuickTaskModal(false)}
          onAddTask={tasksData.handleAddTask}
        />
      )}
    </div>
  );
}