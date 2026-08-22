import {
  addCalendarDays,
  addCalendarMonths,
  addCalendarYears,
  todayInTimeZone,
  type CalendarDate,
} from "@/lib/dates";

export const GOAL_PERIOD_OPTIONS = [
  { value: "WEEK", label: "Неделя" },
  { value: "MONTH", label: "Месяц" },
  { value: "YEAR", label: "Год" },
  { value: "MORE_THAN_YEAR", label: "Больше года" },
] as const;

export type GoalPeriod = (typeof GOAL_PERIOD_OPTIONS)[number]["value"];

export function goalTargetDate(
  period: GoalPeriod,
  timeZone: string,
  now: Date = new Date(),
): CalendarDate {
  const today = todayInTimeZone(timeZone, now);

  switch (period) {
    case "WEEK":
      return addCalendarDays(today, 7);
    case "MONTH":
      return addCalendarMonths(today, 1);
    case "YEAR":
      return addCalendarYears(today, 1);
    case "MORE_THAN_YEAR":
      return addCalendarYears(today, 2);
  }
}
