import {
  type CalendarDate,
  differenceInCalendarDays,
  endOfWeek,
  parseTargetDate,
} from "@/lib/dates";
import { MAX_MONEY_MINOR, addMoney } from "@/lib/money";

const PROGRESS_BASIS_POINTS = 10_000n;
const DAYS_PER_WEEK = 7n;
const WEEKS_PER_YEAR = 52n;
const MONTHS_PER_YEAR = 12n;

export type GoalDeadlineStatus = "none" | "past" | "today" | "future";
export type GoalFeasibility = "comfortable" | "strained" | "unrealistic";
export type NoDateSavingPercent = 10 | 20 | 30;
export type NoDatePace = "comfortable" | "optimal" | "fast";

export class GoalCalculationError extends Error {
  override readonly name = "GoalCalculationError";
}

export interface GoalProgress {
  /** Exact whole basis points. It may exceed 10_000 for an overfunded goal. */
  basisPoints: bigint;
  /** Display-safe progress-bar value in the inclusive 0..10_000 range. */
  cappedBasisPoints: bigint;
  isFunded: boolean;
  isOverfunded: boolean;
}

export interface GoalWeekSpan {
  fullWeeks: number;
  partialDays: number;
  roundedUpWeeks: number;
}

export interface GoalDeadline {
  status: GoalDeadlineStatus;
  /** Calendar distance. Today and a past deadline both expose zero here. */
  daysRemaining: number | null;
  /** Contribution days, including both today and the target date. */
  planningDays: number | null;
  weeks: GoalWeekSpan | null;
}

export interface GoalPlanInput {
  targetMinor: bigint;
  savedMinor: bigint;
  today: CalendarDate;
  targetDate?: CalendarDate | null;
  monthlyIncomeMinor?: bigint;
  mandatoryMonthlyExpensesMinor?: bigint;
}

export interface GoalPlan {
  remainingMinor: bigint;
  progress: GoalProgress;
  deadline: GoalDeadline;
  /** Normalized full Monday-Sunday pace. */
  weeklyContributionMinor: bigint | null;
  /** Exact daily pace through the selected deadline, rounded upward. */
  dailyContributionMinor: bigint | null;
  /** Pro-rata requirement for today through the current Sunday. */
  currentWeekContributionMinor: bigint | null;
  currentWeekDays: number | null;
  /** Weekly pace converted with the exact 52/12 ratio and rounded upward. */
  approximateMonthlyContributionMinor: bigint | null;
  availableMonthlyMinor: bigint | null;
  feasibility: GoalFeasibility | null;
  noDateScenarios: readonly NoDateScenario[] | null;
}

export interface NoDateScenariosInput {
  remainingMinor: bigint;
  monthlyIncomeMinor: bigint;
  mandatoryMonthlyExpensesMinor?: bigint;
  today: CalendarDate;
}

export interface NoDateScenario {
  percent: NoDateSavingPercent;
  pace: NoDatePace;
  monthlyContributionMinor: bigint;
  projectedDate: CalendarDate | null;
  monthsRequired: bigint | null;
  availableMonthlyMinor: bigint;
  isWithinAvailableBudget: boolean;
  feasibility: GoalFeasibility;
}

export interface GoalDateProjection {
  monthsRequired: bigint | null;
  projectedDate: CalendarDate | null;
}

export interface EmergencyFundPlans {
  threeMonthsMinor: bigint;
  sixMonthsMinor: bigint;
}

export interface GoalPlansTotal {
  goalCount: number;
  scheduledGoalCount: number;
  unscheduledGoalCount: number;
  remainingMinor: bigint;
  scheduledRemainingMinor: bigint;
  currentWeekContributionMinor: bigint;
  weeklyContributionMinor: bigint;
  approximateMonthlyContributionMinor: bigint;
}

function assertNonNegativeMoney(value: bigint, field: string): bigint {
  if (value < 0n || value > MAX_MONEY_MINOR) {
    throw new GoalCalculationError(
      `${field} must be a non-negative bigint minor-unit amount.`,
    );
  }
  return value;
}

function assertPositiveTarget(targetMinor: bigint): bigint {
  assertNonNegativeMoney(targetMinor, "targetMinor");
  if (targetMinor === 0n) {
    throw new GoalCalculationError("targetMinor must be greater than zero.");
  }
  return targetMinor;
}

