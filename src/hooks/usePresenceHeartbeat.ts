import { useEffect } from "react";
import { sendHeartbeat } from "../lib/profilePresence";
import { HEARTBEAT_INTERVAL_MS } from "../lib/presence";

/**
 * Keeps this session's last_seen_at fresh while the tab is open and visible —
 * the real signal behind the "Offline" status (see lib/presence.ts). Pings
 * immediately on mount/focus and then on a fixed interval; a hidden tab (the
 * user switched away, minimized, or the OS suspended it) stops pinging, so
 * the session naturally goes stale and reads as offline elsewhere.
 */
export function usePresenceHeartbeat(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;

    const ping = () => {
      if (document.visibilityState !== "visible") return;
      void sendHeartbeat();
    };

    ping();
    const intervalId = window.setInterval(ping, HEARTBEAT_INTERVAL_MS);
    document.addEventListener("visibilitychange", ping);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", ping);
    };
  }, [userId]);
}
