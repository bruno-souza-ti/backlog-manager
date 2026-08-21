export interface NotesHistoryItem {
  id: string;
  date: string;
  content: string;
  /** ISO timestamp of the last edit, if any — absent means it's never been edited since archiving. */
  updatedAt?: string | null;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  meetLink: string;
  attendees?: string[];
  clientId?: string;
}

export interface MeetingTranscriptEntry {
  id: string;
  timestamp: string;
  speaker: string;
  text: string;
}

export interface ClientFile {
  id: string;
  name: string;
  size?: string;
  uploadDate: string;
  extractedContent: string;
}

export type ClientLifecycleStatus = "active" | "frozen";
export type ClientLifecycleAction = ClientLifecycleStatus | "deleted" | "restore";

export interface Client {
  id: string;
  name: string;
  logoColor: string; // Tailwind class for background
  /** Uploaded logo image URL — takes precedence over logoColor's gradient-initials fallback when set. */
  logoUrl?: string | null;
  health?: "critical" | "warning" | "stable"; // Computed automatically or optional
  notes: string;
  notesHistory: NotesHistoryItem[];
  files: ClientFile[];
  status: ClientLifecycleStatus;
  deletedAt: string | null;
}

export type NewClientInput = Pick<Client, "name" | "logoColor" | "notes">;
export type ClientUpdate = Partial<Pick<Client, "name" | "logoColor" | "logoUrl">>;

export type UrgencyLevel = "Sem Urgência" | "Urgente" | "Muito Urgente";

export interface Task {
  id: string;
  clientId?: string;
  title: string;
  description: string;
  deadline: string;
  column: "todo" | "doing" | "blocked" | "done";
  /** null means the urgency is calculated from the deadline. */
  urgency?: UrgencyLevel | null;
  assigneeId?: string;
  sprintId?: string;
  createdAt?: string;
  completedAt?: string;
  columnChangedAt?: string;
}

export type TaskUpdate = Partial<Pick<Task, "clientId" | "title" | "description" | "deadline" | "column" | "urgency" | "assigneeId" | "sprintId">>;

export interface Sprint {
  id: string;
  name: string;
  goal: string | null;
  startDate: string;
  endDate: string;
  createdBy?: string;
  createdAt?: string;
}

export type NewSprintInput = Pick<Sprint, "name" | "goal" | "startDate" | "endDate">;

export interface TimeEntry {
  id: string;
  taskId: string;
  userId: string;
  minutes: number;
  note: string;
  entryDate: string;
  createdAt?: string;
  updatedAt?: string;
}

export type NewTimeEntryInput = {
  taskId: string;
  minutes: number;
  note?: string;
};

/** Deliberately excludes taskId/entryDate — rewriting which day/task an entry counts toward would make the daily total untrustworthy. */
export type TimeEntryUpdate = {
  minutes?: number;
  note?: string;
};

export interface Meeting {
  id: string;
  clientId: string;
  createdBy: string;
  title: string;
  occurredAt: string;
  rawTranscript: string;
  generatedNotes: string;
}

export type ProfileStatus = "available" | "busy" | "in_meeting" | "offline";
export type ProfileRole = "owner" | "admin" | "member";

/** Mirrors the `profiles` table — one row per agency team member. */
export interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_color?: string;
  avatar_url?: string | null;
  role: ProfileRole;
  is_active: boolean;
  status: ProfileStatus;
  current_client_id?: string | null;
  status_updated_at?: string;
  /** Last heartbeat from an active session — the authoritative online/offline signal. */
  last_seen_at?: string | null;
  /** Self-reported contracted work minutes per day (default 480 = 8h) — the target for the daily time-tracking widget. */
  expected_daily_minutes?: number;
  created_at?: string;
  updated_at?: string;
}

export type TeamInvitationStatus = "pending" | "active" | "inactive";

/** Sanitized administrative projection returned only by the protected API. */
export interface TeamMemberAdmin {
  id: string;
  fullName: string;
  email: string;
  role: ProfileRole;
  isActive: boolean;
  invitationStatus: TeamInvitationStatus;
  invitedAt: string | null;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
}

/** Shape returned by the AI task-extraction endpoints before being persisted as a Task. */
export interface AIExtractedTaskDTO {
  title?: string;
  description?: string;
  deadline?: string;
  column?: Task["column"];
  urgency?: UrgencyLevel;
}