function checkedMoney(value: bigint): bigint {
  if (value < 0n || value > MAX_MONEY_MINOR) {
    throw new GoalCalculationError(
      "Calculated money is outside the supported bigint range.",
    );
  }
  return value;
}

function divideCeil(numerator: bigint, denominator: bigint): bigint {
  if (numerator < 0n || denominator <= 0n) {
    throw new GoalCalculationError("Ceiling division requires valid operands.");
  }
  if (numerator === 0n) return 0n;
  return (numerator + denominator - 1n) / denominator;
}

function ratioCeil(
  amountMinor: bigint,
  numerator: bigint,
  denominator: bigint,
): bigint {
  assertNonNegativeMoney(amountMinor, "amountMinor");
  return checkedMoney(divideCeil(amountMinor * numerator, denominator));
}

function multiplyMoney(amountMinor: bigint, multiplier: bigint): bigint {
  assertNonNegativeMoney(amountMinor, "amountMinor");
  return checkedMoney(amountMinor * multiplier);
}

function weekSpan(planningDays: number): GoalWeekSpan {
  if (!Number.isSafeInteger(planningDays) || planningDays < 0) {
    throw new GoalCalculationError("Planning days must be a safe integer.");
  }
  return {
    fullWeeks: Math.floor(planningDays / 7),
    partialDays: planningDays % 7,
    roundedUpWeeks: Math.ceil(planningDays / 7),
  };
}

function deadlineFor(
  today: CalendarDate,
  targetDate: CalendarDate | null | undefined,
): GoalDeadline {
  if (!targetDate) {
    return {
      status: "none",
      daysRemaining: null,
      planningDays: null,
      weeks: null,
    };
  }

  const signedDays = differenceInCalendarDays(today, targetDate);
  if (signedDays < 0) {
    return {
      status: "past",
      daysRemaining: 0,
      planningDays: 0,
      weeks: weekSpan(0),
    };
  }

  const planningDays = signedDays + 1;
  return {
    status: signedDays === 0 ? "today" : "future",
    daysRemaining: signedDays,
    planningDays,
    weeks: weekSpan(planningDays),
  };
}

function contributionPlan(
  remainingMinor: bigint,
  today: CalendarDate,
  deadline: GoalDeadline,
): {
  weeklyContributionMinor: bigint | null;
  dailyContributionMinor: bigint | null;
  currentWeekContributionMinor: bigint | null;
  currentWeekDays: number | null;
  approximateMonthlyContributionMinor: bigint | null;
} {
  if (deadline.status === "none") {
    return {
      weeklyContributionMinor: null,
      dailyContributionMinor: null,
      currentWeekContributionMinor: null,
      currentWeekDays: null,
      approximateMonthlyContributionMinor: null,
    };
  }

  const currentWeekDays =
    deadline.status === "past"
      ? 0
      : Math.min(
          deadline.planningDays ?? 0,
          differenceInCalendarDays(today, endOfWeek(today)) + 1,
        );

  if (remainingMinor === 0n) {
    return {
      weeklyContributionMinor: 0n,
      dailyContributionMinor: 0n,
      currentWeekContributionMinor: 0n,
      currentWeekDays,
      approximateMonthlyContributionMinor: 0n,
    };
  }

  if (deadline.status === "past" || deadline.status === "today") {
    return {
      weeklyContributionMinor: remainingMinor,
      dailyContributionMinor: remainingMinor,
      currentWeekContributionMinor: remainingMinor,
      currentWeekDays,
      approximateMonthlyContributionMinor: remainingMinor,
    };
  }

  const planningDays = deadline.planningDays;
  if (planningDays === null || planningDays <= 0) {
    throw new GoalCalculationError("A future deadline needs planning days.");
  }

  const weeklyContributionMinor = ratioCeil(
    remainingMinor,
    DAYS_PER_WEEK,
    BigInt(planningDays),
  );
  const currentWeekContributionMinor = ratioCeil(
    remainingMinor,
    BigInt(currentWeekDays),
    BigInt(planningDays),
  );

  return {
    weeklyContributionMinor,
    dailyContributionMinor: divideCeil(remainingMinor, BigInt(planningDays)),
    currentWeekContributionMinor,
    currentWeekDays,
    approximateMonthlyContributionMinor: ratioCeil(
      weeklyContributionMinor,
      WEEKS_PER_YEAR,
      MONTHS_PER_YEAR,
    ),
  };
}

