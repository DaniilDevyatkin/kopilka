import { describe, expect, it } from "vitest";

import { parseTargetDate } from "@/lib/dates";
import {
  calculateAvailableMonthly,
  calculateEmergencyFundPlans,
  calculateGoalPlan,
  calculateNoDateScenarios,
  calculateProgress,
  calculateRemaining,
  projectGoalDate,
  sumGoalPlans,
} from "@/lib/goals/calculations";
import { MAX_MONEY_MINOR } from "@/lib/money";

const MONDAY = parseTargetDate("2026-08-03");

describe("goal remaining and progress", () => {
  it("calculates remaining in bigint minor units", () => {
    expect(calculateRemaining(100_00n, 25_01n)).toBe(74_99n);
  });

  it("represents 0%, 100% and overfunded progress without float money", () => {
    expect(calculateProgress(10_000n, 0n)).toEqual({
      basisPoints: 0n,
      cappedBasisPoints: 0n,
      isFunded: false,
      isOverfunded: false,
    });
    expect(calculateProgress(10_000n, 10_000n)).toEqual({
      basisPoints: 10_000n,
      cappedBasisPoints: 10_000n,
      isFunded: true,
      isOverfunded: false,
    });
    expect(calculateProgress(10_000n, 12_500n)).toEqual({
      basisPoints: 12_500n,
      cappedBasisPoints: 10_000n,
      isFunded: true,
      isOverfunded: true,
    });
  });

  it("never returns a negative remaining amount for a funded goal", () => {
    expect(calculateRemaining(10_000n, 12_500n)).toBe(0n);
  });

  it("rejects an invalid zero target and negative money", () => {
    expect(() => calculateProgress(0n, 0n)).toThrow();
    expect(() => calculateRemaining(10_000n, -1n)).toThrow();
  });
});

