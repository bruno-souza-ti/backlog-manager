import { describe, expect, it } from "vitest";
import { ActivityLogRow, mergeActivityEntries } from "./activityFeed";

function row(id: string, createdAt: string): ActivityLogRow {
  return { id, created_at: createdAt, action_type: "task_created", description: id };
}

describe("mergeActivityEntries", () => {
  it("deduplicates the same activity by id", () => {
    const activity = row("a", "2026-08-05T10:00:00Z");
    expect(mergeActivityEntries([activity], [activity], 15)).toEqual([activity]);
  });

  it("converges regardless of initial-query and Realtime arrival order", () => {
    const initial = [row("a", "2026-08-05T09:00:00Z")];
    const realtime = [row("b", "2026-08-05T10:00:00Z")];
    const queryFirst = mergeActivityEntries(mergeActivityEntries([], initial, 15), realtime, 15);
    const realtimeFirst = mergeActivityEntries(mergeActivityEntries([], realtime, 15), initial, 15);
    expect(queryFirst).toEqual(realtimeFirst);
    expect(queryFirst.map((entry) => entry.id)).toEqual(["b", "a"]);
  });

  it("sorts newest first and applies the limit", () => {
    const entries = [
      row("a", "2026-08-05T08:00:00Z"),
      row("b", "2026-08-05T10:00:00Z"),
      row("c", "2026-08-05T09:00:00Z"),
    ];
    expect(mergeActivityEntries([], entries, 2).map((entry) => entry.id)).toEqual(["b", "c"]);
  });

  it("handles empty lists", () => {
    expect(mergeActivityEntries([], [], 15)).toEqual([]);
  });
});
