import { describe, expect, it } from "vitest";

import {
  addCalendarDays,
  addCalendarMonths,
  addCalendarYears,
  DEFAULT_IANA_TIME_ZONE,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  isValidIanaTimeZone,
  parseTargetDate,
  resolveIanaTimeZone,
  startOfMonth,
  startOfCalendarDayInTimeZone,
  startOfWeek,
  todayInTimeZone,
  tomorrowInTimeZone,
  toUtcTimestamp,
} from "@/lib/dates";

describe("operation timestamps", () => {
  it("normalizes an operation instant to canonical UTC", () => {
    expect(toUtcTimestamp("2026-08-09T15:30:45.123+05:00")).toBe(
      "2026-08-09T10:30:45.123Z",
    );
  });

  it.each(["", "2026-08-09", "not-a-date", "2026-02-30T10:00:00Z"])(
    "rejects a value that is not a valid timestamp: %s",
    (value) => {
      expect(() => toUtcTimestamp(value)).toThrow();
    },
  );
});

describe("calendar target dates", () => {
  it("accepts leap days and rejects impossible calendar dates", () => {
    expect(parseTargetDate("2024-02-29")).toBe("2024-02-29");
    expect(() => parseTargetDate("2025-02-29")).toThrow();
    expect(() => parseTargetDate("2026-13-01")).toThrow();
  });

  it("keeps target dates independent from timezone offsets", () => {
    const targetDate = parseTargetDate("2027-01-01");

    expect(targetDate).toBe("2027-01-01");
  });
});

describe("timezone-aware today", () => {
  const instant = new Date("2026-12-31T20:30:00.000Z");

  it("calculates today in the user's IANA timezone", () => {
    expect(todayInTimeZone("Asia/Yekaterinburg", instant)).toBe("2027-01-01");
    expect(todayInTimeZone("America/New_York", instant)).toBe("2026-12-31");
  });

  it("calculates tomorrow across a year transition", () => {
    expect(tomorrowInTimeZone("America/New_York", instant)).toBe("2027-01-01");
  });

  it("rejects an unknown timezone", () => {
    expect(() => todayInTimeZone("Mars/Olympus_Mons", instant)).toThrow();
  });

  it("validates and safely resolves browser timezone candidates", () => {
    expect(isValidIanaTimeZone("Asia/Yekaterinburg")).toBe(true);
    expect(isValidIanaTimeZone("Etc/Unknown")).toBe(false);
    expect(resolveIanaTimeZone("Etc/Unknown", "Asia/Yekaterinburg")).toBe(
      "Asia/Yekaterinburg",
    );
    expect(resolveIanaTimeZone("Etc/Unknown")).toBe(DEFAULT_IANA_TIME_ZONE);
  });

  it("converts a local day boundary to UTC across DST and half-hour offsets", () => {
    expect(
      startOfCalendarDayInTimeZone(
        parseTargetDate("2026-03-08"),
        "America/New_York",
      ).toISOString(),
    ).toBe("2026-03-08T05:00:00.000Z");
    expect(
      startOfCalendarDayInTimeZone(
        parseTargetDate("2026-08-21"),
        "Asia/Kolkata",
      ).toISOString(),
    ).toBe("2026-08-20T18:30:00.000Z");
  });
});

describe("calendar arithmetic", () => {
  it("uses Monday through Sunday as week boundaries", () => {
    const sunday = parseTargetDate("2026-08-09");

    expect(startOfWeek(sunday)).toBe("2026-08-03");
    expect(endOfWeek(sunday)).toBe("2026-08-09");
  });

  it("crosses month and year boundaries without offset errors", () => {
    expect(addCalendarDays(parseTargetDate("2024-02-28"), 1)).toBe(
      "2024-02-29",
    );
    expect(addCalendarDays(parseTargetDate("2026-12-31"), 1)).toBe(
      "2027-01-01",
    );
    expect(addCalendarDays(parseTargetDate("2027-01-01"), -1)).toBe(
      "2026-12-31",
    );
  });

  it("adds calendar months and years while clamping impossible month days", () => {
    expect(addCalendarMonths(parseTargetDate("2026-01-31"), 1)).toBe(
      "2026-02-28",
    );
    expect(addCalendarMonths(parseTargetDate("2026-12-31"), 1)).toBe(
      "2027-01-31",
    );
    expect(addCalendarYears(parseTargetDate("2024-02-29"), 1)).toBe(
      "2025-02-28",
    );
  });

  it("finds the first and last calendar day of a month", () => {
    expect(startOfMonth(parseTargetDate("2024-02-17"))).toBe("2024-02-01");
    expect(endOfMonth(parseTargetDate("2024-02-17"))).toBe("2024-02-29");
    expect(endOfMonth(parseTargetDate("2026-12-17"))).toBe("2026-12-31");
  });

  it("returns signed day differences for today, tomorrow and past dates", () => {
    const today = parseTargetDate("2026-08-09");

    expect(differenceInCalendarDays(today, today)).toBe(0);
    expect(differenceInCalendarDays(today, parseTargetDate("2026-08-10"))).toBe(
      1,
    );
    expect(differenceInCalendarDays(today, parseTargetDate("2026-08-08"))).toBe(
      -1,
    );
    expect(
      differenceInCalendarDays(
        parseTargetDate("2026-12-31"),
        parseTargetDate("2027-01-01"),
      ),
    ).toBe(1);
  });
});