export function calculateRemaining(
  targetMinor: bigint,
  savedMinor: bigint,
): bigint {
  assertPositiveTarget(targetMinor);
  assertNonNegativeMoney(savedMinor, "savedMinor");
  return savedMinor >= targetMinor ? 0n : targetMinor - savedMinor;
}

export function calculateProgress(
  targetMinor: bigint,
  savedMinor: bigint,
): GoalProgress {
  assertPositiveTarget(targetMinor);
  assertNonNegativeMoney(savedMinor, "savedMinor");
  const basisPoints = (savedMinor * PROGRESS_BASIS_POINTS) / targetMinor;
  return {
    basisPoints,
    cappedBasisPoints:
      basisPoints > PROGRESS_BASIS_POINTS ? PROGRESS_BASIS_POINTS : basisPoints,
    isFunded: savedMinor >= targetMinor,
    isOverfunded: savedMinor > targetMinor,
  };
}

export function calculateAvailableMonthly(
  monthlyIncomeMinor: bigint,
  mandatoryMonthlyExpensesMinor = 0n,
): bigint {
  assertNonNegativeMoney(monthlyIncomeMinor, "monthlyIncomeMinor");
  assertNonNegativeMoney(
    mandatoryMonthlyExpensesMinor,
    "mandatoryMonthlyExpensesMinor",
  );
  return mandatoryMonthlyExpensesMinor >= monthlyIncomeMinor
    ? 0n
    : monthlyIncomeMinor - mandatoryMonthlyExpensesMinor;
}

export function assessGoalFeasibility(
  recommendedMonthlyMinor: bigint,
  availableMonthlyMinor: bigint,
): GoalFeasibility {
  assertNonNegativeMoney(recommendedMonthlyMinor, "recommendedMonthlyMinor");
  assertNonNegativeMoney(availableMonthlyMinor, "availableMonthlyMinor");
  if (recommendedMonthlyMinor === 0n) return "comfortable";
  if (recommendedMonthlyMinor > availableMonthlyMinor) return "unrealistic";
  return recommendedMonthlyMinor * 2n <= availableMonthlyMinor
    ? "comfortable"
    : "strained";
}

export function calculateGoalPlan(input: GoalPlanInput): GoalPlan {
  const remainingMinor = calculateRemaining(
    input.targetMinor,
    input.savedMinor,
  );
  const progress = calculateProgress(input.targetMinor, input.savedMinor);
  const deadline = deadlineFor(input.today, input.targetDate);
  const contributions = contributionPlan(remainingMinor, input.today, deadline);

  if (
    input.monthlyIncomeMinor === undefined &&
    input.mandatoryMonthlyExpensesMinor !== undefined
  ) {
    throw new GoalCalculationError(
      "Monthly income is required when monthly expenses are provided.",
    );
  }

  const availableMonthlyMinor =
    input.monthlyIncomeMinor === undefined
      ? null
      : calculateAvailableMonthly(
          input.monthlyIncomeMinor,
          input.mandatoryMonthlyExpensesMinor,
        );
  const feasibility =
    availableMonthlyMinor === null ||
    contributions.approximateMonthlyContributionMinor === null
      ? null
      : assessGoalFeasibility(
          contributions.approximateMonthlyContributionMinor,
          availableMonthlyMinor,
        );
  const noDateScenarios =
    deadline.status === "none" && input.monthlyIncomeMinor !== undefined
      ? calculateNoDateScenarios({
          remainingMinor,
          monthlyIncomeMinor: input.monthlyIncomeMinor,
          ...(input.mandatoryMonthlyExpensesMinor === undefined
            ? {}
            : {
                mandatoryMonthlyExpensesMinor:
                  input.mandatoryMonthlyExpensesMinor,
              }),
          today: input.today,
        })
      : null;

  return {
    remainingMinor,
    progress,
    deadline,
    ...contributions,
    availableMonthlyMinor,
    feasibility,
    noDateScenarios,
  };
}

function daysInMonth(year: number, month: number): number {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
    month - 1
  ]!;
}

function addCalendarMonthsClamped(
  value: CalendarDate,
  months: bigint,
): CalendarDate | null {
  if (months < 0n) {
    throw new GoalCalculationError("Month offset cannot be negative.");
  }
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const absoluteMonth = BigInt(year) * 12n + BigInt(month - 1) + months;
  const projectedYear = absoluteMonth / 12n;
  if (projectedYear < 1n || projectedYear > 9_999n) return null;
  const projectedMonth = Number(absoluteMonth % 12n) + 1;
  const projectedDay = Math.min(
    day,
    daysInMonth(Number(projectedYear), projectedMonth),
  );
  return parseTargetDate(
    `${projectedYear.toString().padStart(4, "0")}-${projectedMonth
      .toString()
      .padStart(2, "0")}-${projectedDay.toString().padStart(2, "0")}`,
  );
}