describe("dated goal plan", () => {
  it("treats a deadline today as an immediate amount without division by zero", () => {
    const plan = calculateGoalPlan({
      targetMinor: 10_000n,
      savedMinor: 2_500n,
      today: MONDAY,
      targetDate: MONDAY,
      monthlyIncomeMinor: 50_000n,
      mandatoryMonthlyExpensesMinor: 20_000n,
    });

    expect(plan.deadline).toEqual({
      status: "today",
      daysRemaining: 0,
      planningDays: 1,
      weeks: { fullWeeks: 0, partialDays: 1, roundedUpWeeks: 1 },
    });
    expect(plan.weeklyContributionMinor).toBe(7_500n);
    expect(plan.currentWeekContributionMinor).toBe(7_500n);
    expect(plan.approximateMonthlyContributionMinor).toBe(7_500n);
    expect(plan.feasibility).toBe("comfortable");
  });

  it("handles tomorrow and a deadline shorter than a week", () => {
    const tomorrow = calculateGoalPlan({
      targetMinor: 1_001n,
      savedMinor: 0n,
      today: MONDAY,
      targetDate: parseTargetDate("2026-08-04"),
    });
    const friday = calculateGoalPlan({
      targetMinor: 1_001n,
      savedMinor: 0n,
      today: MONDAY,
      targetDate: parseTargetDate("2026-08-07"),
    });

    expect(tomorrow.deadline.daysRemaining).toBe(1);
    expect(tomorrow.weeklyContributionMinor).toBe(3_504n);
    expect(tomorrow.currentWeekContributionMinor).toBe(1_001n);
    expect(friday.deadline.planningDays).toBe(5);
    expect(friday.weeklyContributionMinor).toBe(1_402n);
    expect(friday.currentWeekContributionMinor).toBe(1_001n);
  });

  it("calculates exactly one Monday-Sunday contribution week", () => {
    const plan = calculateGoalPlan({
      targetMinor: 700n,
      savedMinor: 0n,
      today: MONDAY,
      targetDate: parseTargetDate("2026-08-09"),
    });

    expect(plan.deadline).toEqual({
      status: "future",
      daysRemaining: 6,
      planningDays: 7,
      weeks: { fullWeeks: 1, partialDays: 0, roundedUpWeeks: 1 },
    });
    expect(plan.weeklyContributionMinor).toBe(700n);
    expect(plan.currentWeekContributionMinor).toBe(700n);
    expect(plan.approximateMonthlyContributionMinor).toBe(3_034n);
  });

  it("calculates a deterministic 17-week plan", () => {
    const plan = calculateGoalPlan({
      targetMinor: 17_001n,
      savedMinor: 1n,
      today: MONDAY,
      targetDate: parseTargetDate("2026-11-29"),
    });

    expect(plan.deadline.planningDays).toBe(119);
    expect(plan.deadline.weeks).toEqual({
      fullWeeks: 17,
      partialDays: 0,
      roundedUpWeeks: 17,
    });
    expect(plan.weeklyContributionMinor).toBe(1_000n);
    expect(plan.approximateMonthlyContributionMinor).toBe(4_334n);
  });

  it("uses a documented pro-rata amount for the incomplete current week", () => {
    const plan = calculateGoalPlan({
      targetMinor: 1_200n,
      savedMinor: 0n,
      today: parseTargetDate("2026-08-05"),
      targetDate: parseTargetDate("2026-08-16"),
    });

    expect(plan.deadline.planningDays).toBe(12);
    expect(plan.currentWeekDays).toBe(5);
    expect(plan.currentWeekContributionMinor).toBe(500n);
    expect(plan.weeklyContributionMinor).toBe(700n);
  });

  it("marks a past deadline and makes the remaining amount due now", () => {
    const plan = calculateGoalPlan({
      targetMinor: 10_000n,
      savedMinor: 2_000n,
      today: MONDAY,
      targetDate: parseTargetDate("2026-08-02"),
    });

    expect(plan.deadline).toEqual({
      status: "past",
      daysRemaining: 0,
      planningDays: 0,
      weeks: { fullWeeks: 0, partialDays: 0, roundedUpWeeks: 0 },
    });
    expect(plan.weeklyContributionMinor).toBe(8_000n);
    expect(plan.currentWeekContributionMinor).toBe(8_000n);
    expect(plan.approximateMonthlyContributionMinor).toBe(8_000n);
  });

  it("returns zero recommendations for 100% and overfunded goals", () => {
    for (const savedMinor of [10_000n, 12_000n]) {
      const plan = calculateGoalPlan({
        targetMinor: 10_000n,
        savedMinor,
        today: MONDAY,
        targetDate: parseTargetDate("2026-08-09"),
      });

      expect(plan.remainingMinor).toBe(0n);
      expect(plan.weeklyContributionMinor).toBe(0n);
      expect(plan.approximateMonthlyContributionMinor).toBe(0n);
      expect(plan.currentWeekDays).toBe(7);
    }
  });

  it("rounds recommendations upward so the target cannot be underfunded", () => {
    const plan = calculateGoalPlan({
      targetMinor: 1_000n,
      savedMinor: 0n,
      today: MONDAY,
      targetDate: parseTargetDate("2026-08-11"),
    });

    expect(plan.deadline.planningDays).toBe(9);
    expect(plan.weeklyContributionMinor).toBe(778n);
    expect(plan.weeklyContributionMinor! * 9n).toBeGreaterThanOrEqual(
      1_000n * 7n,
    );
    expect(plan.approximateMonthlyContributionMinor).toBe(3_372n);
  });

  it("keeps calculations exact for very large bigint amounts", () => {
    const plan = calculateGoalPlan({
      targetMinor: MAX_MONEY_MINOR,
      savedMinor: 0n,
      today: MONDAY,
      targetDate: parseTargetDate("2026-11-29"),
    });

    expect(plan.weeklyContributionMinor).toBe(542_551_296_285_575_048n);
    expect(plan.weeklyContributionMinor! * 17n).toBeGreaterThanOrEqual(
      MAX_MONEY_MINOR,
    );
  });

  it("handles a Monday-Sunday week across a year boundary", () => {
    const plan = calculateGoalPlan({
      targetMinor: 7_000n,
      savedMinor: 0n,
      today: parseTargetDate("2026-12-28"),
      targetDate: parseTargetDate("2027-01-03"),
    });

    expect(plan.deadline.planningDays).toBe(7);
    expect(plan.weeklyContributionMinor).toBe(7_000n);
  });

  it("keeps date-based recommendations null when the target date is absent", () => {
    const plan = calculateGoalPlan({
      targetMinor: 10_000n,
      savedMinor: 1_000n,
      today: MONDAY,
    });

    expect(plan.deadline.status).toBe("none");
    expect(plan.weeklyContributionMinor).toBeNull();
    expect(plan.currentWeekContributionMinor).toBeNull();
    expect(plan.approximateMonthlyContributionMinor).toBeNull();
    expect(plan.feasibility).toBeNull();
  });
});

describe("budget and feasibility", () => {
  it("calculates available monthly budget and clamps it at zero", () => {
    expect(calculateAvailableMonthly(100_000n, 40_000n)).toBe(60_000n);
    expect(calculateAvailableMonthly(0n, 0n)).toBe(0n);
    expect(calculateAvailableMonthly(10_000n, 12_000n)).toBe(0n);
  });

  it.each([
    [1_000n, 3_000n, "comfortable"],
    [2_000n, 3_000n, "strained"],
    [3_001n, 3_000n, "unrealistic"],
    [1n, 0n, "unrealistic"],
    [0n, 0n, "comfortable"],
  ] as const)(
    "classifies %s against %s as %s",
    (recommendedMonthlyMinor, availableMonthlyMinor, expected) => {
      const plan = calculateGoalPlan({
        targetMinor: recommendedMonthlyMinor || 1n,
        savedMinor: recommendedMonthlyMinor === 0n ? 1n : 0n,
        today: MONDAY,
        targetDate: MONDAY,
        monthlyIncomeMinor: availableMonthlyMinor,
      });

      expect(plan.feasibility).toBe(expected);
    },
  );
});

