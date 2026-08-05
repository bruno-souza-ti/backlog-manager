import { describe, expect, it } from "vitest";
import { Task } from "../types";
import { classifyColumnTransition, createTaskColumnTransition } from "./taskTransition";

const changedAt = "2026-08-05T12:00:00.000Z";

function task(column: Task["column"]): Task {
  return { id: "task-1", title: "Tarefa", description: "", deadline: "2026-08-10", column };
}

describe("classifyColumnTransition", () => {
  it.each([
    ["todo", "done", "completed"],
    ["doing", "done", "completed"],
    ["done", "done", "no_change"],
    ["todo", "todo", "no_change"],
    ["done", "doing", "moved"],
    ["todo", "blocked", "moved"],
    [undefined, "done", "not_found"],
  ] as const)("classifies %s -> %s as %s", (from, to, expected) => {
    expect(classifyColumnTransition(from, to)).toBe(expected);
  });
});

describe("createTaskColumnTransition", () => {
  it("sets completedAt when entering done", () => {
    const result = createTaskColumnTransition([task("doing")], "task-1", "done", changedAt);
    expect(result.kind).toBe("completed");
    expect(result.nextTasks[0]).toMatchObject({ column: "done", completedAt: changedAt, columnChangedAt: changedAt });
  });

  it("clears completedAt when leaving done", () => {
    const doneTask = { ...task("done"), completedAt: "2026-08-04T12:00:00.000Z" };
    const result = createTaskColumnTransition([doneTask], "task-1", "doing", changedAt);
    expect(result.kind).toBe("moved");
    expect(result.nextTasks[0].completedAt).toBeUndefined();
  });

  it("returns the same array for no-op and missing tasks", () => {
    const tasks = [task("todo")];
    expect(createTaskColumnTransition(tasks, "task-1", "todo", changedAt).nextTasks).toBe(tasks);
    expect(createTaskColumnTransition(tasks, "missing", "done", changedAt).nextTasks).toBe(tasks);
  });
});
