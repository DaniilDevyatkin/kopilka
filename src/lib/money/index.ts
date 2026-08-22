export const MAX_MONEY_MINOR = 9_223_372_036_854_775_807n;
export const MIN_MONEY_MINOR = -9_223_372_036_854_775_808n;

export const SUPPORTED_CURRENCIES = [
  "RUB",
  "EUR",
  "USD",
  "KZT",
  "GEL",
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];
export type SerializedMoney = string & {
  readonly __serializedMoney: unique symbol;
};
export type MoneyRoundingMode =
  "half-away-from-zero" | "toward-zero" | "away-from-zero" | "floor" | "ceil";

export interface ParseMoneyOptions {
  currency?: SupportedCurrency;
  locale?: string;
  allowNegative?: boolean;
}

export interface FormatMoneyOptions {
  locale?: string;
  minimumFractionDigits?: 0 | 1 | 2;
  maximumFractionDigits?: 0 | 1 | 2;
}

const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  RUB: "₽",
  EUR: "€",
  USD: "$",
  KZT: "₸",
  GEL: "₾",
};

const DEFAULT_LOCALES: Record<SupportedCurrency, string> = {
  RUB: "ru-RU",
  EUR: "de-DE",
  USD: "en-US",
  KZT: "kk-KZ",
  GEL: "ka-GE",
};

const MONEY_SPACES = /[\s\u00a0\u202f]/gu;
const INTEGER_STRING = /^-?(?:0|[1-9]\d*)$/u;

export class MoneyError extends Error {
  override readonly name = "MoneyError";
}

