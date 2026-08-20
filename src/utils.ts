import { Task, UrgencyLevel } from "./types";

export type { UrgencyLevel };

/**
 * Returns current local date in YYYY-MM-DD format (without UTC day offset issues)
 */
export function getCurrentDateStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Standardized unique ID generator
 */
export function generateId(prefix: string = "id"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Calculates or retrieves the urgency level of a task
 */
export function getTaskUrgency(task: Task): UrgencyLevel {
  if (task.urgency != null) return task.urgency;
  if (!task.deadline) return "Sem Urgência";

  const todayStr = getCurrentDateStr();
  if (task.deadline <= todayStr) {
    return "Muito Urgente";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const taskDate = new Date(task.deadline + "T00:00:00");
  const diffTime = taskDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));

  if (diffDays <= 2) {
    return "Urgente";
  }

  return "Sem Urgência";
}

/**
 * Checks if a given deadline string is overdue relative to today
 */
export function isOverdue(deadline: string, column: string): boolean {
  if (!deadline || column === "done") return false;
  return deadline < getCurrentDateStr();
}

/**
 * Checks if a given deadline is due today
 */
export function isDueToday(deadline: string): boolean {
  return Boolean(deadline) && deadline === getCurrentDateStr();
}

/**
 * Number of full days a deadline has been overdue (0 if not overdue).
 */
export function getDaysOverdue(deadline: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const taskDate = new Date(deadline + "T00:00:00");
  const diffTime = today.getTime() - taskDate.getTime();
  return Math.max(0, Math.round(diffTime / (1000 * 3600 * 24)));
}

/**
 * Whole days elapsed between a past ISO timestamp (or YYYY-MM-DD) and now.
 * Shared by dailyBriefing/nextAction/clientHealth — all three independently
 * re-derived this "days since last X" math before this was extracted.
 */
export function daysSince(dateStr: string): number {
  const today = new Date(getCurrentDateStr());
  const then = new Date(dateStr.length <= 10 ? dateStr : dateStr.slice(0, 10));
  return Math.max(0, Math.round((today.getTime() - then.getTime()) / (1000 * 3600 * 24)));
}

/**
 * Formats a date string (YYYY-MM-DD) into a nicer Brazilian format (DD/MM/AAAA)
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Formats an ISO timestamp as a short relative "time ago" label in Portuguese
 * (e.g. "há 12 min", "há 3 h", "há 2 dias"). Used to show how fresh presence
 * and activity data is next to realtime-driven UI.
 */
export function formatTimeAgo(isoDate?: string | null): string {
  if (!isoDate) return "";
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "agora mesmo";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `há ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `há ${diffDays} dia${diffDays > 1 ? "s" : ""}`;
}

/**
 * Request permission for browser notifications.
 */
export async function requestDesktopNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) {
    console.warn("Este navegador não suporta notificações de área de trabalho.");
    return "denied";
  }
  if (Notification.permission === "granted") {
    return "granted";
  }
  try {
    return await Notification.requestPermission();
  } catch (err) {
    console.warn("Permissão de notificação bloqueada pela política do ambiente/iframe:", err);
    return "denied";
  }
}

/**
 * Sends a native browser notification.
 */
export function sendWindowsNotification(title: string, options?: NotificationOptions) {
  if (!("Notification" in window)) return;
  try {
    if (Notification.permission === "granted") {
      const notification = new Notification(title, {
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        requireInteraction: true,
        ...options,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  } catch (err) {
    console.warn("Não foi possível exibir notificação nativa (restrição de ambiente/iframe):", err);
  }
}

export type NotificationSound = "none" | "soft" | "classic";

/**
 * Plays a short notification chime with the Web Audio API — no audio asset
 * to ship or host, just a couple of oscillator tones. Only works while the
 * tab is open/visible, same as the moment a native notification fires.
 */
export function playNotificationSound(sound: NotificationSound) {
  if (sound === "none") return;
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + start);
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.15, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + duration + 0.05);
    };

    if (sound === "soft") {
      playTone(660, 0, 0.18);
    } else {
      playTone(523.25, 0, 0.12);
      playTone(783.99, 0.12, 0.18);
    }

    window.setTimeout(() => void ctx.close(), 800);
  } catch (err) {
    console.warn("Não foi possível tocar o som de notificação:", err);
  }
}

/**
 * Shared urgency badge color classes (Sem Urgência / Urgente / Muito Urgente),
 * previously copy-pasted identically in the dashboard focus panel and the Kanban card.
 */
export function getUrgencyBadgeClasses(urgency: UrgencyLevel): string {
  if (urgency === "Muito Urgente") {
    return "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/30";
  }
  if (urgency === "Urgente") {
    return "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/30";
  }
  return "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30";
}

interface StatusMeta {
  emoji: string;
  label: string;
  classes: string;
}

/**
 * Shared team-status badge metadata (available/busy/in_meeting/offline),
 * previously copy-pasted identically between TeamDashboard and TeamNowWidget.
 */
export function getStatusMeta(status: string): StatusMeta {
  switch (status) {
    case "available":
      return { emoji: "🟢", label: "Disponível", classes: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40" };
    case "busy":
      return { emoji: "🔴", label: "Ocupado", classes: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 border-red-200 dark:border-red-900/40" };
    case "in_meeting":
      return { emoji: "🟣", label: "Em Reunião", classes: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200 dark:border-purple-900/40" };
    default:
      return { emoji: "⚪", label: "Offline", classes: "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-400 border-slate-200 dark:border-zinc-700" };
  }
}