export function projectGoalDate(
  remainingMinor: bigint,
  monthlyContributionMinor: bigint,
  today: CalendarDate,
): GoalDateProjection {
  assertNonNegativeMoney(remainingMinor, "remainingMinor");
  assertNonNegativeMoney(monthlyContributionMinor, "monthlyContributionMinor");
  if (remainingMinor === 0n) {
    return { monthsRequired: 0n, projectedDate: today };
  }
  if (monthlyContributionMinor === 0n) {
    return { monthsRequired: null, projectedDate: null };
  }
  const monthsRequired = divideCeil(remainingMinor, monthlyContributionMinor);
  return {
    monthsRequired,
    projectedDate: addCalendarMonthsClamped(today, monthsRequired),
  };
}

export function calculateNoDateScenarios(
  input: NoDateScenariosInput,
): readonly NoDateScenario[] {
  assertNonNegativeMoney(input.remainingMinor, "remainingMinor");
  const availableMonthlyMinor = calculateAvailableMonthly(
    input.monthlyIncomeMinor,
    input.mandatoryMonthlyExpensesMinor,
  );
  const definitions = [
    { percent: 10, pace: "comfortable" },
    { percent: 20, pace: "optimal" },
    { percent: 30, pace: "fast" },
  ] as const;

  return definitions.map(({ percent, pace }) => {
    const monthlyContributionMinor =
      input.remainingMinor === 0n
        ? 0n
        : ratioCeil(input.monthlyIncomeMinor, BigInt(percent), 100n);
    const projection = projectGoalDate(
      input.remainingMinor,
      monthlyContributionMinor,
      input.today,
    );
    const isWithinAvailableBudget =
      input.remainingMinor === 0n ||
      (monthlyContributionMinor > 0n &&
        monthlyContributionMinor <= availableMonthlyMinor);
    return {
      percent,
      pace,
      monthlyContributionMinor,
      ...projection,
      availableMonthlyMinor,
      isWithinAvailableBudget,
      feasibility:
        input.remainingMinor > 0n && monthlyContributionMinor === 0n
          ? "unrealistic"
          : assessGoalFeasibility(
              monthlyContributionMinor,
              availableMonthlyMinor,
            ),
    };
  });
}

export function calculateEmergencyFundPlans(
  mandatoryMonthlyExpensesMinor: bigint,
): EmergencyFundPlans {
  return {
    threeMonthsMinor: multiplyMoney(mandatoryMonthlyExpensesMinor, 3n),
    sixMonthsMinor: multiplyMoney(mandatoryMonthlyExpensesMinor, 6n),
  };
}

export function sumGoalPlans(plans: readonly GoalPlan[]): GoalPlansTotal {
  let remainingMinor = 0n;
  let scheduledRemainingMinor = 0n;
  let currentWeekContributionMinor = 0n;
  let weeklyContributionMinor = 0n;
  let approximateMonthlyContributionMinor = 0n;
  let scheduledGoalCount = 0;

  for (const plan of plans) {
    remainingMinor = addMoney(remainingMinor, plan.remainingMinor);
    if (
      plan.weeklyContributionMinor === null ||
      plan.currentWeekContributionMinor === null ||
      plan.approximateMonthlyContributionMinor === null
    ) {
      continue;
    }
    scheduledGoalCount += 1;
    scheduledRemainingMinor = addMoney(
      scheduledRemainingMinor,
      plan.remainingMinor,
    );
    currentWeekContributionMinor = addMoney(
      currentWeekContributionMinor,
      plan.currentWeekContributionMinor,
    );
    weeklyContributionMinor = addMoney(
      weeklyContributionMinor,
      plan.weeklyContributionMinor,
    );
    approximateMonthlyContributionMinor = addMoney(
      approximateMonthlyContributionMinor,
      plan.approximateMonthlyContributionMinor,
    );
  }

  return {
    goalCount: plans.length,
    scheduledGoalCount,
    unscheduledGoalCount: plans.length - scheduledGoalCount,
    remainingMinor,
    scheduledRemainingMinor,
    currentWeekContributionMinor,
    weeklyContributionMinor,
    approximateMonthlyContributionMinor,
  };
}