function assertMoneyRange(value: bigint): bigint {
  if (value < MIN_MONEY_MINOR || value > MAX_MONEY_MINOR) {
    throw new MoneyError("Money amount is outside the supported bigint range.");
  }

  return value;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function removeCurrencyMarker(
  value: string,
  currency: SupportedCurrency,
): string {
  const marker = `(?:${escapeRegExp(currency)}|${escapeRegExp(CURRENCY_SYMBOLS[currency])})`;
  const prefix = new RegExp(`^${marker}[\\s\\u00a0\\u202f]*`, "iu");
  const suffix = new RegExp(`[\\s\\u00a0\\u202f]*${marker}$`, "iu");

  return value.replace(prefix, "").replace(suffix, "").trim();
}

function isGroupedInteger(value: string, separator: "," | "."): boolean {
  const escapedSeparator = escapeRegExp(separator);
  return new RegExp(`^\\d{1,3}(?:${escapedSeparator}\\d{3})+$`, "u").test(
    value,
  );
}

function splitDecimal(value: string): { major: string; fraction: string } {
  const commaCount = (value.match(/,/gu) ?? []).length;
  const dotCount = (value.match(/\./gu) ?? []).length;

  if (commaCount > 0 && dotCount > 0) {
    const decimalSeparator =
      value.lastIndexOf(",") > value.lastIndexOf(".") ? "," : ".";
    const groupingSeparator = decimalSeparator === "," ? "." : ",";
    const decimalIndex = value.lastIndexOf(decimalSeparator);
    const majorWithGroups = value.slice(0, decimalIndex);
    const fraction = value.slice(decimalIndex + 1);

    if (
      fraction.length < 1 ||
      fraction.length > 2 ||
      !/^\d+$/u.test(fraction) ||
      (!(majorWithGroups === "" || /^\d+$/u.test(majorWithGroups)) &&
        !isGroupedInteger(majorWithGroups, groupingSeparator))
    ) {
      throw new MoneyError("Money amount has invalid separators or precision.");
    }

    return {
      major: majorWithGroups.replaceAll(groupingSeparator, "") || "0",
      fraction,
    };
  }

  const separator: "," | "." | undefined =
    commaCount > 0 ? "," : dotCount > 0 ? "." : undefined;
  if (!separator) {
    return { major: value, fraction: "" };
  }

  const count = separator === "," ? commaCount : dotCount;
  if (count > 1) {
    if (!isGroupedInteger(value, separator)) {
      throw new MoneyError("Money amount has invalid grouping.");
    }

    return { major: value.replaceAll(separator, ""), fraction: "" };
  }

  const separatorIndex = value.indexOf(separator);
  const major = value.slice(0, separatorIndex);
  const fraction = value.slice(separatorIndex + 1);

  if (fraction.length === 3 && major.length >= 1 && major.length <= 3) {
    return { major: `${major}${fraction}`, fraction: "" };
  }

  if (fraction.length < 1 || fraction.length > 2 || !/^\d+$/u.test(fraction)) {
    throw new MoneyError("Money amount has more than two fractional digits.");
  }

  return { major: major || "0", fraction };
}

export function parseMoney(
  input: string,
  options: ParseMoneyOptions = {},
): bigint {
  const currency = options.currency ?? "RUB";
  const allowNegative = options.allowNegative ?? true;
  // Validate the locale early even though both comma and dot are intentionally accepted.
  new Intl.NumberFormat(options.locale ?? DEFAULT_LOCALES[currency]);

  let normalized = removeCurrencyMarker(
    input.trim().replaceAll("−", "-"),
    currency,
  );
  if (normalized === "") {
    throw new MoneyError("Money amount is required.");
  }

  let negative = false;
  if (normalized.startsWith("-") || normalized.startsWith("+")) {
    negative = normalized[0] === "-";
    normalized = normalized.slice(1);
  }

  if (negative && !allowNegative) {
    throw new MoneyError("Negative money amounts are not allowed here.");
  }

  normalized = normalized.replace(MONEY_SPACES, "");
  if (normalized === "" || !/^[\d.,]+$/u.test(normalized)) {
    throw new MoneyError("Money amount contains unsupported characters.");
  }

  const { major, fraction } = splitDecimal(normalized);
  if (!/^\d+$/u.test(major)) {
    throw new MoneyError("Money amount has an invalid integer part.");
  }

  const minorText = `${major}${fraction.padEnd(2, "0")}`.replace(
    /^0+(?=\d)/u,
    "",
  );
  const absoluteMinor = BigInt(minorText);
  return assertMoneyRange(negative ? -absoluteMinor : absoluteMinor);
}

export function addMoney(left: bigint, right: bigint): bigint {
  assertMoneyRange(left);
  assertMoneyRange(right);
  return assertMoneyRange(left + right);
}

export function subtractMoney(left: bigint, right: bigint): bigint {
  assertMoneyRange(left);
  assertMoneyRange(right);
  return assertMoneyRange(left - right);
}

export function compareMoney(left: bigint, right: bigint): -1 | 0 | 1 {
  assertMoneyRange(left);
  assertMoneyRange(right);
  return left < right ? -1 : left > right ? 1 : 0;
}

export function roundMoney(
  amountMinor: bigint,
  incrementMinor = 1n,
  mode: MoneyRoundingMode = "half-away-from-zero",
): bigint {
  assertMoneyRange(amountMinor);
  if (incrementMinor <= 0n) {
    throw new MoneyError("Rounding increment must be positive.");
  }

  const quotient = amountMinor / incrementMinor;
  const remainder = amountMinor % incrementMinor;
  if (remainder === 0n) {
    return amountMinor;
  }

  const direction = amountMinor < 0n ? -1n : 1n;
  let roundedQuotient = quotient;

  switch (mode) {
    case "toward-zero":
      break;
    case "away-from-zero":
      roundedQuotient += direction;
      break;
    case "floor":
      if (amountMinor < 0n) roundedQuotient -= 1n;
      break;
    case "ceil":
      if (amountMinor > 0n) roundedQuotient += 1n;
      break;
    case "half-away-from-zero":
      if ((remainder < 0n ? -remainder : remainder) * 2n >= incrementMinor) {
        roundedQuotient += direction;
      }
      break;
  }

  return assertMoneyRange(roundedQuotient * incrementMinor);
}

function formatExact(
  amountMinor: bigint,
  locale: string,
  options: FormatMoneyOptions,
  currency?: SupportedCurrency,
): string {
  assertMoneyRange(amountMinor);
  const minimumFractionDigits = options.minimumFractionDigits ?? 2;
  const maximumFractionDigits = options.maximumFractionDigits ?? 2;
  if (minimumFractionDigits > maximumFractionDigits) {
    throw new MoneyError(
      "Minimum fraction digits cannot exceed maximum fraction digits.",
    );
  }

  const increment =
    maximumFractionDigits === 0 ? 100n : maximumFractionDigits === 1 ? 10n : 1n;
  const rounded = roundMoney(amountMinor, increment);
  const negative = rounded < 0n;
  const absolute = negative ? -rounded : rounded;
  const major = absolute / 100n;
  let fraction = (absolute % 100n)
    .toString()
    .padStart(2, "0")
    .slice(0, maximumFractionDigits);
  while (fraction.length > minimumFractionDigits && fraction.endsWith("0")) {
    fraction = fraction.slice(0, -1);
  }

  const commonOptions: Intl.NumberFormatOptions = {
    numberingSystem: "latn",
    minimumFractionDigits: fraction.length,
    maximumFractionDigits: fraction.length,
  };
  const formatter = new Intl.NumberFormat(
    locale,
    currency
      ? { ...commonOptions, style: "currency", currency }
      : commonOptions,
  );
  const groupedMajor = new Intl.NumberFormat(locale, {
    numberingSystem: "latn",
    useGrouping: true,
    maximumFractionDigits: 0,
  }).format(major);

  return formatter
    .formatToParts(negative ? -0 : 0)
    .map((part) => {
      if (part.type === "integer") return groupedMajor;
      if (part.type === "fraction") return fraction;
      return part.value;
    })
    .join("");
}

export function formatMoney(
  amountMinor: bigint,
  options: FormatMoneyOptions = {},
): string {
  return formatExact(amountMinor, options.locale ?? "ru-RU", options);
}

export function formatCurrency(
  amountMinor: bigint,
  currency: SupportedCurrency,
  options: FormatMoneyOptions = {},
): string {
  return formatExact(
    amountMinor,
    options.locale ?? DEFAULT_LOCALES[currency],
    options,
    currency,
  );
}

export function serializeMoney(amountMinor: bigint): SerializedMoney {
  return assertMoneyRange(amountMinor).toString() as SerializedMoney;
}

export function deserializeMoney(value: string): bigint {
  if (!INTEGER_STRING.test(value)) {
    throw new MoneyError("Serialized money must be an integer decimal string.");
  }

  return assertMoneyRange(BigInt(value));
}
