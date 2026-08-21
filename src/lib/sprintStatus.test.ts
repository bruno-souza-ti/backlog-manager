import { describe, expect, it } from "vitest";
import { computeSprintStatus } from "./sprintStatus";

const NOW = new Date("2026-08-19T12:00:00.000Z").getTime();

describe("computeSprintStatus", () => {
  it("is upcoming before the start date", () => {
    expect(computeSprintStatus({ startDate: "2026-08-20", endDate: "2026-08-27" }, NOW)).toBe("upcoming");
  });

  it("is active on the start date", () => {
    expect(computeSprintStatus({ startDate: "2026-08-19", endDate: "2026-08-27" }, NOW)).toBe("active");
  });

  it("is active on the end date", () => {
    expect(computeSprintStatus({ startDate: "2026-08-12", endDate: "2026-08-19" }, NOW)).toBe("active");
  });

  it("is completed the day after the end date", () => {
    expect(computeSprintStatus({ startDate: "2026-08-05", endDate: "2026-08-18" }, NOW)).toBe("completed");
  });

  it("is active for a single-day sprint that starts and ends today", () => {
    expect(computeSprintStatus({ startDate: "2026-08-19", endDate: "2026-08-19" }, NOW)).toBe("active");
  });
});
