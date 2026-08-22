import { calculateProgress } from "@/lib/goals/calculations";
import {
  type FormatMoneyOptions,
  type SupportedCurrency,
  formatCurrency,
} from "@/lib/money";

export interface GoalProgressMetaInput {
  savedMinor: bigint;
  targetMinor: bigint;
  currency: SupportedCurrency;
  locale?: string | undefined;
}

export interface GoalProgressMeta {
  isFunded: boolean;
  isOverfunded: boolean;
  /** Display percent: "42%" or "100%+" for an overfunded goal. */
  percentText: string;
  savedText: string;
  targetText: string;
  surplusText: string | null;
  valueText: string;
  /** Display-safe fill share in the inclusive 0..100 range. */
  cappedPercent: number;
}

const moneyOptions = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
} as const;

/**
 * Shared text/percent view over the goal calculator: bigint-safe floor
 * percent, exact formatted money and an overfund-aware accessible value
 * text. Used by both linear and circular goal progress.
 */
export function describeGoalProgress(
  input: GoalProgressMetaInput,
): GoalProgressMeta {
  const progress = calculateProgress(input.targetMinor, input.savedMinor);
  const displayPercent = progress.basisPoints / 100n;
  const moneyOptionsFor = (locale?: string): FormatMoneyOptions =>
    locale ? { ...moneyOptions, locale } : moneyOptions;

  const savedText = formatCurrency(
    input.savedMinor,
    input.currency,
    moneyOptionsFor(input.locale),
  );
  const targetText = formatCurrency(
    input.targetMinor,
    input.currency,
    moneyOptionsFor(input.locale),
  );
  const surplusText = progress.isOverfunded
    ? formatCurrency(
        input.savedMinor - input.targetMinor,
        input.currency,
        moneyOptionsFor(input.locale),
      )
    : null;
  const percentText = progress.isOverfunded
    ? "100%+"
    : `${displayPercent.toString()}%`;

  return {
    isFunded: progress.isFunded,
    isOverfunded: progress.isOverfunded,
    percentText,
    savedText,
    targetText,
    surplusText,
    valueText: progress.isOverfunded
      ? `Накоплено ${savedText} при цели ${targetText}, сверх цели ${surplusText}`
      : `Накоплено ${savedText} из ${targetText} (${percentText})`,
    cappedPercent: Number(progress.cappedBasisPoints) / 100,
  };
}
