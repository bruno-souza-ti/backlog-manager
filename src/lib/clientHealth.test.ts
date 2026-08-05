import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Task } from "../types";
import { computeClientHealth, isHealthWorsening } from "./clientHealth";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    title: "Tarefa",
    description: "",
    deadline: "2026-08-20",
    column: "todo",
    createdAt: "2026-08-05T10:00:00Z",
    ...overrides,
  };
}

describe("computeClientHealth", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 5, 12, 0, 0));
  });
  afterEach(() => vi.useRealTimers());

  it("keeps a client without risk signals stable", () => {
    expect(computeClientHealth({ tasks: [] })).toMatchObject({ level: "stable", score: 0 });
  });

  it("classifies overdue work at warning and critical boundaries", () => {
    const oneOverdue = task({ deadline: "2026-08-01" });
    expect(computeClientHealth({ tasks: [oneOverdue] })).toMatchObject({ level: "warning", score: 25 });
    expect(computeClientHealth({ tasks: [oneOverdue, task({ id: "second", deadline: "2026-08-02" })] })).toMatchObject({ level: "critical", score: 50 });
  });

  it("accounts for blocked work", () => {
    const result = computeClientHealth({ tasks: [task({ column: "blocked" }), task({ id: "second", column: "blocked" })] });
    expect(result).toMatchObject({ level: "warning", score: 30 });
    expect(result.reasons.some((reason) => reason.includes("bloqueada"))).toBe(true);
  });

  it("accounts for inactivity, deadline proximity, churn and meeting cadence", () => {
    const stale = task({ createdAt: "2026-07-01T10:00:00Z", columnChangedAt: "2026-07-01T10:00:00Z" });
    expect(computeClientHealth({ tasks: [stale] }).score).toBe(35);
    expect(computeClientHealth({ tasks: [task({ deadline: "2026-08-07" })] }).score).toBe(6);
    expect(computeClientHealth({ tasks: [], recentChangeCount: 6 }).score).toBe(15);
    expect(computeClientHealth({ tasks: [], lastMeetingAt: "2026-06-01T10:00:00Z" }).score).toBe(10);
  });

  it("combines independent signals into a critical result", () => {
    const blocked = [0, 1, 2].map((index) => task({ id: `blocked-${index}`, column: "blocked" }));
    expect(computeClientHealth({ tasks: blocked, lastMeetingAt: "2026-06-01T10:00:00Z" })).toMatchObject({ level: "critical", score: 55 });
  });
});

describe("isHealthWorsening", () => {
  it("accepts only strictly worse transitions", () => {
    expect(isHealthWorsening("stable", "warning")).toBe(true);
    expect(isHealthWorsening("warning", "critical")).toBe(true);
    expect(isHealthWorsening("stable", "stable")).toBe(false);
    expect(isHealthWorsening("critical", "warning")).toBe(false);
  });
});
