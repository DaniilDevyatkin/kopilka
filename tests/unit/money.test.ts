import { describe, expect, it } from "vitest";

import {
  MAX_MONEY_MINOR,
  MIN_MONEY_MINOR,
  addMoney,
  compareMoney,
  deserializeMoney,
  formatCurrency,
  formatMoney,
  parseMoney,
  roundMoney,
  serializeMoney,
  subtractMoney,
} from "@/lib/money";

describe("parseMoney", () => {
  it.each([
    ["1 234,56 ₽", "RUB", "ru-RU", 123_456n],
    ["1\u00a0234,56\u00a0₽", "RUB", "ru-RU", 123_456n],
    ["1\u202f234,56 RUB", "RUB", "ru-RU", 123_456n],
    ["$1,234.56", "USD", "en-US", 123_456n],
    ["1.234,56 €", "EUR", "de-DE", 123_456n],
    ["−1 234,50", "RUB", "ru-RU", -123_450n],
    ["0.01", "USD", "en-US", 1n],
  ] as const)("parses %s exactly", (input, currency, locale, expected) => {
    expect(parseMoney(input, { currency, locale })).toBe(expected);
  });

  it("accepts the complete signed PostgreSQL bigint range", () => {
    expect(parseMoney("92233720368547758.07", { currency: "USD" })).toBe(
      MAX_MONEY_MINOR,
    );
    expect(parseMoney("-92233720368547758.08", { currency: "USD" })).toBe(
      MIN_MONEY_MINOR,
    );
  });

  it.each([
    "",
    " ",
    "-",
    "1,2,3",
    "12.3456",
    "12 рублей",
    "NaN",
    "Infinity",
    "92233720368547758.08",
    "-92233720368547758.09",
  ])("rejects malformed or unsafe input: %s", (input) => {
    expect(() => parseMoney(input)).toThrow();
  });

  it("can forbid negative form values", () => {
    expect(() => parseMoney("-1", { allowNegative: false })).toThrow();
  });
});

describe("money arithmetic", () => {
  it("adds, subtracts and compares bigint minor units", () => {
    expect(addMoney(12_345n, 55n)).toBe(12_400n);
    expect(subtractMoney(12_345n, 55n)).toBe(12_290n);
    expect(compareMoney(1n, 2n)).toBe(-1);
    expect(compareMoney(2n, 2n)).toBe(0);
    expect(compareMoney(3n, 2n)).toBe(1);
  });

  it("rejects arithmetic outside the database bigint range", () => {
    expect(() => addMoney(MAX_MONEY_MINOR, 1n)).toThrow();
    expect(() => subtractMoney(MIN_MONEY_MINOR, 1n)).toThrow();
  });

  it("rounds using integer arithmetic only", () => {
    expect(roundMoney(104n, 10n)).toBe(100n);
    expect(roundMoney(105n, 10n)).toBe(110n);
    expect(roundMoney(-105n, 10n)).toBe(-110n);
    expect(roundMoney(101n, 10n, "toward-zero")).toBe(100n);
    expect(roundMoney(-101n, 10n, "away-from-zero")).toBe(-110n);
    expect(roundMoney(-101n, 10n, "floor")).toBe(-110n);
    expect(roundMoney(-101n, 10n, "ceil")).toBe(-100n);
  });
});

describe("money formatting and transport", () => {
  it("formats RUB with non-breaking spacing before the currency", () => {
    const formatted = formatCurrency(123_456n, "RUB", { locale: "ru-RU" });

    expect(formatted).toBe("1\u00a0234,56\u00a0₽");
  });

  it.each([
    ["EUR", "de-DE", "1.234,56\u00a0€"],
    ["USD", "en-US", "$1,234.56"],
    ["KZT", "kk-KZ", "1\u00a0234,56\u00a0₸"],
    ["GEL", "ka-GE", "1\u00a0234,56\u00a0₾"],
  ] as const)("formats %s for %s", (currency, locale, expected) => {
    expect(formatCurrency(123_456n, currency, { locale })).toBe(expected);
  });

  it("formats values above Number.MAX_SAFE_INTEGER without precision loss", () => {
    expect(formatMoney(MAX_MONEY_MINOR, { locale: "ru-RU" })).toBe(
      "92\u00a0233\u00a0720\u00a0368\u00a0547\u00a0758,07",
    );
  });

  it("serializes bigint as a decimal string for client boundaries", () => {
    const unsafeAsNumber = 9_007_199_254_740_993n;

    expect(serializeMoney(unsafeAsNumber)).toBe("9007199254740993");
    expect(deserializeMoney("9007199254740993")).toBe(unsafeAsNumber);
    expect(() => deserializeMoney("9007199254740993.00")).toThrow();
  });
});
