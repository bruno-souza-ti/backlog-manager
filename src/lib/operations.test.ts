import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client, Task } from "../types";
import { computeDailyBriefing } from "./dailyBriefing";
import { computeNextAction } from "./nextAction";

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: `Tarefa ${id}`,
    description: "",
    deadline: "2026-08-20",
    column: "todo",
    createdAt: "2026-08-05T10:00:00Z",
    ...overrides,
  };
}

function client(id: string): Client {
  return {
    id,
    name: `Cliente ${id}`,
    logoColor: "bg-blue-500",
    notes: "",
    notesHistory: [],
    files: [],
    status: "active",
    deletedAt: null,
  };
}

describe("computeNextAction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 5, 12, 0, 0));
  });
  afterEach(() => vi.useRealTimers());

  it("prioritizes overdue, blocked and due-today work in that order", () => {
    const tasks = [
      task("due", { deadline: "2026-08-05" }),
      task("blocked", { column: "blocked" }),
      task("overdue", { deadline: "2026-08-01" }),
    ];
    expect(computeNextAction(tasks, [], []).type).toBe("overdue");
    expect(computeNextAction(tasks.slice(0, 2), [], []).type).toBe("blocked");
    expect(computeNextAction(tasks.slice(0, 1), [], []).type).toBe("due_today");
  });

  it("flags an inactive client and a brand-new client", () => {
    expect(computeNextAction([], [{ id: "note", date: "2026-07-01", content: "Nota" }], []).type).toBe("no_activity");
    expect(computeNextAction([], [], []).type).toBe("no_activity");
  });

  it("uses deterministic overdue tie-breaking by oldest deadline", () => {
    const result = computeNextAction([
      task("newer", { deadline: "2026-08-03" }),
      task("older", { deadline: "2026-08-01" }),
    ], [], []);
    expect(result.taskId).toBe("older");
  });
});

describe("computeDailyBriefing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 5, 12, 0, 0));
  });
  afterEach(() => vi.useRealTimers());

  it("builds the operational priority order and counts", () => {
    const clients = [client("overdue"), client("blocked"), client("today"), client("stalled")];
    const tasks = [
      task("t1", { clientId: "overdue", deadline: "2026-08-01" }),
      task("t2", { clientId: "blocked", column: "blocked" }),
      task("t3", { clientId: "today", deadline: "2026-08-05" }),
      task("t4", { clientId: "stalled", createdAt: "2026-07-01T10:00:00Z", columnChangedAt: "2026-07-01T10:00:00Z" }),
    ];
    const briefing = computeDailyBriefing(clients, tasks);
    expect(briefing.items.map((item) => item.type)).toEqual([
      "overdue_task", "blocked_task", "due_today", "stalled_client",
    ]);
    expect(briefing).toMatchObject({ criticalCount: 1, highCount: 2, mediumCount: 1, isEmpty: false });
  });

  it("does not include completed overdue work", () => {
    expect(computeDailyBriefing([client("a")], [task("done", { clientId: "a", deadline: "2026-08-01", column: "done" })]).isEmpty).toBe(true);
  });
});