describe("goals without a target date", () => {
  it("returns 10/20/30% scenarios with upward minor-unit rounding", () => {
    const scenarios = calculateNoDateScenarios({
      remainingMinor: 10_000n,
      monthlyIncomeMinor: 10_001n,
      mandatoryMonthlyExpensesMinor: 7_501n,
      today: parseTargetDate("2026-01-31"),
    });

    expect(
      scenarios.map(({ percent, monthlyContributionMinor }) => [
        percent,
        monthlyContributionMinor,
      ]),
    ).toEqual([
      [10, 1_001n],
      [20, 2_001n],
      [30, 3_001n],
    ]);
    expect(scenarios.map(({ projectedDate }) => projectedDate)).toEqual([
      "2026-11-30",
      "2026-06-30",
      "2026-05-31",
    ]);
    expect(
      scenarios.map(({ isWithinAvailableBudget }) => isWithinAvailableBudget),
    ).toEqual([true, true, false]);
  });

  it("returns no projected dates for zero income without dividing by zero", () => {
    const scenarios = calculateNoDateScenarios({
      remainingMinor: 10_000n,
      monthlyIncomeMinor: 0n,
      mandatoryMonthlyExpensesMinor: 5_000n,
      today: MONDAY,
    });

    expect(
      scenarios.every((scenario) => scenario.monthlyContributionMinor === 0n),
    ).toBe(true);
    expect(scenarios.every((scenario) => scenario.projectedDate === null)).toBe(
      true,
    );
    expect(
      scenarios.every((scenario) => !scenario.isWithinAvailableBudget),
    ).toBe(true);
  });

  it("does not recommend new contributions when the undated goal is funded", () => {
    const scenarios = calculateNoDateScenarios({
      remainingMinor: 0n,
      monthlyIncomeMinor: 100_000n,
      mandatoryMonthlyExpensesMinor: 100_000n,
      today: MONDAY,
    });

    expect(
      scenarios.every(
        (scenario) =>
          scenario.monthlyContributionMinor === 0n &&
          scenario.projectedDate === MONDAY &&
          scenario.feasibility === "comfortable",
      ),
    ).toBe(true);
  });
});

describe("projected dates and emergency fund", () => {
  it("projects by whole monthly contributions and clamps month-end", () => {
    expect(
      projectGoalDate(1_000n, 1_000n, parseTargetDate("2026-01-31")),
    ).toEqual({ monthsRequired: 1n, projectedDate: "2026-02-28" });
    expect(
      projectGoalDate(2_001n, 1_000n, parseTargetDate("2026-11-30")),
    ).toEqual({ monthsRequired: 3n, projectedDate: "2027-02-28" });
  });

  it("returns today for a funded goal and null for a zero contribution", () => {
    expect(projectGoalDate(0n, 0n, MONDAY)).toEqual({
      monthsRequired: 0n,
      projectedDate: MONDAY,
    });
    expect(projectGoalDate(1n, 0n, MONDAY)).toEqual({
      monthsRequired: null,
      projectedDate: null,
    });
  });

  it("calculates three- and six-month emergency fund orientations", () => {
    expect(calculateEmergencyFundPlans(25_000n)).toEqual({
      threeMonthsMinor: 75_000n,
      sixMonthsMinor: 150_000n,
    });
    expect(calculateEmergencyFundPlans(0n)).toEqual({
      threeMonthsMinor: 0n,
      sixMonthsMinor: 0n,
    });
  });
});

describe("multiple goals", () => {
  it("sums scheduled plans and reports goals without a date separately", () => {
    const first = calculateGoalPlan({
      targetMinor: 700n,
      savedMinor: 0n,
      today: MONDAY,
      targetDate: parseTargetDate("2026-08-09"),
    });
    const second = calculateGoalPlan({
      targetMinor: 1_400n,
      savedMinor: 0n,
      today: MONDAY,
      targetDate: parseTargetDate("2026-08-09"),
    });
    const unscheduled = calculateGoalPlan({
      targetMinor: 3_000n,
      savedMinor: 1_000n,
      today: MONDAY,
    });

    expect(sumGoalPlans([first, second, unscheduled])).toEqual({
      goalCount: 3,
      scheduledGoalCount: 2,
      unscheduledGoalCount: 1,
      remainingMinor: 4_100n,
      scheduledRemainingMinor: 2_100n,
      currentWeekContributionMinor: 2_100n,
      weeklyContributionMinor: 2_100n,
      approximateMonthlyContributionMinor: 9_101n,
    });
  });
});
