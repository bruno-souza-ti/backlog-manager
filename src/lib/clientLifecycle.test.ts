import { describe, expect, it } from "vitest";
import { getClientLifecycleKey, isClientReadOnly, matchesClientLifecycleFilter } from "./clientLifecycle";

const lifecycle = (status: "active" | "frozen", deletedAt: string | null = null) => ({ status, deletedAt });

describe("client lifecycle", () => {
  it("treats deleted_at as authoritative over status", () => {
    expect(getClientLifecycleKey(lifecycle("active", "2026-08-10T12:00:00Z"))).toBe("deleted");
  });

  it("makes frozen and deleted clients read-only", () => {
    expect(isClientReadOnly(lifecycle("active"))).toBe(false);
    expect(isClientReadOnly(lifecycle("frozen"))).toBe(true);
    expect(isClientReadOnly(lifecycle("active", "2026-08-10T12:00:00Z"))).toBe(true);
  });

  it("keeps the default operational filter restricted to active clients", () => {
    expect(matchesClientLifecycleFilter(lifecycle("active"), "operational")).toBe(true);
    expect(matchesClientLifecycleFilter(lifecycle("frozen"), "operational")).toBe(false);
    expect(matchesClientLifecycleFilter(lifecycle("active", "2026-08-10T12:00:00Z"), "operational")).toBe(false);
  });
});
