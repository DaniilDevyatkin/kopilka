import { describe, expect, it } from "vitest";

import { goalTargetDate } from "@/lib/goals/period";

describe("goal period target dates", () => {
  const now = new Date("2026-08-15T10:00:00.000Z");

  it.each([
    ["WEEK", "2026-08-22"],
    ["MONTH", "2026-09-15"],
    ["YEAR", "2027-08-15"],
    ["MORE_THAN_YEAR", "2028-08-15"],
  ] as const)("maps %s to an exact calendar target", (period, expected) => {
    expect(goalTargetDate(period, "Europe/Moscow", now)).toBe(expected);
  });

  it("uses the user's timezone before adding the selected period", () => {
    const boundary = new Date("2026-12-31T20:30:00.000Z");

    expect(goalTargetDate("WEEK", "Asia/Yekaterinburg", boundary)).toBe(
      "2027-01-08",
    );
    expect(goalTargetDate("WEEK", "America/New_York", boundary)).toBe(
      "2027-01-07",
    );
  });
});
