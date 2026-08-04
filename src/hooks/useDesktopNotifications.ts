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
} from "../utils";

/** Desktop notification permission + the "notify once per task/urgency change" tracker. */
export function useDesktopNotifications(tasks: Task[], clients: Client[]) {
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "default";
  });
  const [notifiedTaskKeys, setNotifiedTaskKeys] = useState<Set<string>>(new Set());

  const handleEnableNotifications = async () => {
    const perm = await requestDesktopNotificationPermission();
    setNotifPermission(perm);
    if (perm === "granted") {
      sendWindowsNotification("Notificações Ativadas", {
        body: "Você será avisado quando uma tarefa atrasar ou o prazo estiver próximo.",
      });
    } else if (perm === "denied") {
      alert("As notificações estão bloqueadas no navegador. Para ativar, permita as notificações nas configurações do seu navegador.");
    }
  };

  const handleTestNotification = () => {
    if (notifPermission !== "granted") {
      handleEnableNotifications();
    } else {
      sendWindowsNotification("Teste de Notificação", {
        body: "As notificações de prazo estão configuradas corretamente.",
      });
    }
  };

  // Automated notification checker for tasks nearing deadline
  useEffect(() => {
    if (notifPermission !== "granted") return;

    const todayStr = getCurrentDateStr();
    const pendingUrgentTasks = tasks.filter(
      (t) => t.column !== "done" && (t.deadline <= todayStr || getTaskUrgency(t) !== "Sem Urgência")
    );

    pendingUrgentTasks.forEach((task) => {
      const urgency = getTaskUrgency(task);
      const notifKey = `${task.id}:${urgency}`;

      if (!notifiedTaskKeys.has(notifKey)) {
        const client = clients.find((c) => c.id === task.clientId);
        const overdue = isOverdue(task.deadline, task.column);
        const dueToday = isDueToday(task.deadline);
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

        setNotifiedTaskKeys((prev) => new Set(prev).add(notifKey));
      }
    });
  }, [tasks, notifiedTaskKeys, notifPermission, clients]);

  return { notifPermission, handleEnableNotifications, handleTestNotification };
}
