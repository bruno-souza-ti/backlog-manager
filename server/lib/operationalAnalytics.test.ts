import { describe, expect, it } from "vitest";
import {
  buildOperationalAnalyticsContext,
  buildOperationalAnalyticsPrompt,
  resolveDeterministicAnalyticsAnswer,
  type OperationalAnalyticsRows,
} from "./operationalAnalytics";

const NOW = new Date("2026-08-17T15:00:00.000Z");

function fixtureRows(): OperationalAnalyticsRows {
  const baseClient = {
    status: "active" as const,
    deleted_at: null,
    created_at: "2026-01-01T12:00:00.000Z",
    updated_at: "2026-08-16T12:00:00.000Z",
  };
  return {
    clients: [
      { ...baseClient, id: "client-1", name: "AKROS" },
      { ...baseClient, id: "client-2", name: "Remax" },
      { ...baseClient, id: "client-3", name: "Samfer" },
      { ...baseClient, id: "client-4", name: "Sellenium360" },
      {
        ...baseClient,
        id: "client-deleted",
        name: "teste",
        status: "active",
        deleted_at: "2026-08-11T14:17:26.000Z",
      },
    ],
    tasks: [
      {
        id: "task-blocked",
        client_id: "client-1",
        title: "Liberar integração",
        deadline: "2026-08-17",
        column: "blocked",
        urgency: "Urgente",
        assignee_id: "user-1",
        created_at: "2026-08-10T12:00:00.000Z",
        column_changed_at: "2026-08-16T12:00:00.000Z",
        completed_at: null,
      },
      {
        id: "task-deleted-client",
        client_id: "client-deleted",
        title: "Tarefa legada removida",
        deadline: "2026-08-01",
        column: "todo",
        urgency: null,
        assignee_id: null,
        created_at: "2026-07-01T12:00:00.000Z",
        column_changed_at: "2026-07-01T12:00:00.000Z",
        completed_at: null,
      },
      {
        id: "task-general",
        client_id: null,
        title: "Planejar operação",
        deadline: "2026-08-20",
        column: "todo",
        urgency: null,
        assignee_id: null,
        created_at: "2026-08-15T12:00:00.000Z",
        column_changed_at: "2026-08-15T12:00:00.000Z",
        completed_at: null,
      },
    ],
    profiles: [{ id: "user-1", full_name: "Bruno", status: "available", current_client_id: "client-1" }],
    health: [{ client_id: "client-1", level: "warning", score: 35, reasons: ["Tarefa bloqueada"], evaluated_at: "2026-08-17T12:00:00.000Z" }],
    meetings: [{ client_id: "client-1", timestamp: "2026-08-14T12:00:00.000Z" }],
    notes: [],
    files: [],
    activities: [{ client_id: "client-1", timestamp: "2026-08-17T11:00:00.000Z" }],
  };
}

describe("authoritative operational analytics", () => {
  it("gives deleted_at precedence and excludes deleted-client tasks from operational totals", () => {
    const context = buildOperationalAnalyticsContext(fixtureRows(), NOW);

    expect(context.summary).toMatchObject({
      clientRecords: 5,
      activeClients: 4,
      deletedClients: 1,
      activeTasks: 2,
      blockedTasks: 1,
      overdueTasks: 0,
      dueToday: 1,
      dueNext7Days: 2,
    });
    expect(context.clients.find((client) => client.name === "teste")?.lifecycle).toBe("deleted");
    expect(context.taskLists.overdue).toEqual([]);
  });

  it("answers active-client counts deterministically from backend totals", () => {
    const context = buildOperationalAnalyticsContext(fixtureRows(), NOW);

    const answer = resolveDeterministicAnalyticsAnswer(
      "Quantos clientes ativos existem atualmente?",
      context,
    );

    expect(answer).toContain("Existem 4 clientes ativos");
    expect(answer).toContain("AKROS, Remax, Samfer, Sellenium360");
    expect(answer).not.toContain("teste");
  });

  it("lists cancelled clients separately from active ones", () => {
    const context = buildOperationalAnalyticsContext(fixtureRows(), NOW);

    expect(resolveDeterministicAnalyticsAnswer("Quais clientes foram cancelados?", context))
      .toBe("Clientes cancelados: teste.");
  });

  it("returns factual blocked-task lists without delegating the count to a model", () => {
    const context = buildOperationalAnalyticsContext(fixtureRows(), NOW);
    const answer = resolveDeterministicAnalyticsAnswer("Quais tarefas estão bloqueadas?", context);

    expect(answer).toContain("Há 1 tarefa bloqueada");
    expect(answer).toContain("Liberar integração (AKROS · prazo 2026-08-17 · Bruno)");
  });

  it("marks summary counts as authoritative in the generative prompt", () => {
    const context = buildOperationalAnalyticsContext(fixtureRows(), NOW);
    const prompt = buildOperationalAnalyticsPrompt("Qual cliente apresenta maior risco?", context);

    expect(prompt).toContain("As contagens em summary são autoritativas");
    expect(prompt).toContain("Um cliente deleted nunca é active");
    expect(prompt).toContain('"activeClients":4');
    expect(prompt).toContain('"deletedClients":1');
    expect(prompt).not.toContain('"name":"teste"');
  });

  it("removes deleted client names from the generative context", () => {
    const rows = fixtureRows();
    rows.profiles[0].current_client_id = "client-deleted";
    const context = buildOperationalAnalyticsContext(rows, NOW);
    const prompt = buildOperationalAnalyticsPrompt("Qual cliente apresenta maior risco?", context);

    expect(context.clients.some((client) => client.name === "teste")).toBe(true);
    expect(prompt).not.toContain("teste");
    expect(prompt).toContain('"currentClient":null');
  });
});
