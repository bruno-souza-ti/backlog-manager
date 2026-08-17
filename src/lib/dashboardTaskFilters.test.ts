import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "../types";
import { filterDashboardTasks } from "./dashboardTaskFilters";

const task = (id: string, overrides: Partial<Task> = {}): Task => ({
  id, title: id, description: "", deadline: "", column: "todo", urgency: null, ...overrides,
});

describe("filterDashboardTasks", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 7, 16, 12)); });
  afterEach(() => vi.useRealTimers());

  it("shows only tasks assigned to the authenticated user in mine", () => {
    const tasks = [task("mine", { assigneeId: "me" }), task("other", { assigneeId: "other" }), task("open")];
    expect(filterDashboardTasks(tasks, "me", "mine").map((item) => item.id)).toEqual(["mine"]);
  });

  it("includes unassigned tasks only in the general scope", () => {
    const tasks = [task("mine", { assigneeId: "me" }), task("open")];
    expect(filterDashboardTasks(tasks, "me", "all").map((item) => item.id)).toEqual(["mine", "open"]);
  });

  it("combines scope and calculated urgency", () => {
    const tasks = [
      task("urgent", { assigneeId: "me", deadline: "2026-08-17" }),
      task("calm", { assigneeId: "me", deadline: "2026-08-30" }),
      task("other", { assigneeId: "other", urgency: "Urgente" }),
    ];
    expect(filterDashboardTasks(tasks, "me", "mine", "Urgente").map((item) => item.id)).toEqual(["urgent"]);
  });

  it("manual urgency overrides the deadline and null returns to automatic", () => {
    expect(filterDashboardTasks([task("manual", { deadline: "2026-08-16", urgency: "Sem Urgência" })], "me", "all", "Sem Urgência")).toHaveLength(1);
    expect(filterDashboardTasks([task("auto", { deadline: "2026-08-16", urgency: null })], "me", "all", "Muito Urgente")).toHaveLength(1);
  });
});
