import { describe, expect, it } from "vitest";
import { computeDisplayStatus, hasTaskInDoing, isSessionOnline } from "./presence";
import type { Task } from "../types";

const NOW = new Date("2026-08-19T12:00:00.000Z").getTime();

describe("isSessionOnline", () => {
  it("is offline when there is no heartbeat at all", () => {
    expect(isSessionOnline(null, NOW)).toBe(false);
    expect(isSessionOnline(undefined, NOW)).toBe(false);
  });

  it("is online within the heartbeat grace window", () => {
    expect(isSessionOnline("2026-08-19T11:59:00.000Z", NOW)).toBe(true);
  });

  it("goes offline once the last heartbeat is stale", () => {
    expect(isSessionOnline("2026-08-19T11:50:00.000Z", NOW)).toBe(false);
  });
});

describe("computeDisplayStatus", () => {
  it("keeps in_meeting as the highest-precedence signal even if the session looks stale", () => {
    expect(computeDisplayStatus({ status: "in_meeting", last_seen_at: null }, false, NOW)).toBe("in_meeting");
  });

  it("reports offline when there is no recent heartbeat, regardless of the stored status", () => {
    expect(computeDisplayStatus({ status: "available", last_seen_at: null }, true, NOW)).toBe("offline");
    expect(computeDisplayStatus({ status: "busy", last_seen_at: "2026-08-19T11:00:00.000Z" }, false, NOW)).toBe("offline");
  });

  it("reports busy when online with a task in doing", () => {
    expect(computeDisplayStatus({ status: "available", last_seen_at: "2026-08-19T11:59:30.000Z" }, true, NOW)).toBe("busy");
  });

  it("reports available when online with nothing in doing", () => {
    expect(computeDisplayStatus({ status: "busy", last_seen_at: "2026-08-19T11:59:30.000Z" }, false, NOW)).toBe("available");
  });
});

describe("hasTaskInDoing", () => {
  const task = (overrides: Partial<Task>): Task => ({
    id: overrides.id ?? "t1",
    title: "Tarefa",
    description: "",
    deadline: "",
    column: "todo",
    ...overrides,
  });

  it("is true only for a doing task assigned to that profile", () => {
    const tasks = [
      task({ id: "a", assigneeId: "user-1", column: "doing" }),
      task({ id: "b", assigneeId: "user-2", column: "doing" }),
      task({ id: "c", assigneeId: "user-1", column: "done" }),
    ];
    expect(hasTaskInDoing(tasks, "user-1")).toBe(true);
    expect(hasTaskInDoing(tasks, "user-2")).toBe(true);
    expect(hasTaskInDoing(tasks, "user-3")).toBe(false);
  });
});
