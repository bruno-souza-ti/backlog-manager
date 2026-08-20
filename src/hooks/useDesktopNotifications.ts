import { useEffect, useState } from "react";
import { Client, Task } from "../types";
import {
  getCurrentDateStr,
  getTaskUrgency,
  isOverdue,
  isDueToday,
  getDaysOverdue,
  formatDate,
  requestDesktopNotificationPermission,
  sendWindowsNotification,
  playNotificationSound,
  type NotificationSound,
} from "../utils";

const NOTIFICATIONS_ENABLED_KEY = "backlog-manager:notifications-enabled";
const NOTIFICATIONS_SCOPE_KEY = "backlog-manager:notifications-scope";
const NOTIFICATIONS_OVERDUE_KEY = "backlog-manager:notifications-trigger-overdue";
const NOTIFICATIONS_DUE_TODAY_KEY = "backlog-manager:notifications-trigger-due-today";
const NOTIFICATIONS_SOUND_KEY = "backlog-manager:notifications-sound";

export type NotificationScope = "mine" | "all";

function readBoolPref(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const saved = window.localStorage.getItem(key);
  return saved === null ? fallback : saved === "true";
}

/** Desktop notification permission + preferences (scope, triggers, sound) + the "notify once per task/urgency change" tracker. */
export function useDesktopNotifications(tasks: Task[], clients: Client[], currentUserId?: string) {
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "default";
  });
  // App-level on/off switch, layered on top of the browser permission (which
  // JS cannot revoke once granted — only the user can do that from browser
  // settings). This lets the in-app toggle in Configurações actually turn
  // notifications off without touching the underlying browser permission.
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => readBoolPref(NOTIFICATIONS_ENABLED_KEY, true));
  const [scope, setScope] = useState<NotificationScope>(() => {
    if (typeof window === "undefined") return "mine";
    return window.localStorage.getItem(NOTIFICATIONS_SCOPE_KEY) === "all" ? "all" : "mine";
  });
  const [notifyOverdue, setNotifyOverdue] = useState<boolean>(() => readBoolPref(NOTIFICATIONS_OVERDUE_KEY, true));
  const [notifyDueToday, setNotifyDueToday] = useState<boolean>(() => readBoolPref(NOTIFICATIONS_DUE_TODAY_KEY, true));
  const [sound, setSound] = useState<NotificationSound>(() => {
    if (typeof window === "undefined") return "soft";
    const saved = window.localStorage.getItem(NOTIFICATIONS_SOUND_KEY);
    return saved === "none" || saved === "soft" || saved === "classic" ? saved : "soft";
  });
  const [notifiedTaskKeys, setNotifiedTaskKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    window.localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, String(notificationsEnabled));
  }, [notificationsEnabled]);
  useEffect(() => {
    window.localStorage.setItem(NOTIFICATIONS_SCOPE_KEY, scope);
  }, [scope]);
  useEffect(() => {
    window.localStorage.setItem(NOTIFICATIONS_OVERDUE_KEY, String(notifyOverdue));
  }, [notifyOverdue]);
  useEffect(() => {
    window.localStorage.setItem(NOTIFICATIONS_DUE_TODAY_KEY, String(notifyDueToday));
  }, [notifyDueToday]);
  useEffect(() => {
    window.localStorage.setItem(NOTIFICATIONS_SOUND_KEY, sound);
  }, [sound]);

  const handleToggleNotifications = async (enabled: boolean) => {
    if (!enabled) {
      setNotificationsEnabled(false);
      return;
    }
    if (notifPermission !== "granted") {
      const perm = await requestDesktopNotificationPermission();
      setNotifPermission(perm);
      if (perm !== "granted") {
        if (perm === "denied") {
          alert("As notificações estão bloqueadas no navegador. Para ativar, permita as notificações nas configurações do seu navegador.");
        }
        return;
      }
      sendWindowsNotification("Notificações Ativadas", {
        body: "Você será avisado quando uma tarefa atrasar ou o prazo estiver próximo.",
      });
    }
    setNotificationsEnabled(true);
  };

  const handleTestNotification = () => {
    sendWindowsNotification("Teste de Notificação", {
      body: "As notificações de prazo estão configuradas corretamente.",
    });
    playNotificationSound(sound);
  };

  // Automated notification checker for tasks nearing deadline
  useEffect(() => {
    if (notifPermission !== "granted" || !notificationsEnabled) return;

    const scopedTasks = tasks.filter((t) => {
      if (t.column === "done") return false;
      if (scope === "mine" && currentUserId && t.assigneeId !== currentUserId) return false;
      return true;
    });

    scopedTasks.forEach((task) => {
      const overdue = isOverdue(task.deadline, task.column);
      const dueToday = isDueToday(task.deadline);
      if (!overdue && !dueToday) return;
      if (overdue && !notifyOverdue) return;
      if (!overdue && dueToday && !notifyDueToday) return;

      const urgency = getTaskUrgency(task);
      const notifKey = `${task.id}:${urgency}`;

      if (!notifiedTaskKeys.has(notifKey)) {
        const client = clients.find((c) => c.id === task.clientId);
        const clientName = client ? client.name : "Backlog Geral";

        let title = `Prazo próximo: ${clientName}`;
        let bodyStr = `"${task.title}" vence em ${formatDate(task.deadline)}.`;

        if (overdue) {
          const daysOverdue = getDaysOverdue(task.deadline);
          title = `Tarefa atrasada: ${clientName}`;
          bodyStr = `"${task.title}" está atrasada há ${daysOverdue} dia${daysOverdue !== 1 ? "s" : ""} (venceu em ${formatDate(task.deadline)}).`;
        } else if (dueToday) {
          title = `Vence hoje: ${clientName}`;
          bodyStr = `"${task.title}" precisa ser concluída até hoje.`;
        }

        sendWindowsNotification(title, {
          body: bodyStr,
          tag: `task-${task.id}`,
        });
        playNotificationSound(sound);

        setNotifiedTaskKeys((prev) => new Set(prev).add(notifKey));
      }
    });
  }, [tasks, notifiedTaskKeys, notifPermission, notificationsEnabled, clients, scope, currentUserId, notifyOverdue, notifyDueToday, sound]);

  return {
    notifPermission,
    notificationsEnabled,
    handleToggleNotifications,
    handleTestNotification,
    scope,
    setScope,
    notifyOverdue,
    setNotifyOverdue,
    notifyDueToday,
    setNotifyDueToday,
    sound,
    setSound,
  };
}
