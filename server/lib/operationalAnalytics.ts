import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "./apiErrors.js";

const MAX_LIST_ITEMS = 25;
const DAY_MS = 86_400_000;

type ClientStatus = "active" | "inactive" | "frozen";
export type ClientLifecycle = ClientStatus | "deleted";

interface ClientRow {
  id: string;
  name: string;
  status: ClientStatus;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface TaskRow {
  id: string;
  client_id: string | null;
  title: string;
  deadline: string | null;
  column: "todo" | "doing" | "blocked" | "done";
  urgency: string | null;
  assignee_id: string | null;
  created_at: string;
  column_changed_at: string;
  completed_at: string | null;
}

interface ProfileRow {
  id: string;
  full_name: string;
  status: string;
  current_client_id: string | null;
}

interface HealthRow {
  client_id: string;
  level: "stable" | "warning" | "critical";
  score: number;
  reasons: unknown;
  evaluated_at: string;
}

interface ClientTimestampRow {
  client_id: string | null;
  timestamp: string;
}

export interface OperationalTaskItem {
  title: string;
  client: string | null;
  deadline: string | null;
  column: TaskRow["column"];
  assignee: string | null;
}

export interface OperationalClientItem {
  name: string;
  lifecycle: ClientLifecycle;
  health: HealthRow["level"] | "unknown";
  healthScore: number | null;
  healthReasons: string[];
  lastActivityAt: string | null;
  overdueTasks: number;
  blockedTasks: number;
  activeTasks: number;
  completedTasks: number;
}

export interface OperationalAnalyticsContext {
  schemaVersion: "1";
  asOf: string;
  timeZone: "America/Sao_Paulo";
  definitions: {
    activeClient: string;
    deletedClient: string;
    overdueTask: string;
    activeTask: string;
  };
  summary: {
    clientRecords: number;
    activeClients: number;
    inactiveClients: number;
    frozenClients: number;
    deletedClients: number;
    activeTasks: number;
    completedTasks: number;
    overdueTasks: number;
    blockedTasks: number;
    dueToday: number;
    dueNext7Days: number;
    unassignedActiveTasks: number;
  };
  clients: OperationalClientItem[];
  team: Array<{
    name: string;
    status: string;
    currentClient: string | null;
    assignedActiveTasks: number;
  }>;
  taskLists: {
    overdue: OperationalTaskItem[];
    blocked: OperationalTaskItem[];
    dueToday: OperationalTaskItem[];
    dueNext7Days: OperationalTaskItem[];
    listsTruncatedAt: number;
  };
}

export interface OperationalAnalyticsRows {
  clients: ClientRow[];
  tasks: TaskRow[];
  profiles: ProfileRow[];
  health: HealthRow[];
  meetings: ClientTimestampRow[];
  notes: ClientTimestampRow[];
  files: ClientTimestampRow[];
  activities: ClientTimestampRow[];
}

function lifecycleOf(client: ClientRow): ClientLifecycle {
  return client.deleted_at ? "deleted" : client.status;
}

function dateOnlyInSaoPaulo(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDays(date: Date, days: number): string {
  return dateOnlyInSaoPaulo(new Date(date.getTime() + days * DAY_MS));
}

function normalizedReasons(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").slice(0, 10);
}

function latestTimestamp(values: Array<string | null | undefined>): string | null {
  const valid = values.filter((value): value is string => typeof value === "string" && value.length > 0);
  return valid.length > 0 ? valid.sort().at(-1)! : null;
}

function isOverdue(task: TaskRow, today: string): boolean {
  return task.column !== "done" && Boolean(task.deadline) && task.deadline! < today;
}

function toTaskItem(
  task: TaskRow,
  clientsById: Map<string, ClientRow>,
  profilesById: Map<string, ProfileRow>,
): OperationalTaskItem {
  return {
    title: task.title,
    client: task.client_id ? clientsById.get(task.client_id)?.name ?? null : null,
    deadline: task.deadline,
    column: task.column,
    assignee: task.assignee_id ? profilesById.get(task.assignee_id)?.full_name ?? null : null,
  };
}

export function buildOperationalAnalyticsContext(
  rows: OperationalAnalyticsRows,
  now: Date = new Date(),
): OperationalAnalyticsContext {
  const today = dateOnlyInSaoPaulo(now);
  const next7Days = addDays(now, 7);
  const clientsById = new Map(rows.clients.map((client) => [client.id, client]));
  const profilesById = new Map(rows.profiles.map((profile) => [profile.id, profile]));
  const healthByClientId = new Map(rows.health.map((health) => [health.client_id, health]));

  const operationalClientIds = new Set(
    rows.clients
      .filter((client) => lifecycleOf(client) === "active")
      .map((client) => client.id),
  );
  const operationalTasks = rows.tasks.filter(
    (task) => task.client_id === null || operationalClientIds.has(task.client_id),
  );
  const tasksByClient = new Map<string, TaskRow[]>();
  for (const task of rows.tasks) {
    if (!task.client_id) continue;
    const bucket = tasksByClient.get(task.client_id) ?? [];
    bucket.push(task);
    tasksByClient.set(task.client_id, bucket);
  }

  const activityByClient = new Map<string, string[]>();
  const addActivity = (row: ClientTimestampRow) => {
    if (!row.client_id) return;
    const bucket = activityByClient.get(row.client_id) ?? [];
    bucket.push(row.timestamp);
    activityByClient.set(row.client_id, bucket);
  };
  rows.meetings.forEach(addActivity);
  rows.notes.forEach(addActivity);
  rows.files.forEach(addActivity);
  rows.activities.forEach(addActivity);
  rows.tasks.forEach((task) => {
    if (!task.client_id) return;
    addActivity({ client_id: task.client_id, timestamp: task.column_changed_at || task.created_at });
  });

  const clients = rows.clients.map<OperationalClientItem>((client) => {
    const clientTasks = tasksByClient.get(client.id) ?? [];
    const health = healthByClientId.get(client.id);
    return {
      name: client.name,
      lifecycle: lifecycleOf(client),
      health: health?.level ?? "unknown",
      healthScore: health?.score ?? null,
      healthReasons: normalizedReasons(health?.reasons),
      lastActivityAt: latestTimestamp([client.updated_at, ...(activityByClient.get(client.id) ?? [])]),
      overdueTasks: clientTasks.filter((task) => isOverdue(task, today)).length,
      blockedTasks: clientTasks.filter((task) => task.column === "blocked").length,
      activeTasks: clientTasks.filter((task) => task.column !== "done").length,
      completedTasks: clientTasks.filter((task) => task.column === "done").length,
    };
  });

  const activeTasks = operationalTasks.filter((task) => task.column !== "done");
  const completedTasks = operationalTasks.filter((task) => task.column === "done");
  const overdueTasks = operationalTasks.filter((task) => isOverdue(task, today));
  const blockedTasks = operationalTasks.filter((task) => task.column === "blocked");
  const dueTodayTasks = activeTasks.filter((task) => task.deadline === today);
  const dueNext7DaysTasks = activeTasks.filter(
    (task) => Boolean(task.deadline) && task.deadline! >= today && task.deadline! <= next7Days,
  );

  const workload = new Map<string, number>();
  for (const task of activeTasks) {
    if (task.assignee_id) workload.set(task.assignee_id, (workload.get(task.assignee_id) ?? 0) + 1);
  }

  return {
    schemaVersion: "1",
    asOf: now.toISOString(),
    timeZone: "America/Sao_Paulo",
    definitions: {
      activeClient: "status = active e deleted_at ausente",
      deletedClient: "deleted_at preenchido, independentemente do status armazenado",
      overdueTask: "deadline anterior à data local e coluna diferente de done",
      activeTask: "coluna diferente de done e cliente ativo/não removido, ou tarefa do backlog geral",
    },
    summary: {
      clientRecords: rows.clients.length,
      activeClients: clients.filter((client) => client.lifecycle === "active").length,
      inactiveClients: clients.filter((client) => client.lifecycle === "inactive").length,
      frozenClients: clients.filter((client) => client.lifecycle === "frozen").length,
      deletedClients: clients.filter((client) => client.lifecycle === "deleted").length,
      activeTasks: activeTasks.length,
      completedTasks: completedTasks.length,
      overdueTasks: overdueTasks.length,
      blockedTasks: blockedTasks.length,
      dueToday: dueTodayTasks.length,
      dueNext7Days: dueNext7DaysTasks.length,
      unassignedActiveTasks: activeTasks.filter((task) => !task.assignee_id).length,
    },
    clients,
    team: rows.profiles.map((profile) => ({
      name: profile.full_name,
      status: profile.status,
      currentClient: profile.current_client_id
        ? clientsById.get(profile.current_client_id)?.name ?? null
        : null,
      assignedActiveTasks: workload.get(profile.id) ?? 0,
    })),
    taskLists: {
      overdue: overdueTasks.slice(0, MAX_LIST_ITEMS).map((task) => toTaskItem(task, clientsById, profilesById)),
      blocked: blockedTasks.slice(0, MAX_LIST_ITEMS).map((task) => toTaskItem(task, clientsById, profilesById)),
      dueToday: dueTodayTasks.slice(0, MAX_LIST_ITEMS).map((task) => toTaskItem(task, clientsById, profilesById)),
      dueNext7Days: dueNext7DaysTasks.slice(0, MAX_LIST_ITEMS).map((task) => toTaskItem(task, clientsById, profilesById)),
      listsTruncatedAt: MAX_LIST_ITEMS,
    },
  };
}

function assertQuery<T>(
  label: string,
  result: { data: T[] | null; error: { code?: string } | null },
): T[] {
  if (result.error) {
    console.error("operational_context_query_failed", { query: label, reason: result.error.code ?? "unknown" });
    throw new ApiError(503, "OPERATIONAL_CONTEXT_UNAVAILABLE", "Não foi possível consultar os dados operacionais.");
  }
  return result.data ?? [];
}

export async function loadOperationalAnalyticsContext(
  client: SupabaseClient,
  now: Date = new Date(),
): Promise<OperationalAnalyticsContext> {
  const [clients, tasks, profiles, health, meetings, notes, files, activities] = await Promise.all([
    client.from("clients").select("id, name, status, deleted_at, created_at, updated_at").order("name"),
    client.from("tasks").select("id, client_id, title, deadline, column, urgency, assignee_id, created_at, column_changed_at, completed_at"),
    client.from("profiles").select("id, full_name, status, current_client_id").eq("is_active", true).order("full_name"),
    client.from("client_health_state").select("client_id, level, score, reasons, evaluated_at"),
    client.from("meetings").select("client_id, occurred_at").not("client_id", "is", null),
    client.from("client_notes_history").select("client_id, created_at"),
    client.from("client_files").select("client_id, uploaded_at"),
    client.from("activity_log").select("client_id, created_at").not("client_id", "is", null),
  ]);

  return buildOperationalAnalyticsContext({
    clients: assertQuery<ClientRow>("clients", clients),
    tasks: assertQuery<TaskRow>("tasks", tasks),
    profiles: assertQuery<ProfileRow>("profiles", profiles),
    health: assertQuery<HealthRow>("client_health_state", health),
    meetings: assertQuery<{ client_id: string | null; occurred_at: string }>("meetings", meetings)
      .map((row) => ({ client_id: row.client_id, timestamp: row.occurred_at })),
    notes: assertQuery<{ client_id: string | null; created_at: string }>("client_notes_history", notes)
      .map((row) => ({ client_id: row.client_id, timestamp: row.created_at })),
    files: assertQuery<{ client_id: string | null; uploaded_at: string }>("client_files", files)
      .map((row) => ({ client_id: row.client_id, timestamp: row.uploaded_at })),
    activities: assertQuery<{ client_id: string | null; created_at: string }>("activity_log", activities)
      .map((row) => ({ client_id: row.client_id, timestamp: row.created_at })),
  }, now);
}

function normalizeQuestion(question: string): string {
  return question
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}

function formatClientNames(clients: OperationalClientItem[]): string {
  return clients.length > 0 ? clients.map((client) => client.name).join(", ") : "nenhum";
}

function formatTaskList(label: string, tasks: OperationalTaskItem[]): string {
  if (tasks.length === 0) return `Não há ${label} nos dados operacionais atuais.`;
  return tasks.map((task) => {
    const context = [task.client ?? "Backlog Geral", task.deadline ? `prazo ${task.deadline}` : null, task.assignee]
      .filter(Boolean)
      .join(" · ");
    return `- ${task.title} (${context})`;
  }).join("\n");
}

function counted(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function resolveDeterministicAnalyticsAnswer(
  question: string,
  context: OperationalAnalyticsContext,
): string | null {
  const normalized = normalizeQuestion(question);
  const countAsked = /\bquant(os|as|o|a)\b/.test(normalized);
  const clientsAsked = /\bclientes?\b/.test(normalized);

  const clientIntent: Array<{ pattern: RegExp; lifecycle: ClientLifecycle; label: string; count: number }> = [
    { pattern: /\b(removidos?|excluidos?|deletados?)\b/, lifecycle: "deleted", label: "removidos", count: context.summary.deletedClients },
    { pattern: /\bcongelados?\b/, lifecycle: "frozen", label: "congelados", count: context.summary.frozenClients },
    { pattern: /\binativos?\b/, lifecycle: "inactive", label: "inativos", count: context.summary.inactiveClients },
    { pattern: /\bativos?\b/, lifecycle: "active", label: "ativos", count: context.summary.activeClients },
  ];
  const matchedClientIntent = clientsAsked
    ? clientIntent.find((intent) => intent.pattern.test(normalized))
    : undefined;
  if (matchedClientIntent) {
    const matchingClients = context.clients.filter((client) => client.lifecycle === matchedClientIntent.lifecycle);
    if (countAsked) {
      return `Existem ${matchedClientIntent.count} clientes ${matchedClientIntent.label} em ${context.asOf.slice(0, 10)}: ${formatClientNames(matchingClients)}.`;
    }
    if (/\b(quais|liste|mostrar?|mostre)\b/.test(normalized)) {
      return `Clientes ${matchedClientIntent.label}: ${formatClientNames(matchingClients)}.`;
    }
  }

  if (/\b(tarefas?|entregas?)\b/.test(normalized) && /\bbloquead/.test(normalized)) {
    return `Há ${counted(context.summary.blockedTasks, "tarefa bloqueada", "tarefas bloqueadas")}.\n${formatTaskList("tarefas bloqueadas", context.taskLists.blocked)}`;
  }
  if (/\b(tarefas?|entregas?|projetos?)\b/.test(normalized) && /\b(atrasad|vencid)/.test(normalized)) {
    return `Há ${counted(context.summary.overdueTasks, "tarefa atrasada", "tarefas atrasadas")}.\n${formatTaskList("tarefas atrasadas", context.taskLists.overdue)}`;
  }
  if (/\b(tarefas?|entregas?)\b/.test(normalized) && /\b(hoje)\b/.test(normalized) && /\b(venc|prazo|entreg)/.test(normalized)) {
    return `Há ${counted(context.summary.dueToday, "entrega com prazo hoje", "entregas com prazo hoje")}.\n${formatTaskList("entregas com prazo hoje", context.taskLists.dueToday)}`;
  }
  if (/\b(tarefas?|entregas?)\b/.test(normalized) && /\b(semana|7 dias)\b/.test(normalized)) {
    return `Há ${counted(context.summary.dueNext7Days, "entrega", "entregas")} com prazo entre hoje e os próximos 7 dias.\n${formatTaskList("entregas nos próximos 7 dias", context.taskLists.dueNext7Days)}`;
  }

  return null;
}

export function buildOperationalAnalyticsPrompt(
  question: string,
  context: OperationalAnalyticsContext,
): string {
  return `Você é o analista operacional da Geniality IA.

Regras obrigatórias:
- Responda em português brasileiro, de forma direta e verificável.
- Use exclusivamente o contexto JSON fornecido.
- As contagens em summary são autoritativas e foram calculadas pelo backend; nunca as recalcule a partir das listas.
- Respeite as definições de lifecycle. Um cliente deleted nunca é active, mesmo que outro campo histórico indique active.
- Não invente causas, responsáveis, prazos ou relações ausentes.
- Quando os dados forem insuficientes, diga explicitamente que não há evidência suficiente.
- Diferencie fatos observados de recomendações.

Contexto operacional autorizado:
${JSON.stringify(context)}

Pergunta: ${question}`;
}
