import type { Profile, ProfileStatus, Task } from "../types";

/** How often the client pings the heartbeat RPC while the tab is visible. */
export const HEARTBEAT_INTERVAL_MS = 60_000;
/** A session counts as online as long as its last heartbeat is within this window (a couple of missed beats). */
const ONLINE_THRESHOLD_MS = HEARTBEAT_INTERVAL_MS * 2.5;

/** True when the profile has heartbeated recently enough to be considered an active session. */
export function isSessionOnline(lastSeenAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!lastSeenAt) return false;
  const lastSeenMs = new Date(lastSeenAt).getTime();
  if (Number.isNaN(lastSeenMs)) return false;
  return now - lastSeenMs <= ONLINE_THRESHOLD_MS;
}

/**
 * The real, automatically-derived presence status — replaces trusting the
 * raw `status` column, which used to sit at "available" forever once a
 * browser tab was closed. Precedence:
 *   1. In reunião — set explicitly by the app (Note Taker session), so it's
 *      already a genuine signal and always wins while it's set.
 *   2. Offline — no recent heartbeat, regardless of what `status` says.
 *   3. Ocupado — has at least one task in "Fazendo" assigned to them.
 *   4. Disponível — online, nothing else going on.
 */
export function computeDisplayStatus(
  profile: Pick<Profile, "status" | "last_seen_at">,
  hasDoingTask: boolean,
  now: number = Date.now()
): ProfileStatus {
  if (profile.status === "in_meeting") return "in_meeting";
  if (!isSessionOnline(profile.last_seen_at, now)) return "offline";
  if (hasDoingTask) return "busy";
  return "available";
}

/** Convenience for callers that already have the full task list and just need one profile's flag. */
export function hasTaskInDoing(tasks: Task[], profileId: string): boolean {
  return tasks.some((t) => t.assigneeId === profileId && t.column === "doing");
}
