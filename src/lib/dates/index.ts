export type CalendarDate = string & { readonly __calendarDate: unique symbol };
export type UtcTimestamp = string & { readonly __utcTimestamp: unique symbol };

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;
const TIMESTAMP_PATTERN = /^(\d{4}-\d{2}-\d{2})T.+(?:Z|[+-]\d{2}:\d{2})$/iu;
const MILLISECONDS_PER_DAY = 86_400_000;

export const DEFAULT_IANA_TIME_ZONE = "Europe/Moscow";

export class DateValueError extends Error {
  override readonly name = "DateValueError";
}

interface CalendarParts {
  year: number;
  month: number;
  day: number;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  const days = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return days[month - 1] ?? 0;
}

function calendarParts(value: string): CalendarParts {
  const match = CALENDAR_DATE_PATTERN.exec(value);
  if (!match) {
    throw new DateValueError("Calendar date must use YYYY-MM-DD format.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    throw new DateValueError("Calendar date does not exist.");
  }

  return { year, month, day };
}

function formatCalendarParts({
  year,
  month,
  day,
}: CalendarParts): CalendarDate {
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
    .toString()
    .padStart(2, "0")}` as CalendarDate;
}

function toUtcCalendarCarrier(value: CalendarDate): Date {
  const { year, month, day } = calendarParts(value);
  const carrier = new Date(0);
  carrier.setUTCHours(0, 0, 0, 0);
  carrier.setUTCFullYear(year, month - 1, day);
  return carrier;
}

function assertValidInstant(value: Date): Date {
  if (Number.isNaN(value.getTime())) {
    throw new DateValueError("Operation timestamp is invalid.");
  }
  return value;
}

export function isValidIanaTimeZone(value: string): boolean {
  if (value.trim() === "") return false;

  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function resolveIanaTimeZone(
  ...candidates: Array<string | null | undefined>
): string {
  return (
    candidates.find(
      (candidate): candidate is string =>
        typeof candidate === "string" && isValidIanaTimeZone(candidate),
    ) ?? DEFAULT_IANA_TIME_ZONE
  );
}

export function toUtcTimestamp(value: Date | string): UtcTimestamp {
  if (typeof value === "string") {
    const match = TIMESTAMP_PATTERN.exec(value);
    if (!match) {
      throw new DateValueError(
        "Operation timestamp must include time and UTC offset.",
      );
    }
    parseTargetDate(match[1] ?? "");
  }

  return assertValidInstant(
    typeof value === "string" ? new Date(value) : new Date(value.getTime()),
  ).toISOString() as UtcTimestamp;
}

export function parseTargetDate(value: string): CalendarDate {
  calendarParts(value);
  return value as CalendarDate;
}

export function todayInTimeZone(
  timeZone: string,
  now: Date = new Date(),
): CalendarDate {
  assertValidInstant(now);
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      calendar: "iso8601",
      numberingSystem: "latn",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
  } catch {
    throw new DateValueError("Unknown IANA timezone.");
  }

  const part = (type: Intl.DateTimeFormatPartTypes): number => {
    const rawValue = parts.find((item) => item.type === type)?.value;
    if (!rawValue)
      throw new DateValueError("Could not calculate the local calendar date.");
    return Number(rawValue);
  };

  return formatCalendarParts({
    year: part("year"),
    month: part("month"),
    day: part("day"),
  });
}

export function tomorrowInTimeZone(
  timeZone: string,
  now: Date = new Date(),
): CalendarDate {
  return addCalendarDays(todayInTimeZone(timeZone, now), 1);
}

/**
 * Converts the start of a calendar day in an IANA zone to a real UTC instant.
 * The iterative correction keeps DST and non-whole-hour offsets out of the UI.
 */
export function startOfCalendarDayInTimeZone(
  value: CalendarDate,
  timeZone: string,
): Date {
  if (!isValidIanaTimeZone(timeZone)) {
    throw new DateValueError("Unknown IANA timezone.");
  }
  const target = calendarParts(value);
  const targetUtc = Date.UTC(target.year, target.month - 1, target.day);
  let candidate = targetUtc;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    calendar: "iso8601",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = formatter.formatToParts(candidate);
    const numberPart = (type: Intl.DateTimeFormatPartTypes): number => {
      const raw = parts.find((part) => part.type === type)?.value;
      if (!raw)
        throw new DateValueError("Could not resolve calendar boundary.");
      return Number(raw);
    };
    const representedUtc = Date.UTC(
      numberPart("year"),
      numberPart("month") - 1,
      numberPart("day"),
      numberPart("hour"),
      numberPart("minute"),
      numberPart("second"),
    );
    const correction = targetUtc - representedUtc;
    candidate += correction;
    if (correction === 0) break;
  }

  return new Date(candidate);
}

export function addCalendarDays(
  value: CalendarDate,
  days: number,
): CalendarDate {
  if (!Number.isSafeInteger(days)) {
    throw new DateValueError("Calendar day offset must be a safe integer.");
  }

  const carrier = toUtcCalendarCarrier(value);
  carrier.setUTCDate(carrier.getUTCDate() + days);
  return formatCalendarParts({
    year: carrier.getUTCFullYear(),
    month: carrier.getUTCMonth() + 1,
    day: carrier.getUTCDate(),
  });
}

export function addCalendarMonths(
  value: CalendarDate,
  months: number,
): CalendarDate {
  if (!Number.isSafeInteger(months)) {
    throw new DateValueError("Calendar month offset must be a safe integer.");
  }

  const { year, month, day } = calendarParts(value);
  const monthIndex = year * 12 + month - 1 + months;
  if (!Number.isSafeInteger(monthIndex)) {
    throw new DateValueError(
      "Calendar month offset is outside the safe range.",
    );
  }

  const targetYear = Math.floor(monthIndex / 12);
  const targetMonth = (((monthIndex % 12) + 12) % 12) + 1;
  if (targetYear < 1 || targetYear > 9999) {
    throw new DateValueError("Calendar date is outside the supported range.");
  }

  return formatCalendarParts({
    year: targetYear,
    month: targetMonth,
    day: Math.min(day, daysInMonth(targetYear, targetMonth)),
  });
}

export function addCalendarYears(
  value: CalendarDate,
  years: number,
): CalendarDate {
  if (!Number.isSafeInteger(years) || !Number.isSafeInteger(years * 12)) {
    throw new DateValueError("Calendar year offset must be a safe integer.");
  }

  return addCalendarMonths(value, years * 12);
}

export function differenceInCalendarDays(
  from: CalendarDate,
  to: CalendarDate,
): number {
  return (
    (toUtcCalendarCarrier(to).getTime() -
      toUtcCalendarCarrier(from).getTime()) /
    MILLISECONDS_PER_DAY
  );
}

export function startOfWeek(value: CalendarDate): CalendarDate {
  const dayOfWeek = toUtcCalendarCarrier(value).getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return addCalendarDays(value, -daysSinceMonday);
}

export function endOfWeek(value: CalendarDate): CalendarDate {
  return addCalendarDays(startOfWeek(value), 6);
}

export function startOfMonth(value: CalendarDate): CalendarDate {
  const { year, month } = calendarParts(value);
  return formatCalendarParts({ year, month, day: 1 });
}

export function endOfMonth(value: CalendarDate): CalendarDate {
  const { year, month } = calendarParts(value);
  return formatCalendarParts({ year, month, day: daysInMonth(year, month) });
}
